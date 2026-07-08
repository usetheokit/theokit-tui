import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { Box, Text } from "ink";
import { render } from "ink-testing-library";

import {
  AppStatusBar,
  ChatMessage,
  TheoTUIProvider,
  useTurnElapsed,
} from "../src/index.js";
import { fmt, frameSampler, round, stats, stackVersions } from "./sampling.js";
import type { RunMetrics } from "./sampling.js";

// M14 app-status-bar benchmark (plan T2.2, ADR D3): the ticking bar is a
// per-frame path (M9 flip condition). Modes:
//   ticking — REAL timers: useTurnElapsed drives the bar's state slot for
//             N_TICKS one-second ticks under a small static thread (fake
//             timers would not measure the engine; M12 precedent).
//   static  — rerender loop with the bar PRESENT but no ticking (the cost
//             every consumer pays per unrelated repaint).
const N_TICKS = 10;
const N_STATIC_STEPS = 150;
const N_MESSAGES = 30;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 3;

const smoke = process.argv.includes("--smoke");
const loadAtStart = loadavg()[0] ?? -1;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function Thread() {
  return (
    <Box flexDirection="column">
      {Array.from({ length: N_MESSAGES }, (_, i) => (
        <ChatMessage key={i} role={i % 2 === 0 ? "user" : "assistant"}>
          {`message ${i} — the quick brown fox jumps over the lazy dog`}
        </ChatMessage>
      ))}
    </Box>
  );
}

function TickingApp() {
  const elapsed = useTurnElapsed(true);
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <Thread />
        <AppStatusBar
          model="bench-model"
          cwd="/tmp/bench"
          tokens={{ used: 12_300, limit: 128_000 }}
          state={`streaming ${elapsed}s`}
        />
      </Box>
    </TheoTUIProvider>
  );
}

interface TickingRun extends RunMetrics {
  wall_ms: number;
}

async function runTicking(): Promise<TickingRun> {
  const instance = render(<TickingApp />);
  const start = performance.now();
  const sampler = frameSampler(() => instance.frames.length);
  const framesAtMount = instance.frames.length;
  const deadline = start + (N_TICKS + 5) * 1000;
  for (;;) {
    await sleep(500);
    sampler.sample();
    const frame = instance.lastFrame() ?? "";
    if (frame.includes(`streaming ${N_TICKS}s`)) {
      break;
    }
    if (performance.now() > deadline) {
      instance.unmount();
      throw new Error("bench: ticking run missed its deadline");
    }
  }
  const wall = performance.now() - start;
  instance.unmount();
  if (instance.frames.length <= framesAtMount) {
    throw new Error("bench: ticking produced no frames");
  }
  return { ...sampler.finish(), wall_ms: round(wall) };
}

function StaticApp({ step }: { step: number }) {
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <Thread />
        <Text dimColor>step {step}</Text>
        <AppStatusBar
          model="bench-model"
          cwd="/tmp/bench"
          tokens={{ used: 12_300, limit: 128_000 }}
          state="idle"
        />
      </Box>
    </TheoTUIProvider>
  );
}

async function runStatic(): Promise<RunMetrics> {
  const instance = render(<StaticApp step={0} />);
  await sleep(0);
  const sampler = frameSampler(() => instance.frames.length);
  const framesAtMount = instance.frames.length;
  for (let step = 1; step <= N_STATIC_STEPS; step++) {
    instance.rerender(<StaticApp step={step} />);
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
  `app-status-bar bench — ticking (${N_TICKS}×1s real timers) | static (${N_STATIC_STEPS} rerenders)` +
    (smoke ? " [SMOKE: 1 static run only, no file write]" : ""),
);

const tickingRuns: TickingRun[] = [];
const staticRuns: RunMetrics[] = [];
const measured = smoke ? 1 : MEASURED_RUNS;

if (!smoke) {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    const w = await runTicking();
    console.log(fmt("ticking warmup", w) + "  (discarded)");
  }
  for (let i = 0; i < measured; i++) {
    const r = await runTicking();
    tickingRuns.push(r);
    console.log(
      fmt(`ticking #${i + 1}`, r) + `  wall=${r.wall_ms.toFixed(0)}ms`,
    );
  }
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

console.log("=== aggregates ===");
if (tickingRuns.length > 0) {
  const t = aggregate(tickingRuns);
  console.log(
    `ticking  mean=${t.mean_ms_per_frame.mean}±${t.mean_ms_per_frame.std_dev}ms  peak=${t.peak_ms_per_frame.mean}±${t.peak_ms_per_frame.std_dev}ms`,
  );
}
const s = aggregate(staticRuns);
console.log(
  `static   mean=${s.mean_ms_per_frame.mean}±${s.mean_ms_per_frame.std_dev}ms  peak=${s.peak_ms_per_frame.mean}±${s.peak_ms_per_frame.std_dev}ms`,
);

if (!smoke) {
  const wallStats = stats(tickingRuns.map((r) => r.wall_ms));
  console.log(`ticking wall: ${wallStats.mean}±${wallStats.std_dev}ms`);
  const baseline = {
    benchmark: "app-status-bar-render",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "unset" },
    load_1min_at_start: round(loadAtStart),
    workload: {
      ticks: N_TICKS,
      tick_interval_ms: 1000,
      static_steps: N_STATIC_STEPS,
      thread_messages: N_MESSAGES,
    },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    ticking_wall_ms: wallStats,
    modes: [
      { mode: "ticking", runs: tickingRuns, aggregate: aggregate(tickingRuns) },
      { mode: "static", runs: staticRuns, aggregate: aggregate(staticRuns) },
    ],
    methodology:
      "ticking mode: useTurnElapsed(true) drives the state slot under a " +
      "30-message static thread with REAL timers; sampled every 500 ms " +
      "until the bar shows the final tick; wall_ms = mount→final-tick " +
      "(expected ≈ N_TICKS s). static mode: 150-step rerender loop (child " +
      "counter drives frames) with the bar present but not ticking. " +
      "Frame-delta sampler; FORCE_COLOR=1 via benchmarks/run.ts; 1 warmup " +
      "+ N measured runs per mode; population std dev.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs",
    "benchmarks",
    "m14-status-bar-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n");
  console.log("baseline written: docs/benchmarks/m14-status-bar-baseline.json");
}
