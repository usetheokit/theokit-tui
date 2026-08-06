import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "ink-testing-library";

import {
  ChatThread,
  ContextWindowBar,
  CostMeter,
  TheoTUIProvider,
  TokenUsageChart,
} from "../src/index.js";
import type { ChatThreadMessage } from "../src/index.js";
import { Box } from "ink";
import {
  fmt,
  frameSampler,
  round,
  stats,
  tick,
  stackVersions,
} from "./sampling.js";
import type { RunMetrics } from "./sampling.js";

// M5 metrics-footer benchmark (plan T3.2, ADR D6): the always-on footer
// under a streaming M1 thread. The reportable result is the MODE DELTA
// (with-metrics − without-metrics) — the widget cost in the hot path.
const N_MESSAGES = 50;
const N_STEPS = 150;
const TOKENS_PER_STEP = 400;
const COST_PER_STEP = 0.002;
const LIMIT_TOKENS = 128_000;
const CATEGORIES = 2; // input + output bars in the footer chart
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");

type Mode = "with-metrics" | "without-metrics";

// EC-17: ALL step data PRE-GENERATED — string concat is fixture noise. The
// step arrays are SHARED between modes (EC-6 cadence symmetry): exactly ONE
// rerender per step in BOTH modes; without-metrics simply does not mount the
// footer subtree (the tail-message append drives frames in both modes).
const baseMessages: ChatThreadMessage[] = Array.from(
  { length: N_MESSAGES },
  (_, i) => ({
    id: `m${i}`,
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message ${i} — the quick brown fox jumps over the dog`,
  }),
);
const tailTexts = Array.from({ length: N_STEPS + 1 }, (_, s) =>
  "streaming reply ".concat("x".repeat(s)),
);
const stepUsed = Array.from(
  { length: N_STEPS + 1 },
  (_, s) => 24_000 + s * TOKENS_PER_STEP,
);
const stepCost = Array.from(
  { length: N_STEPS + 1 },
  (_, s) => 0.4 + s * COST_PER_STEP,
);

// Fail-fast workload self-checks: the metric props MUST change every step
// (frozen props would zero the with-metrics delta silently) and the tail
// text MUST grow (it drives frames in BOTH modes).
if (stepUsed[0] === stepUsed[N_STEPS] || stepCost[0] === stepCost[N_STEPS]) {
  throw new Error("bench: metric step arrays are frozen — workload void");
}
if (tailTexts[0] === tailTexts[N_STEPS]) {
  throw new Error("bench: tail text does not grow — no frame driver");
}

function App({ step, mode }: { step: number; mode: Mode }) {
  const messages: ChatThreadMessage[] = [
    ...baseMessages,
    {
      id: "tail",
      role: "assistant",
      content: tailTexts[step] as string,
    },
  ];
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <ChatThread messages={messages} />
        {mode === "with-metrics" && (
          <Box flexDirection="column">
            <ContextWindowBar
              usedTokens={stepUsed[step] as number}
              limitTokens={LIMIT_TOKENS}
              width={46}
            />
            <TokenUsageChart
              usage={{
                input: (stepUsed[step] as number) - 8_000,
                output: 8_000 + step * 40,
              }}
              width={46}
            />
            <CostMeter costUsd={stepCost[step] as number} />
          </Box>
        )}
      </Box>
    </TheoTUIProvider>
  );
}

async function runOnce(mode: Mode): Promise<RunMetrics> {
  const instance = render(<App step={0} mode={mode} />);
  await tick();
  const sampler = frameSampler(() => instance.frames.length);
  const stdoutFramesAtMount = instance.frames.length;

  for (let step = 1; step <= N_STEPS; step++) {
    // EC-6: exactly ONE rerender per step in BOTH modes.
    instance.rerender(<App step={step} mode={mode} />);
    await tick();
    sampler.sample();
  }
  const stdoutFramesAfter = instance.frames.length;
  instance.unmount();

  if (stdoutFramesAfter <= stdoutFramesAtMount) {
    throw new Error(
      "bench: steps produced no frames — memoization swallowed the workload (EC-15 guard)",
    );
  }
  return sampler.finish();
}

console.log(
  `metrics-footer bench — ${N_MESSAGES}-message thread × ${N_STEPS} streaming steps, modes with-metrics|without-metrics` +
    (smoke ? " [SMOKE: 1 run with-metrics-only, 0 warmup, no file write]" : ""),
);

const measured = smoke ? 1 : MEASURED_RUNS;
const modes: Mode[] = smoke
  ? ["with-metrics"]
  : ["with-metrics", "without-metrics"];
const results: {
  mode: Mode;
  runs: RunMetrics[];
  aggregate: {
    frames_mean: number;
    mean_ms_per_frame: { mean: number; std_dev: number };
    peak_ms_per_frame: { mean: number; std_dev: number };
  };
}[] = [];

for (const mode of modes) {
  for (let i = 0; i < (smoke ? 0 : WARMUP_RUNS); i++) {
    const w = await runOnce(mode);
    console.log(fmt(`${mode} warmup`, w) + "  (discarded)");
  }
  const runs: RunMetrics[] = [];
  for (let i = 0; i < measured; i++) {
    const r = await runOnce(mode);
    runs.push(r);
    console.log(fmt(`${mode} #${i + 1}`, r));
  }
  results.push({
    mode,
    runs,
    aggregate: {
      frames_mean: round(runs.reduce((a, r) => a + r.frames, 0) / runs.length),
      mean_ms_per_frame: stats(runs.map((r) => r.mean_ms_per_frame)),
      peak_ms_per_frame: stats(runs.map((r) => r.peak_ms_per_frame)),
    },
  });
}

console.log("=== aggregates ===");
for (const r of results) {
  console.log(
    `${r.mode.padEnd(16)} mean=${r.aggregate.mean_ms_per_frame.mean}±${r.aggregate.mean_ms_per_frame.std_dev}ms  ` +
      `peak=${r.aggregate.peak_ms_per_frame.mean}±${r.aggregate.peak_ms_per_frame.std_dev}ms`,
  );
}
if (!smoke && results.length === 2) {
  // Find by mode, never by position (review dom-testing-3) — reordering the
  // modes array must not silently flip the delta sign.
  const withM = results.find((r) => r.mode === "with-metrics");
  const without = results.find((r) => r.mode === "without-metrics");
  if (withM === undefined || without === undefined) {
    throw new Error("bench: mode results missing — delta cannot be computed");
  }
  // BOTH promised deltas printed (review dom-testing-2) — the peak verdict
  // must never be hand-derived after the fact.
  for (const metric of ["mean_ms_per_frame", "peak_ms_per_frame"] as const) {
    const a = withM.aggregate[metric];
    const b = without.aggregate[metric];
    const delta = round(a.mean - b.mean);
    const sigma = Math.max(a.std_dev, b.std_dev);
    console.log(
      `=== mode delta (with − without) ${metric} === ${delta}ms/frame (max σ ${sigma}) ` +
        (Math.abs(delta) <= sigma ? "[INCONCLUSIVE — within 1σ]" : ""),
    );
  }
}

if (!smoke) {
  const baseline = {
    benchmark: "metrics-footer-render",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "unset" },
    workload: {
      messages: N_MESSAGES,
      steps: N_STEPS,
      tokens_per_step: TOKENS_PER_STEP,
      categories: CATEGORIES,
    },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    modes: results,
    methodology:
      "ink-testing-library render + rerender loop; mount = 50-message " +
      "ChatThread + (with-metrics mode only) a footer of ContextWindowBar + " +
      "2-bar TokenUsageChart + CostMeter; each of 150 measured steps appends " +
      "one token to the tail assistant message AND advances usedTokens/cost " +
      "props from SHARED pre-generated step arrays with exactly ONE rerender " +
      "per step in BOTH modes (cadence symmetry — the tail append drives " +
      "frames in both); the reportable result is the mode delta " +
      "(with-metrics − without-metrics) on mean/peak_ms_per_frame — the " +
      "metrics-widget cost in the streaming hot path; deltas within 1 " +
      "std_dev are INCONCLUSIVE and must be reported as such (a null delta " +
      "IS the negligible-overhead evidence); fail-fast self-checks assert " +
      "the metric props change across steps and the tail text grows; EC-15 " +
      "guard asserts each run's total stdout frames exceed its mount count; " +
      "color env pinned by benchmarks/run.ts (FORCE_COLOR=1); 1 discarded " +
      "warmup + N measured runs per mode; population std dev.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "baselines",
    "m5-metrics-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(
    "baseline written: benchmarks/baselines/m5-metrics-baseline.json",
  );
}
