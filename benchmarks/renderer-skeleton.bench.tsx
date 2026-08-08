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

// M17 renderer bench (plan T3.1, ADR D4): the FIRST dual-engine baseline with
// a BYTES-written axis. EC-5 — the differential engine's win is BYTES, not
// just ms: ink rewrites the full frame each commit (log-update), ours rewrites
// only the changed rows. Scene: a 200-line column; SCRIPT: initial paint + 60
// update frames each mutating 3 rows (a streaming-agent shape).
//
// Bytes methodology (honest): `ink` bytes = the sum of every committed frame's
// byte length (ink-testing-library frames) — ink's full-frame log-update model
// means each commit paints ~one whole frame to the terminal. `own` bytes = the
// REAL bytes the engine writes to its Terminal (the differential stream). The
// two are the terminal-write cost of each model on the identical script; the
// order-of-magnitude gap is the point, not a byte-exact ink probe.

const LINES = 200;
const UPDATE_FRAMES = 60;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");
const loadAtStart = loadavg()[0] ?? -1;

/** A Terminal that counts the bytes written (the differential-stream cost). */
class CountingTerminal implements Terminal {
  readonly columns = 100;
  readonly rows = 50;
  bytes = 0;
  write(data: string): void {
    this.bytes += Buffer.byteLength(data, "utf8");
  }
  hideCursor(): void {
    this.write("\x1b[?25l");
  }
  showCursor(): void {
    this.write("\x1b[?25h");
  }
}

/** The scene at update step `step` (step -1 = initial). 3 rows carry the step. */
function scene(step: number): React.ReactElement {
  const rows = Array.from({ length: LINES }, (_, i) => {
    const hot = step >= 0 && i % LINES < 3 ? i + step : i;
    return <Text key={i}>{`row ${i} · value ${hot} · ${"—".repeat(8)}`}</Text>;
  });
  return <Box flexDirection="column">{rows}</Box>;
}

interface ModeResult {
  mode: string;
  bytes_written: number;
  runs: { mean_ms_per_frame: number }[];
  aggregate: { mean_ms_per_frame: { mean: number; std_dev: number } };
}

async function runOwn(): Promise<{ meanMs: number; bytes: number }> {
  const term = new CountingTerminal();
  const r = createRenderer(term);
  const start = performance.now();
  r.render(scene(-1));
  await tick();
  for (let f = 0; f < UPDATE_FRAMES; f++) {
    r.render(scene(f));
    await tick();
  }
  const elapsed = performance.now() - start;
  r.unmount();
  return { meanMs: elapsed / (UPDATE_FRAMES + 1), bytes: term.bytes };
}

async function runInk(): Promise<{ meanMs: number; bytes: number }> {
  const instance = inkRender(scene(-1));
  const start = performance.now();
  for (let f = 0; f < UPDATE_FRAMES; f++) {
    instance.rerender(scene(f));
    await tick();
  }
  const elapsed = performance.now() - start;
  const bytes = instance.frames.reduce(
    (sum, frame) => sum + Buffer.byteLength(frame, "utf8"),
    0,
  );
  instance.unmount();
  return { meanMs: elapsed / (UPDATE_FRAMES + 1), bytes };
}

async function measure(
  mode: string,
  run: () => Promise<{ meanMs: number; bytes: number }>,
): Promise<ModeResult> {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await run();
  }
  const measured = smoke ? 1 : MEASURED_RUNS;
  const runs: { mean_ms_per_frame: number }[] = [];
  let bytes = 0;
  for (let i = 0; i < measured; i++) {
    const { meanMs, bytes: b } = await run();
    runs.push({ mean_ms_per_frame: round(meanMs) });
    bytes = b; // deterministic across runs — last wins
  }
  const meanStats = stats(runs.map((r) => r.mean_ms_per_frame));
  return {
    mode,
    bytes_written: bytes,
    runs,
    aggregate: {
      mean_ms_per_frame: {
        mean: round(meanStats.mean),
        std_dev: round(meanStats.std_dev),
      },
    },
  };
}

async function main(): Promise<void> {
  const ink = await measure("ink", runInk);
  const own = await measure("own", runOwn);

  const bytesDelta = ink.bytes_written / Math.max(own.bytes_written, 1);
  const baseline = {
    benchmark: "renderer-skeleton",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env["FORCE_COLOR"] ?? "" },
    load_1min_at_start: round(loadAtStart),
    workload: { lines: LINES, update_frames: UPDATE_FRAMES },
    protocol: {
      warmup_runs: WARMUP_RUNS,
      measured_runs: smoke ? 1 : MEASURED_RUNS,
    },
    bytes_delta_ink_over_own: round(bytesDelta),
    modes: [ink, own],
    methodology:
      "ink bytes = sum of committed frame byte-lengths (full-frame log-update model); own bytes = real differential Terminal writes. Same 200-line + 60-update script. FORCE_COLOR pinned. Order-of-magnitude bytes gap is the diff-engine win (EC-5).",
  };

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "baselines");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "m17-renderer-skeleton-baseline.json");
  writeFileSync(outFile, JSON.stringify(baseline, null, 2) + "\n");

  process.stdout.write(
    `\nrenderer-skeleton bench (load ${round(loadAtStart)}):\n` +
      `  ink  → ${ink.bytes_written} bytes, ${ink.aggregate.mean_ms_per_frame.mean} ms/frame\n` +
      `  own  → ${own.bytes_written} bytes, ${own.aggregate.mean_ms_per_frame.mean} ms/frame\n` +
      `  bytes delta (ink/own): ${round(bytesDelta)}×\n` +
      `  → ${outFile}\n`,
  );
}

main().catch((error: unknown) => {
  console.error("renderer-skeleton bench failed:", error);
  process.exit(1);
});
