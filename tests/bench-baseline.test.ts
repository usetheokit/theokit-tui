import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface BenchBaseline {
  benchmark: string;
  date: string;
  node_version: string;
  hardware: { cpu: string; cores: number };
  workload: { messages: number; streamed_tokens: number };
  protocol: { warmup_runs: number; measured_runs: number };
  runs: {
    frames: number;
    mean_ms_per_frame: number;
    peak_ms_per_frame: number;
  }[];
  aggregate: {
    frames_mean: number;
    mean_ms_per_frame: { mean: number; std_dev: number };
    peak_ms_per_frame: { mean: number; std_dev: number };
  };
  methodology: string;
}

// T3.1 (plan ADR D6/D9): the committed baseline is the milestone's
// runtime-evidence artifact. EC-2: NaN is typeof number — Number.isFinite is
// the real oracle against a corrupt baseline poisoning future regressions.
describe("benchmark baseline (T3.1)", () => {
  it("benchmark_baseline_json_exists_with_statistical_protocol", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../docs/benchmarks/m0-chat-message-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as BenchBaseline;

    expect(baseline.protocol.measured_runs).toBeGreaterThanOrEqual(3);
    expect(baseline.runs.length).toBe(baseline.protocol.measured_runs);
    expect(baseline.protocol.warmup_runs).toBeGreaterThanOrEqual(1);

    for (const run of baseline.runs) {
      expect(run.frames).toBeGreaterThan(0);
      expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
      expect(Number.isFinite(run.peak_ms_per_frame)).toBe(true);
    }
    expect(Number.isFinite(baseline.aggregate.frames_mean)).toBe(true);
    expect(Number.isFinite(baseline.aggregate.mean_ms_per_frame.mean)).toBe(
      true,
    );
    expect(Number.isFinite(baseline.aggregate.mean_ms_per_frame.std_dev)).toBe(
      true,
    );
    expect(Number.isFinite(baseline.aggregate.peak_ms_per_frame.mean)).toBe(
      true,
    );
    expect(Number.isFinite(baseline.aggregate.peak_ms_per_frame.std_dev)).toBe(
      true,
    );

    expect(baseline.methodology.length > 0).toBe(true);
    expect(baseline.node_version.length > 0).toBe(true);
    expect(baseline.hardware.cores).toBeGreaterThan(0);
    expect(baseline.workload.messages).toBeGreaterThan(0);
    expect(baseline.workload.streamed_tokens).toBeGreaterThan(0);
  });
});
