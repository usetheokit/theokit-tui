import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { render } from "ink-testing-library";
import { Text } from "ink";

import { TheoTUIProvider, WelcomeBanner } from "../src/index.js";
import { fmt, frameSampler, round, stats, stackVersions } from "./sampling.js";
import type { RunMetrics } from "./sampling.js";

// M12 welcome-banner benchmark (plan T2.2, ADR D3): the reveal is a
// per-frame path — the recorded M9 flip condition fired, so the component
// gets its OWN bench. Two modes:
//   reveal — the full 12-phase script under REAL timers (fake timers would
//            not measure the engine); the gate is opened by shadowing
//            isTTY/rows on itl's fake stdout (the unit-suite idiom).
//   static — rerender-loop cost of the static tree (the gate-closed path
//            every existing consumer pays).
const REVEAL_PHASES = 12;
const REVEAL_TICK_MS = 80;
const N_STATIC_STEPS = 150;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");
const loadAtStart = loadavg()[0] ?? -1;

const BANNER_PROPS = {
  name: "Theo TUI",
  version: "0.13.0",
  tagline: "AI-agent primitives for the terminal",
  hints: ["/help for commands", "esc to cancel a running turn"],
} as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type Mode = "reveal" | "static";

interface RevealRun extends RunMetrics {
  wall_ms: number;
}

async function runReveal(): Promise<RevealRun> {
  // Open the gate: shadow isTTY/rows before the banner mounts (probe-first
  // keyed-remount idiom from src/welcome-banner.test.tsx).
  const instance = render(<Text>probe</Text>);
  Object.defineProperty(instance.stdout, "isTTY", {
    get: () => true,
    configurable: true,
  });
  Object.defineProperty(instance.stdout, "rows", {
    get: () => 30,
    configurable: true,
  });
  const start = performance.now();
  instance.rerender(
    <TheoTUIProvider>
      <WelcomeBanner {...BANNER_PROPS} animated key="gated" />
    </TheoTUIProvider>,
  );
  const sampler = frameSampler(() => instance.frames.length);
  const framesAtMount = instance.frames.length;

  // Poll on the real tick cadence until the full static content converges
  // (the last hint appears) or the honest deadline passes.
  const deadline = start + 5_000;
  for (;;) {
    await sleep(REVEAL_TICK_MS / 2);
    sampler.sample();
    const frame = instance.lastFrame() ?? "";
    if (frame.includes("esc to cancel a running turn")) {
      break;
    }
    if (performance.now() > deadline) {
      instance.unmount();
      throw new Error("bench: reveal did not converge within 5 s");
    }
  }
  const wall = performance.now() - start;
  instance.unmount();
  if (instance.frames.length <= framesAtMount) {
    throw new Error("bench: reveal produced no frames — gate never opened");
  }
  const metrics = sampler.finish();
  return { ...metrics, wall_ms: round(wall) };
}

async function runStatic(): Promise<RunMetrics> {
  const instance = render(
    <TheoTUIProvider>
      <WelcomeBanner {...BANNER_PROPS}>
        <Text dimColor>step 0</Text>
      </WelcomeBanner>
    </TheoTUIProvider>,
  );
  await sleep(0);
  const sampler = frameSampler(() => instance.frames.length);
  const framesAtMount = instance.frames.length;
  for (let step = 1; step <= N_STATIC_STEPS; step++) {
    instance.rerender(
      <TheoTUIProvider>
        <WelcomeBanner {...BANNER_PROPS}>
          <Text dimColor>step {step}</Text>
        </WelcomeBanner>
      </TheoTUIProvider>,
    );
    await sleep(0);
    sampler.sample();
  }
  const framesAfter = instance.frames.length;
  instance.unmount();
  if (framesAfter <= framesAtMount) {
    throw new Error("bench: static steps produced no frames");
  }
  return sampler.finish();
}

