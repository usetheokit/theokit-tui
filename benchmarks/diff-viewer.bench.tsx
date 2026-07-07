import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "ink-testing-library";

import { DiffViewer, TheoTUIProvider } from "../src/index.js";
import { fmt, frameSampler, round, stats, tick } from "./sampling.js";
import type { RunMetrics } from "./sampling.js";

// M4 diff-viewer benchmark (plan T3.2, ADR D9): a unified diff GROWING
// during the measured loop, windowed|full matrix; the wide-line hunk lands
// in the APPEND range (M3 dom-testing-1 lesson) with a fail-fast self-check.
const MOUNT_HUNKS = 10;
const N_STEPS = 40;
const HUNK_LINES = 30; // 10 context / 15 add / 5 del (EC-18 — fold axis active)
const CONTEXT_LINES_PER_HUNK = 10;
const WIDE_HUNK_STEP = 25; // measured-range step whose hunk has 500-char lines
const WIDE_LINE_CHARS = 500;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;
const WINDOWED_MAX_LINES = 80;
const WINDOWED_CONTEXT_LINES = 2;

const smoke = process.argv.includes("--smoke");

type Mode = "windowed" | "full";

function makeHunk(index: number, wide: boolean): string {
  const base = index * 100 + 1;
  const pad = (text: string): string =>
    wide ? text + "x".repeat(WIDE_LINE_CHARS) : text;
  const rows: string[] = [`@@ -${base},15 +${base},25 @@`];
  for (let i = 0; i < CONTEXT_LINES_PER_HUNK; i++) {
    rows.push(` ${pad(`ctx-${index}-${i}`)}`);
  }
  for (let i = 0; i < 15; i++) {
    rows.push(`+${pad(`add-${index}-${i}`)}`);
  }
  for (let i = 0; i < 5; i++) {
    rows.push(`-${pad(`del-${index}-${i}`)}`);
  }
  return rows.join("\n");
}

function makePatch(hunkCount: number): string {
  // The wide hunk is the LAST hunk of the step-WIDE_HUNK_STEP patch: index
  // MOUNT_HUNKS + WIDE_HUNK_STEP - 1 (self-check below guards the math).
  const hunks = Array.from({ length: hunkCount }, (_, i) =>
    makeHunk(i, i === MOUNT_HUNKS + WIDE_HUNK_STEP - 1),
  );
  return ["--- a/big.ts", "+++ b/big.ts", ...hunks, ""].join("\n");
}

// EC-17: ALL patch strings PRE-GENERATED — string concat is fixture noise;
// parsing stays inside render (that IS the component cost).
const patches = Array.from({ length: N_STEPS + 1 }, (_, i) =>
  makePatch(MOUNT_HUNKS + i),
);

// Fail-fast self-checks (D9): the wide hunk must land in the APPEND range.
if (WIDE_HUNK_STEP < 1 || WIDE_HUNK_STEP > N_STEPS) {
  throw new Error(
    "bench: wide hunk outside the measured append range (M3 dom-testing-1 guard)",
  );
}
if (!(patches[WIDE_HUNK_STEP] as string).includes("x".repeat(100))) {
  throw new Error(
    "bench: wide-line hunk missing from its patch — generator regressed",
  );
}
// Negative half (wire-2): the wide hunk must NOT leak before its step.
if ((patches[WIDE_HUNK_STEP - 1] as string).includes("x".repeat(100))) {
  throw new Error("bench: wide hunk leaked before its step");
}

function App({ patch, mode }: { patch: string; mode: Mode }) {
  return (
    <TheoTUIProvider>
      <DiffViewer
        patch={patch}
        {...(mode === "windowed"
          ? {
              maxLines: WINDOWED_MAX_LINES,
              contextLines: WINDOWED_CONTEXT_LINES,
            }
          : {})}
      />
    </TheoTUIProvider>
  );
}

/** Mount self-check (wire-1, plan EC-18): cap+fold must be ACTIVE. */
async function assertWindowingActiveAtMount(): Promise<void> {
  const w = render(<App patch={patches[0] as string} mode="windowed" />);
  await tick();
  const windowedRows = (w.lastFrame() ?? "").split("\n").length;
  w.unmount();
  const f = render(<App patch={patches[0] as string} mode="full" />);
  await tick();
  const fullRows = (f.lastFrame() ?? "").split("\n").length;
  f.unmount();
  if (windowedRows >= fullRows) {
    throw new Error(
      `bench: windowing inactive at mount (windowed ${windowedRows} >= full ${fullRows})`,
    );
  }
}

await assertWindowingActiveAtMount();

async function runOnce(mode: Mode): Promise<RunMetrics> {
  const instance = render(<App patch={patches[0] as string} mode={mode} />);
  await tick();
  const sampler = frameSampler(() => instance.frames.length);
  const stdoutFramesAtMount = instance.frames.length;

  for (let step = 1; step <= N_STEPS; step++) {
    instance.rerender(<App patch={patches[step] as string} mode={mode} />);
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
  `diff-viewer bench — ${MOUNT_HUNKS}+${N_STEPS} hunks × ${HUNK_LINES} lines, modes windowed|full` +
    (smoke ? " [SMOKE: 1 run windowed-only, 0 warmup, no file write]" : ""),
);

const measured = smoke ? 1 : MEASURED_RUNS;
const modes: Mode[] = smoke ? ["windowed"] : ["windowed", "full"];
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
    benchmark: "diff-viewer-render",
    date: new Date().toISOString(),
    node_version: process.version,
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "unset" },
    workload: {
      mount_hunks: MOUNT_HUNKS,
      steps: N_STEPS,
      hunk_lines: HUNK_LINES,
      context_lines_per_hunk: CONTEXT_LINES_PER_HUNK,
      wide_line_chars: WIDE_LINE_CHARS,
      windowed: `maxLines ${WINDOWED_MAX_LINES} + contextLines ${WINDOWED_CONTEXT_LINES}`,
    },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    modes: results,
    methodology:
      "ink-testing-library render + rerender loop; mount = DiffViewer with " +
      "10 hunks (30 lines each: 10 context / 15 add / 5 del); each of 40 " +
      "measured steps swaps in a PRE-GENERATED patch string with one more " +
      "hunk (parse runs inside render — the component cost; string " +
      "generation excluded per EC-17); a 500-char wide-line hunk is " +
      "INTRODUCED at step 25 and present in all subsequent steps, so its " +
      "wrap+parse cost lands INSIDE the sampled window (M3 lesson); a mount " +
      "self-check asserts windowed renders fewer rows than full; modes: " +
      "windowed = maxLines 80 + contextLines 2, full = " +
      "unbounded; compare the modes' mean/peak_ms_per_frame growth to read " +
      "the large-diff windowing claim — peak_ms_per_frame is the headline " +
      "metric; deltas within 1 std_dev are INCONCLUSIVE and must be " +
      "reported as such; EC-15 guard asserts each run's total stdout frames " +
      "exceed its mount count; color env pinned by benchmarks/run.ts " +
      "(FORCE_COLOR=1); 1 discarded warmup + N measured runs per mode; " +
      "population std dev.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs",
    "benchmarks",
    "m4-diff-viewer-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n");
  console.log("baseline written: docs/benchmarks/m4-diff-viewer-baseline.json");
}
