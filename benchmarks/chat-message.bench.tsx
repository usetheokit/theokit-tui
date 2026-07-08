import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Box } from "ink";
import { render } from "ink-testing-library";

import { ChatMessage, TheoTUIProvider } from "../src/index.js";
import {
  fmt,
  frameSampler,
  round,
  stats,
  tick,
  stackVersions,
} from "./sampling.js";
import type { RunMetrics } from "./sampling.js";

// M0 render benchmark (plan T3.1, ADR D6/D9 — data-only, no threshold gate).
// Workload: 100-message static thread + 300-token streaming append into the
// last assistant message. Metrics: frame count + mean/peak ms-per-frame.
// Protocol: 1 discarded warmup + 5 measured runs, mean ± std dev.
const N_MESSAGES = 100;
const N_TOKENS = 300;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");

function App({ streamed }: { streamed: string }) {
  const history = Array.from({ length: N_MESSAGES }, (_, i) => (
    <ChatMessage key={i} role={i % 2 === 0 ? "user" : "assistant"}>
      {`message ${i} — the quick brown fox jumps over the lazy dog`}
    </ChatMessage>
  ));
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        {history}
        <ChatMessage role="assistant">{streamed}</ChatMessage>
      </Box>
    </TheoTUIProvider>
  );
}

async function runOnce(): Promise<RunMetrics> {
  // Sampling via shared helpers (review arch-1/dom-testing-2 migration) —
  // identical frame-delta heuristic as the original inline loop.
  const instance = render(<App streamed="" />);
  await tick();
  const sampler = frameSampler(() => instance.frames.length);
  let text = "";

  for (let i = 0; i < N_TOKENS; i++) {
    text += "tok ";
    instance.rerender(<App streamed={text} />);
    await tick();
    sampler.sample();
  }
  instance.unmount();
  return sampler.finish();
}

console.log(
  `chat-message bench — ${N_MESSAGES} messages + ${N_TOKENS} streamed tokens` +
    (smoke ? " [SMOKE: 1 run, no file write]" : ""),
);

for (let i = 0; i < WARMUP_RUNS; i++) {
  const w = await runOnce();
  console.log(fmt(`warmup #${i + 1}`, w) + "  (discarded)");
}

const measured = smoke ? 1 : MEASURED_RUNS;
const runs: RunMetrics[] = [];
for (let i = 0; i < measured; i++) {
  const r = await runOnce();
  runs.push(r);
  console.log(fmt(`run #${i + 1}`, r));
}

const aggregate = {
  frames_mean: round(runs.reduce((a, r) => a + r.frames, 0) / runs.length),
  mean_ms_per_frame: stats(runs.map((r) => r.mean_ms_per_frame)),
  peak_ms_per_frame: stats(runs.map((r) => r.peak_ms_per_frame)),
};

console.log("=== aggregate ===");
console.log(
  `frames_mean=${aggregate.frames_mean}  ` +
    `mean=${aggregate.mean_ms_per_frame.mean}±${aggregate.mean_ms_per_frame.std_dev}ms  ` +
    `peak=${aggregate.peak_ms_per_frame.mean}±${aggregate.peak_ms_per_frame.std_dev}ms`,
);

if (!smoke) {
  const baseline = {
    benchmark: "chat-message-render",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: {
      cpu: cpus()[0]?.model ?? "unknown",
      cores: cpus().length,
    },
    workload: { messages: N_MESSAGES, streamed_tokens: N_TOKENS },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "unset" },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    runs,
    aggregate,
    methodology:
      "ink-testing-library render + rerender loop (one event-loop tick between " +
      "rerenders so Ink flushes); per-frame ms = wall time distributed evenly " +
      "across stdout.frames deltas (react-ink heuristic — includes tick " +
      "overhead, not true per-frame instrumentation); color env pinned by " +
      "benchmarks/run.ts (FORCE_COLOR=1); 1 discarded warmup + N measured runs; " +
      "std_dev is population std dev over run-level means.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs",
    "benchmarks",
    "m0-chat-message-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(
    `baseline written: docs/benchmarks/m0-chat-message-baseline.json`,
  );
}
