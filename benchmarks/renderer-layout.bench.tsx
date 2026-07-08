import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { Box, Text } from "ink";
import { render as inkRender } from "ink-testing-library";

import { createRenderer } from "../src/renderer/renderer.js";
import type { Terminal } from "../src/renderer/terminal.js";
import { round, stats, stackVersions, tick } from "./sampling.js";

// M18 renderer-layout bench (plan T3.1, ADR D4): the FULL layout+render pipeline
// (yoga calculateLayout → renderNodeToOutput → cell grid → OutputEngine) vs Ink
// on a chat-thread-shaped workload (the M1 thread). Measures ms/frame for an
// initial paint + 40 update frames (a growing thread), both under FORCE_COLOR=1.

const MESSAGES = 30;
const UPDATE_FRAMES = 40;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");
const loadAtStart = loadavg()[0] ?? -1;

class SinkTerminal implements Terminal {
  readonly columns = 80;
  readonly rows = 50;
  write(): void {}
  hideCursor(): void {}
  showCursor(): void {}
}

/** A column of chat-message rows (icon + text), `n` messages, `step` mutates the tail. */
function scene(n: number, step: number): React.ReactElement {
  const rows = Array.from({ length: n }, (_, i) => (
    <Box key={i} flexDirection="row">
      <Text>{i % 2 === 0 ? "› " : "✦ "}</Text>
      <Text>{`message ${i} · turn ${i === n - 1 ? step : 0}`}</Text>
    </Box>
  ));
  return <Box flexDirection="column">{rows}</Box>;
}

async function runOwn(): Promise<number> {
  const r = createRenderer(new SinkTerminal());
  const start = performance.now();
  r.render(scene(MESSAGES, 0));
  await tick();
  for (let f = 0; f < UPDATE_FRAMES; f++) {
    r.render(scene(MESSAGES, f));
    await tick();
  }
  const elapsed = performance.now() - start;
  r.unmount();
  return elapsed / (UPDATE_FRAMES + 1);
}

async function runInk(): Promise<number> {
  const instance = inkRender(scene(MESSAGES, 0));
  const start = performance.now();
  for (let f = 0; f < UPDATE_FRAMES; f++) {
    instance.rerender(scene(MESSAGES, f));
    await tick();
  }
  const elapsed = performance.now() - start;
  instance.unmount();
  return elapsed / (UPDATE_FRAMES + 1);
}

async function measure(
  mode: string,
  run: () => Promise<number>,
): Promise<{
  mode: string;
  runs: { mean_ms_per_frame: number }[];
  aggregate: { mean_ms_per_frame: { mean: number; std_dev: number } };
}> {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await run();
  }
  const measured = smoke ? 1 : MEASURED_RUNS;
  const runs: { mean_ms_per_frame: number }[] = [];
  for (let i = 0; i < measured; i++) {
    runs.push({ mean_ms_per_frame: round(await run()) });
  }
  const s = stats(runs.map((r) => r.mean_ms_per_frame));
  return {
    mode,
    runs,
    aggregate: {
      mean_ms_per_frame: { mean: round(s.mean), std_dev: round(s.std_dev) },
    },
  };
}

async function main(): Promise<void> {
  const own = await measure("own", runOwn);
  const ink = await measure("ink", runInk);
  const baseline = {
    benchmark: "renderer-layout",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "" },
    load_1min_at_start: round(loadAtStart),
    workload: { messages: MESSAGES, update_frames: UPDATE_FRAMES },
    protocol: {
      warmup_runs: WARMUP_RUNS,
      measured_runs: smoke ? 1 : MEASURED_RUNS,
    },
    modes: [own, ink],
    methodology:
      "Full layout+render pipeline (yoga calculateLayout → renderNodeToOutput → cell grid → OutputEngine) vs Ink rerender on a 30-message thread, 40 update frames. ms/frame mean ± std_dev over 5 runs, FORCE_COLOR=1.",
  };
  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs",
    "benchmarks",
  );
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "m18-renderer-layout-baseline.json");
  writeFileSync(outFile, JSON.stringify(baseline, null, 2) + "\n");
  process.stdout.write(
    `\nrenderer-layout bench (load ${round(loadAtStart)}):\n` +
      `  own → ${own.aggregate.mean_ms_per_frame.mean} ms/frame\n` +
      `  ink → ${ink.aggregate.mean_ms_per_frame.mean} ms/frame\n` +
      `  → ${outFile}\n`,
  );
}

main().catch((error: unknown) => {
  console.error("renderer-layout bench failed:", error);
  process.exit(1);
});
