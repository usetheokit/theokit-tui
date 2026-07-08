import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "ink-testing-library";

import { AgentTimeline, TheoTUIProvider } from "../src/index.js";
import type { AgentEvent } from "../src/index.js";
import {
  fmt,
  frameSampler,
  round,
  stats,
  tick,
  stackVersions,
} from "./sampling.js";
import type { RunMetrics } from "./sampling.js";

// M3 agent-timeline benchmark (plan T3.2, ADR D7): heterogeneous event mix
// streaming/appending under windowing; bounded|unbounded matrix quantifies
// the tall-item graduation cost (roadmap risk 1 — peak is the metric).
const N_EVENTS = 300;
const N_STEPS = 150;
const LONG_OUTPUT_LINES = 500;
const MAX_LINES_BOUNDED = 10;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;
const WINDOW_SIZE = 8;
const WINDOW_OVERSCAN = 4;
// ≈50% messages / ≈30% tools / ≈20% thinking (blueprint Corner 3 proposal).
const EVENT_MIX = { message: 0.5, tool: 0.3, thinking: 0.2 };

// MUST land in a tool slot (i % 10 ∈ {5,6,7}) — review dom-testing-1 found
// the original index 42 routed to the MESSAGE branch, silently deleting the
// tall item from every run. It must ALSO fall in the APPEND range
// (N_EVENTS..N_EVENTS+N_STEPS) so the tall item graduates DURING the
// measured loop — a mount-range index graduates before sampling starts and
// its cost lands in the excluded mount. Self-check below fails loudly.
const TALL_ITEM_INDEX = 345;

const smoke = process.argv.includes("--smoke");

type Mode = "bounded" | "unbounded";

const longOutput = Array.from(
  { length: LONG_OUTPUT_LINES },
  (_, i) => `output line ${i}`,
).join("\n");

function makeEvent(i: number, mode: Mode): AgentEvent {
  const slot = i % 10;
  const maxLines =
    mode === "bounded" ? MAX_LINES_BOUNDED : LONG_OUTPUT_LINES + 1;
  if (slot < 5) {
    return {
      id: `e${i}`,
      kind: "message",
      role: i % 2 === 0 ? "user" : "assistant",
      text: `message ${i} — the quick brown fox jumps over the dog`,
    };
  }
  if (slot < 8) {
    return {
      id: `e${i}`,
      kind: "tool",
      name: `tool-${i}`,
      status: (["running", "success", "failed"] as const)[i % 3] ?? "success",
      output:
        i === TALL_ITEM_INDEX ? longOutput : `result ${i}\nsecond line ${i}`,
      maxLines,
    };
  }
  return {
    id: `e${i}`,
    kind: "thinking",
    text: `thinking step ${i}\nconsidering options for ${i}`,
  };
}

function App({ events }: { events: AgentEvent[] }) {
  return (
    <TheoTUIProvider>
      <AgentTimeline
        events={events}
        windowSize={WINDOW_SIZE}
        windowOverscan={WINDOW_OVERSCAN}
      />
    </TheoTUIProvider>
  );
}

// Fail-fast workload self-check (review dom-testing-1): the tall item must
// be a TOOL event appended DURING the loop, or the matrix is void.
function assertTallItemInAppendRange(mode: Mode): void {
  const tallProbe = makeEvent(TALL_ITEM_INDEX, mode);
  if (
    tallProbe.kind !== "tool" ||
    tallProbe.output === undefined ||
    tallProbe.output.split("\n").length !== LONG_OUTPUT_LINES ||
    TALL_ITEM_INDEX < N_EVENTS ||
    TALL_ITEM_INDEX >= N_EVENTS + N_STEPS
  ) {
    throw new Error(
      "bench: tall tool item missing from the measured append range — slot math regressed (dom-testing-1 guard)",
    );
  }
}

/** Streaming repaint shape for the tail event, alternating by kind. */
function replaceTail(last: AgentEvent, step: number): AgentEvent {
  if (last.kind === "message") {
    return { ...last, text: last.text + "x" };
  }
  if (last.kind === "tool") {
    return { ...last, status: step % 2 === 0 ? "success" : "failed" };
  }
  return { ...last, text: last.text + "." };
}