console.log(
  `welcome-banner bench — reveal (${REVEAL_PHASES}×${REVEAL_TICK_MS}ms real timers) | static (${N_STATIC_STEPS} rerenders)` +
    (smoke ? " [SMOKE: 1 run per mode, 0 warmup, no file write]" : ""),
);

const measured = smoke ? 1 : MEASURED_RUNS;
const revealRuns: RevealRun[] = [];
const staticRuns: RunMetrics[] = [];

for (let i = 0; i < (smoke ? 0 : WARMUP_RUNS); i++) {
  const w = await runReveal();
  console.log(fmt("reveal warmup", w) + "  (discarded)");
}
for (let i = 0; i < measured; i++) {
  const r = await runReveal();
  revealRuns.push(r);
  console.log(fmt(`reveal #${i + 1}`, r) + `  wall=${r.wall_ms.toFixed(0)}ms`);
}
for (let i = 0; i < (smoke ? 0 : WARMUP_RUNS); i++) {
  const w = await runStatic();
  console.log(fmt("static warmup", w) + "  (discarded)");
}
for (let i = 0; i < measured; i++) {
  const r = await runStatic();
  staticRuns.push(r);
  console.log(fmt(`static #${i + 1}`, r));
}

const aggregate = (runs: RunMetrics[]) => ({
  frames_mean: round(runs.reduce((a, r) => a + r.frames, 0) / runs.length),
  mean_ms_per_frame: stats(runs.map((r) => r.mean_ms_per_frame)),
  peak_ms_per_frame: stats(runs.map((r) => r.peak_ms_per_frame)),
});

const modes: { mode: Mode; runs: RunMetrics[] }[] = [
  { mode: "reveal", runs: revealRuns },
  { mode: "static", runs: staticRuns },
];
const wallStats = stats(revealRuns.map((r) => r.wall_ms));
console.log("=== aggregates ===");
for (const m of modes) {
  const agg = aggregate(m.runs);
  console.log(
    `${m.mode.padEnd(8)} mean=${agg.mean_ms_per_frame.mean}±${agg.mean_ms_per_frame.std_dev}ms  peak=${agg.peak_ms_per_frame.mean}±${agg.peak_ms_per_frame.std_dev}ms`,
  );
}
console.log(
  `reveal wall: ${wallStats.mean}±${wallStats.std_dev}ms (< 2000 required)`,
);
if (wallStats.mean >= 2000) {
  throw new Error(
    `bench: reveal wall ${wallStats.mean}ms breaks the < 2 s DoD`,
  );
}

if (!smoke) {
  const baseline = {
    benchmark: "welcome-banner-reveal",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "unset" },
    load_1min_at_start: round(loadAtStart),
    workload: {
      reveal_phases: REVEAL_PHASES,
      reveal_tick_ms: REVEAL_TICK_MS,
      static_steps: N_STATIC_STEPS,
    },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    reveal_wall_ms: wallStats,
    modes: modes.map((m) => ({
      mode: m.mode,
      runs: m.runs,
      aggregate: aggregate(m.runs),
    })),
    methodology:
      "reveal mode: itl render with isTTY/rows getter-shadowed open (probe-" +
      "first keyed remount), REAL timers — the 12×80 ms interval drives the " +
      "engine; sampled every 40 ms until the last hint converges (5 s " +
      "honest deadline); wall_ms = mount→convergence, asserted < 2000 (the " +
      "M12 DoD). static mode: gate-closed rerender loop (150 steps, child " +
      "counter drives frames) — the cost every pre-M12 consumer pays. " +
      "Frame-delta sampler distributes wall time across stdout frames; " +
      "color env pinned by benchmarks/run.ts (FORCE_COLOR=1); 1 discarded " +
      "warmup + N measured runs per mode; population std dev.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "baselines",
    "welcome-banner-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(
    "baseline written: benchmarks/baselines/welcome-banner-baseline.json",
  );
}
