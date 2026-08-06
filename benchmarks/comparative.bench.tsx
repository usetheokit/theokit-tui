import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { render as inkRender } from "ink";

import { ChatThread } from "../src/index.js";
import { createRenderer } from "../src/renderer/renderer.js";
import type { Terminal } from "../src/renderer/terminal.js";
import { round, stackVersions, stats, tick } from "./sampling.js";

// M20 comparative bench (plan m20-scrollback-cutover T3.1, ADR D5): the cutover
// evidence. Measures BOTH engines on the same streaming ChatThread workload on
// two axes — ms/frame AND bytes_written. bytes_written is the differential
// engine's headline: Ink's log-update rewrites the frame region each paint,
// while our CSI-2026 engine rewrites only changed rows. Both run FORCE_COLOR=1,
// ≥3 measured runs, mean ± std_dev, load recorded (skip if load ≥ 4).

const MESSAGES = 30;
const UPDATE_FRAMES = 40;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");
const loadAtStart = loadavg()[0] ?? -1;

/** A byte-counting output surface for OUR engine. */
class ByteTerminal implements Terminal {
  readonly columns = 80;
  readonly rows = 50;
  bytes = 0;
  write(data: string): void {
    this.bytes += Buffer.byteLength(data);
  }
  hideCursor(): void {}
  showCursor(): void {}
}

/** A byte-counting stdout for Ink's real render (log-update writes land here). */
class ByteStdout {
  columns = 80;
  rows = 50;
  isTTY = true;
  bytes = 0;
  write(data: string): boolean {
    this.bytes += Buffer.byteLength(data);
    return true;
  }
  on(): this {
    return this;
  }
  off(): this {
    return this;
  }
  removeListener(): this {
    return this;
  }
}

function scene(n: number, step: number): React.ReactElement {
  const messages = Array.from({ length: n }, (_, i) => ({
    id: String(i),
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content:
      i === n - 1 ? `streaming ${"·".repeat(step)}` : `message ${i} content`,
  }));
  return <ChatThread messages={messages} />;
}

interface Sample {
  mean_ms_per_frame: number;
  bytes_written: number;
}

async function runOwn(): Promise<Sample> {
  const term = new ByteTerminal();
  const r = createRenderer(term);
  // Symmetric with runInk: mount BEFORE the timer, measure only the update
  // frames (review L1). Bytes are counted across the whole run either way.
  r.render(scene(MESSAGES, 0));
  await tick();
  const start = performance.now();
  for (let f = 0; f < UPDATE_FRAMES; f++) {
    r.render(scene(MESSAGES, f));
    await tick();
  }
  const elapsed = performance.now() - start;
  r.unmount();
  return {
    mean_ms_per_frame: elapsed / UPDATE_FRAMES,
    bytes_written: term.bytes,
  };
}

async function runInk(): Promise<Sample> {
  const stdout = new ByteStdout();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = inkRender(scene(MESSAGES, 0), { stdout: stdout as any });
  const start = performance.now();
  for (let f = 0; f < UPDATE_FRAMES; f++) {
    instance.rerender(scene(MESSAGES, f));
    await tick();
  }
  const elapsed = performance.now() - start;
  instance.unmount();
  return {
    mean_ms_per_frame: elapsed / UPDATE_FRAMES,
    bytes_written: stdout.bytes,
  };
}

async function measure(
  mode: string,
  run: () => Promise<Sample>,
): Promise<{
  mode: string;
  runs: Sample[];
  aggregate: {
    mean_ms_per_frame: { mean: number; std_dev: number };
    bytes_written: { mean: number; std_dev: number };
  };
}> {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await run();
  }
  const measured = smoke ? 1 : MEASURED_RUNS;
  const runs: Sample[] = [];
  for (let i = 0; i < measured; i++) {
    const s = await run();
    runs.push({
      mean_ms_per_frame: round(s.mean_ms_per_frame),
      bytes_written: s.bytes_written,
    });
  }
  const ms = stats(runs.map((r) => r.mean_ms_per_frame));
  const by = stats(runs.map((r) => r.bytes_written));
  return {
    mode,
    runs,
    aggregate: {
      mean_ms_per_frame: { mean: round(ms.mean), std_dev: round(ms.std_dev) },
      bytes_written: { mean: round(by.mean), std_dev: round(by.std_dev) },
    },
  };
}

async function main(): Promise<void> {
  const v4 = await measure("v4", runOwn);
  const ink = await measure("ink", runInk);
  const baseline = {
    benchmark: "comparative",
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
    modes: [v4, ink],
    methodology:
      "Same 30-message ChatThread, 40 streaming-update frames, on both engines. Axes: ms/frame AND bytes_written (mean ± std_dev over 5 runs, FORCE_COLOR=1). v4 = our layout+differential CSI-2026 engine (byte-counting Terminal); ink = Ink's real render into a byte-counting stdout (log-update). bytes_written is the differential engine's headline advantage.",
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "baselines");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "m20-comparative-baseline.json");
  writeFileSync(outFile, JSON.stringify(baseline, null, 2) + "\n");
  process.stdout.write(
    `\ncomparative bench (load ${round(loadAtStart)}):\n` +
      `  v4  → ${v4.aggregate.mean_ms_per_frame.mean} ms/frame, ${v4.aggregate.bytes_written.mean} bytes\n` +
      `  ink → ${ink.aggregate.mean_ms_per_frame.mean} ms/frame, ${ink.aggregate.bytes_written.mean} bytes\n` +
      `  → ${outFile}\n`,
  );
}

main().catch((error: unknown) => {
  console.error("comparative bench failed:", error);
  process.exit(1);
});