async function runOnce(mode: Mode): Promise<RunMetrics> {
  let events = Array.from({ length: N_EVENTS }, (_, i) => makeEvent(i, mode));
  assertTallItemInAppendRange(mode);
  const instance = render(<App events={events} />);
  await tick();
  const sampler = frameSampler(() => instance.frames.length);
  // EC-15 guard measures STDOUT frames per run/mode against its own mount
  // count (M2 post-review version; per-mode per plan EC-9).
  const stdoutFramesAtMount = instance.frames.length;

  for (let t = 0; t < N_STEPS; t++) {
    const last = events[events.length - 1];
    if (last === undefined) {
      break;
    }
    // Identity-replace the tail (streaming repaint), alternating shapes,
    // then append one event (graduating one per step under the window).
    events = [
      ...events.slice(0, -1),
      replaceTail(last, t),
      makeEvent(events.length, mode),
    ];
    instance.rerender(<App events={events} />);
    await tick();
    sampler.sample();
  }
  const stdoutFramesAfter = instance.frames.length;
  instance.unmount();

  if (stdoutFramesAfter <= stdoutFramesAtMount) {
    throw new Error(
      "bench: transitions produced no frames — memoization swallowed the workload (EC-15 guard)",
    );
  }
  return sampler.finish();
}

console.log(
  `agent-timeline bench — ${N_EVENTS}+${N_STEPS} mixed events, modes bounded|unbounded` +
    (smoke ? " [SMOKE: 1 run bounded-only, 0 warmup, no file write]" : ""),
);

const measured = smoke ? 1 : MEASURED_RUNS;
const modes: Mode[] = smoke ? ["bounded"] : ["bounded", "unbounded"];
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
    `${r.mode.padEnd(10)} mean=${r.aggregate.mean_ms_per_frame.mean}±${r.aggregate.mean_ms_per_frame.std_dev}ms  ` +
      `peak=${r.aggregate.peak_ms_per_frame.mean}±${r.aggregate.peak_ms_per_frame.std_dev}ms`,
  );
}

if (!smoke) {
  const baseline = {
    benchmark: "agent-timeline-render",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "unset" },
    workload: {
      events: N_EVENTS,
      steps: N_STEPS,
      event_mix: EVENT_MIX,
      long_output_lines: LONG_OUTPUT_LINES,
      max_lines_bounded: MAX_LINES_BOUNDED,
      window: `${WINDOW_SIZE}+${WINDOW_OVERSCAN}`,
    },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    modes: results,
    methodology:
      "ink-testing-library render + rerender loop; mount = 300 mixed events " +
      "(≈50% 1-line messages, ≈30% tool cards, ≈20% 2-line thinking) under " +
      "windowSize 8+4, plus ONE 500-line tool output APPENDED mid-loop " +
      "(step 45) so its graduation lands inside the sampled steps; each step " +
      "identity-replaces the tail event (token append / status transition, " +
      "alternating) AND appends one event, graduating one event per step " +
      "into <Static>; modes: bounded = tool maxLines 10, unbounded = " +
      "maxLines > output height — compare the modes' peak_ms_per_frame to " +
      "read the tall-item graduation cost (the heterogeneous-heights " +
      "metric; mean averages the spike away). Deltas within 1 std_dev are " +
      "INCONCLUSIVE and must be reported as such; per-frame ms " +
      "= wall time across stdout.frames deltas (includes tick overhead); " +
      "EC-15 guard asserts each run's total stdout frames exceed its own " +
      "mount count (per mode); color env pinned by benchmarks/run.ts " +
      "(FORCE_COLOR=1); 1 discarded warmup + N measured runs per mode; " +
      "population std dev.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs",
    "benchmarks",
    "m3-agent-timeline-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(
    "baseline written: docs/benchmarks/m3-agent-timeline-baseline.json",
  );
}
