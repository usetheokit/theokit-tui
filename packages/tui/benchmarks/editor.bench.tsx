import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  type EditorAction,
  type EditorState,
  editorReducer,
  initialEditorState,
} from "../src/chat/composer-editor.js";
import { round, stats } from "./sampling.js";

// M21 editor bench (plan m21-premium-capabilities T3.1, Feature B): the OWN bench
// for the editor path — the pure editor reducer per keystroke over a realistic
// burst (type a paragraph, word-navigate, kill/yank, undo). Pure + synchronous,
// so it measures the reducer cost, not React. ms/op mean ± std_dev, load gated.

const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;
const smoke = process.argv.includes("--smoke");
const loadAtStart = loadavg()[0] ?? -1;

/** A realistic editing session: type words, navigate, kill, yank, undo. */
function buildActions(): EditorAction[] {
  const actions: EditorAction[] = [];
  const paragraph = "the quick brown fox jumps over the lazy dog ".repeat(4);
  for (const ch of paragraph) {
    actions.push({ type: "buffer", action: { type: "insert", text: ch } });
  }
  for (let i = 0; i < 20; i++) {
    actions.push({ type: "buffer", action: { type: "move-word-left" } });
  }
  for (let i = 0; i < 10; i++) {
    actions.push({ type: "kill", kind: "word-forward" });
  }
  actions.push({ type: "yank" });
  actions.push({ type: "yank-pop" });
  for (let i = 0; i < 10; i++) {
    actions.push({ type: "undo" });
  }
  return actions;
}

const ACTIONS = buildActions();

function runOnce(): number {
  const start = performance.now();
  let state: EditorState = initialEditorState;
  for (const action of ACTIONS) {
    state = editorReducer(state, action);
  }
  const elapsed = performance.now() - start;
  return (elapsed / ACTIONS.length) * 1000; // microseconds per op
}

function main(): void {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    runOnce();
  }
  const measured = smoke ? 1 : MEASURED_RUNS;
  const runs: { us_per_op: number }[] = [];
  for (let i = 0; i < measured; i++) {
    runs.push({ us_per_op: round(runOnce()) });
  }
  const s = stats(runs.map((r) => r.us_per_op));
  const baseline = {
    benchmark: "editor",
    date: new Date().toISOString(),
    node_version: process.version,
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    load_1min_at_start: round(loadAtStart),
    workload: { keystrokes: ACTIONS.length },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    runs,
    aggregate: {
      us_per_op: { mean: round(s.mean), std_dev: round(s.std_dev) },
    },
    methodology:
      "The pure editor reducer over a realistic editing burst (type a paragraph, word-navigate, kill-forward, yank, yank-pop, undo). Microseconds per op, mean ± std_dev over 5 runs.",
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "baselines");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "editor-baseline.json");
  writeFileSync(outFile, `${JSON.stringify(baseline, null, 2)}\n`);
  process.stdout.write(
    `\neditor bench (load ${round(loadAtStart)}): ${baseline.aggregate.us_per_op.mean} µs/op → ${outFile}\n`,
  );
}

main();
