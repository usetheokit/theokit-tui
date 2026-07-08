import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "ink-testing-library";

import {
  ChatThread,
  TheoTUIProvider,
  ToolCallCard,
  ToolResult,
} from "../src/index.js";
import type { ChatThreadMessage, ToolCallStatus } from "../src/index.js";
import { fmt, frameSampler, stats, tick, stackVersions } from "./sampling.js";
import type { RunMetrics } from "./sampling.js";

// M2 tool-cards benchmark (plan T3.2, Blueprint Corner 3): thread + mixed
// status cards mounted, then status transitions on running cards, with one
// long-output card truncated at maxLines 10.
const N_MESSAGES = 100;
const N_CARDS = 50;
const N_TRANSITIONS = 150;
const LONG_OUTPUT_LINES = 500;
const MAX_LINES = 10;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");

const STATUS_CYCLE: ToolCallStatus[] = [
  "pending",
  "running",
  "success",
  "failed",
];

const longOutput = Array.from(
  { length: LONG_OUTPUT_LINES },
  (_, i) => `output line ${i}`,
).join("\n");

const messages: ChatThreadMessage[] = Array.from(
  { length: N_MESSAGES },
  (_, i) => ({
    id: `m${i}`,
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message ${i} — the quick brown fox jumps over the dog`,
  }),
);

function App({ statuses }: { statuses: ToolCallStatus[] }) {
  return (
    <TheoTUIProvider>
      <ChatThread messages={messages} />
      {statuses.map((status, i) => (
        <ToolCallCard
          key={`card-${i}`}
          name={`tool-${i}`}
          status={status}
          summary={`arg-${i}`}
        >
          <ToolResult
            shell={{
              stdout: i === 0 ? longOutput : `result ${i}`,
              stderr: status === "failed" ? `error ${i}` : "",
              exitCode: status === "failed" ? 1 : 0,
            }}
            maxLines={MAX_LINES}
          />
        </ToolCallCard>
      ))}
    </TheoTUIProvider>
  );
}

async function runOnce(): Promise<RunMetrics> {
  let statuses = Array.from(
    { length: N_CARDS },
    (_, i) => STATUS_CYCLE[i % STATUS_CYCLE.length] as ToolCallStatus,
  );
  const instance = render(<App statuses={statuses} />);
  await tick();
  const sampler = frameSampler(() => instance.frames.length);
  // Review dom-testing-1/wire-1: measure STDOUT frames at mount — the
  // sampler's own count is always 0 here and can never detect swallowing.
  const stdoutFramesAtMount = instance.frames.length;

  for (let t = 0; t < N_TRANSITIONS; t++) {
    // Transition one card per step: running → success/failed, then the next
    // pending → running — a live agent-turn shape.
    const runningIndex = statuses.indexOf("running");
    if (runningIndex >= 0) {
      statuses = [...statuses];
      statuses[runningIndex] = t % 2 === 0 ? "success" : "failed";
    }
    const pendingIndex = statuses.indexOf("pending");
    if (pendingIndex >= 0) {
      statuses = [...statuses];
      statuses[pendingIndex] = "running";
    }
    // Recycle so the workload never runs out of transitions.
    if (runningIndex < 0 && pendingIndex < 0) {
      statuses = statuses.map((_, i) => (i % 2 === 0 ? "pending" : "running"));
    }
    instance.rerender(<App statuses={statuses} />);
    await tick();
    sampler.sample();
  }
  const stdoutFramesAfterTransitions = instance.frames.length;
  instance.unmount();

  // EC-15: memoization must never silently swallow the measured work — the
  // transition loop has to flush stdout frames beyond the mount. (End-of-run
  // total, not per-step: Ink throttles stdout, so individual steps may batch
  // — logged as DV-4.)
  if (stdoutFramesAfterTransitions <= stdoutFramesAtMount) {
    throw new Error(
      "bench: transitions produced no frames — memoization swallowed the workload (EC-15 guard)",
    );
  }
  return sampler.finish();
}

console.log(
  `tool-cards bench — ${N_MESSAGES} msgs + ${N_CARDS} cards, ${N_TRANSITIONS} transitions` +
    (smoke ? " [SMOKE: 1 run, no file write]" : ""),
);

const measured = smoke ? 1 : MEASURED_RUNS;
for (let i = 0; i < (smoke ? 0 : WARMUP_RUNS); i++) {
  const w = await runOnce();
  console.log(fmt("warmup", w) + "  (discarded)");
}
const runs: RunMetrics[] = [];
for (let i = 0; i < measured; i++) {
  const r = await runOnce();
  runs.push(r);
  console.log(fmt(`run #${i + 1}`, r));
}

const aggregate = {
  frames_mean:
    Math.round((runs.reduce((a, r) => a + r.frames, 0) / runs.length) * 1000) /
    1000,
  mean_ms_per_frame: stats(runs.map((r) => r.mean_ms_per_frame)),
  peak_ms_per_frame: stats(runs.map((r) => r.peak_ms_per_frame)),
};
console.log(
  `aggregate  mean=${aggregate.mean_ms_per_frame.mean}±${aggregate.mean_ms_per_frame.std_dev}ms  ` +
    `peak=${aggregate.peak_ms_per_frame.mean}±${aggregate.peak_ms_per_frame.std_dev}ms`,
);

if (!smoke) {
  const baseline = {
    benchmark: "tool-cards-render",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "unset" },
    workload: {
      messages: N_MESSAGES,
      cards: N_CARDS,
      transitions: N_TRANSITIONS,
      long_output_lines: LONG_OUTPUT_LINES,
      max_lines: MAX_LINES,
    },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    runs,
    aggregate,
    methodology:
      "ink-testing-library render + rerender loop; mount = 100-message " +
      "thread + 50 ToolCallCards (statuses round-robin, one card with a " +
      "500-line shell output truncated at maxLines 10); each step " +
      "transitions one running card to success/failed and promotes one " +
      "pending card to running, then rerenders; per-frame ms = wall time " +
      "distributed across stdout.frames deltas (includes tick overhead); " +
      "EC-15 guard asserts the run's total stdout frames exceed the " +
      "mount-time count (end-of-run check — Ink throttling batches steps); " +
      "color env pinned by benchmarks/run.ts (FORCE_COLOR=1); 1 discarded " +
      "warmup + N measured runs; population std dev.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs",
    "benchmarks",
    "m2-tool-cards-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n");
  console.log("baseline written: docs/benchmarks/m2-tool-cards-baseline.json");
}
