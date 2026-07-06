import { performance } from "node:perf_hooks";

// Shared bench sampling/stat helpers (rule of three — M0/M1/M2 benches;
// plan T3.2 REFACTOR). Methodology stays in each bench's baseline JSON.

export const tick = async (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

export const round = (n: number): number => Math.round(n * 1000) / 1000;

export interface RunMetrics {
  frames: number;
  mean_ms_per_frame: number;
  peak_ms_per_frame: number;
}

export const stats = (values: number[]): { mean: number; std_dev: number } => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean: round(mean), std_dev: round(Math.sqrt(variance)) };
};

export const fmt = (label: string, r: RunMetrics): string =>
  `${label.padEnd(16)} frames=${String(r.frames).padStart(4)}  mean=${r.mean_ms_per_frame
    .toFixed(3)
    .padStart(8)}ms  peak=${r.peak_ms_per_frame.toFixed(3).padStart(8)}ms`;

/**
 * Frame-delta sampler: distributes wall time across new stdout frames after
 * each awaited step. `sample()` after every mutation; `finish()` returns the
 * metrics and enforces the zero-frame guard (M0 EC-2 — never serialize NaN).
 */
export function frameSampler(readFrameCount: () => number) {
  const frameTimes: number[] = [];
  let lastSeen = readFrameCount();
  let lastTime = performance.now();
  return {
    sample(): void {
      const now = performance.now();
      const newFrames = readFrameCount() - lastSeen;
      if (newFrames > 0) {
        const perFrame = (now - lastTime) / newFrames;
        for (let k = 0; k < newFrames; k++) {
          frameTimes.push(perFrame);
        }
        lastTime = now;
        lastSeen = readFrameCount();
      }
    },
    finish(): RunMetrics {
      if (frameTimes.length === 0) {
        console.error("bench: 0 frames captured — aborting (EC-2 guard)");
        process.exit(1);
      }
      const mean = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      return {
        frames: frameTimes.length,
        mean_ms_per_frame: round(mean),
        peak_ms_per_frame: round(Math.max(...frameTimes)),
      };
    },
    frameCount(): number {
      return frameTimes.length;
    },
  };
}
