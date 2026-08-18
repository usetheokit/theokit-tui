import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "ink-testing-library";

import { ChatThread, TheoTUIProvider } from "../src/index.js";
import type { ChatThreadMessage } from "../src/index.js";
import {
  fmt,
  frameSampler,
  round,
  stats,
  tick,
  stackVersions,
} from "./sampling.js";
import type { RunMetrics } from "./sampling.js";

// M1 thread benchmark (plan T4.1, ADR D6): plain vs windowed mode matrix.
// Workload per EC-1 (edge-case MUST FIX): each step BOTH replaces the last
// message (+1 char — streaming repaint) AND appends a new message (append
// churn: tail-array rebuild + Static graduation) — the analog's pattern.
const N_MESSAGES = 500;
const N_TOKENS = 300;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;
const WINDOW_SIZE = 8;
const WINDOW_OVERSCAN = 4;
// SEPA brief: plain mode must never graduate rows mid-run — size the window
// against the FINAL length (initial + appends), not the initial count.
const FINAL_LENGTH = N_MESSAGES + N_TOKENS;

const smoke = process.argv.includes("--smoke");

type Mode = "plain" | "windowed";

const makeMessage = (i: number, content?: string): ChatThreadMessage => ({
  id: `m${i}`,
  role: i % 2 === 0 ? "user" : "assistant",
  content: content ?? `message ${i} — the quick brown fox jumps over the dog`,
});

function App({
  messages,
  mode,
}: {
  messages: ChatThreadMessage[];
  mode: Mode;
}) {
  return (
    <TheoTUIProvider>
      <ChatThread
        messages={messages}
        windowSize={mode === "windowed" ? WINDOW_SIZE : FINAL_LENGTH}
        windowOverscan={mode === "windowed" ? WINDOW_OVERSCAN : 0}
      />
    </TheoTUIProvider>
  );
}

async function runOnce(mode: Mode): Promise<RunMetrics> {
  // Sampling via shared helpers (review arch-1/dom-testing-2 migration) —
  // identical frame-delta heuristic as the original inline loop.
  let messages = Array.from({ length: N_MESSAGES }, (_, i) => makeMessage(i));
  const instance = render(<App messages={messages} mode={mode} />);
  await tick();
  const sampler = frameSampler(() => instance.frames.length);

  for (let t = 0; t < N_TOKENS; t++) {
    const last = messages[messages.length - 1];
    if (last === undefined) {
      break;
    }
    // Streaming repaint + append churn in one step (EC-1).
    messages = [
      ...messages.slice(0, -1),
      { ...last, content: last.content + "x" },
      makeMessage(messages.length),
    ];
    instance.rerender(<App messages={messages} mode={mode} />);
    await tick();
    sampler.sample();
  }
  instance.unmount();
  return sampler.finish();
}

console.log(
  `chat-thread bench — ${N_MESSAGES}+${N_TOKENS} msgs, modes plain|windowed` +
    (smoke ? " [SMOKE: 1 run/mode, no file write]" : ""),
);

const measured = smoke ? 1 : MEASURED_RUNS;
const modes: Mode[] = ["plain", "windowed"];
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
  // Smoke skips warmups — proof-of-execution only (review F-xval-3 budget).
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
    `${r.mode.padEnd(10)} mean=${r.aggregate.mean_ms_per_frame.mean}±${r.aggregate.mean_ms_per_frame.std_dev}ms  ` +
      `peak=${r.aggregate.peak_ms_per_frame.mean}±${r.aggregate.peak_ms_per_frame.std_dev}ms`,
  );
}

if (!smoke) {
  const baseline = {
    benchmark: "chat-thread-render",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "unset" },
    workload: {
      messages: N_MESSAGES,
      streamed_tokens: N_TOKENS,
      window: `${WINDOW_SIZE}+${WINDOW_OVERSCAN}`,
    },
    protocol: { warmup_runs: smoke ? 0 : WARMUP_RUNS, measured_runs: measured },
    modes: results,
    methodology:
      "ink-testing-library render + rerender loop; each step replaces the " +
      "last message (+1 char) AND appends a new message (EC-1 — streaming " +
      "repaint + append churn/Static graduation measured together); plain " +
      "mode windowSize = final length so nothing graduates; per-frame ms = " +
      "wall time distributed across stdout.frames deltas (includes tick " +
      "overhead); color env pinned by benchmarks/run.ts (FORCE_COLOR=1); " +
      "1 discarded warmup + N measured runs per mode; population std dev.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "baselines",
    "chat-thread-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(
    "baseline written: benchmarks/baselines/chat-thread-baseline.json",
  );
}
