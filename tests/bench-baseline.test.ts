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

    // Self-consistency (review F-dom-2): the aggregate must be derivable
    // from the runs — a finite-but-impossible hand-edit stays red.
    const runMeans = baseline.runs.map((r) => r.mean_ms_per_frame);
    const recomputedMean =
      runMeans.reduce((a, b) => a + b, 0) / runMeans.length;
    expect(
      Math.abs(recomputedMean - baseline.aggregate.mean_ms_per_frame.mean),
    ).toBeLessThan(0.01);
    expect(baseline.aggregate.mean_ms_per_frame.std_dev).toBeGreaterThanOrEqual(
      0,
    );
    expect(baseline.aggregate.peak_ms_per_frame.std_dev).toBeGreaterThanOrEqual(
      0,
    );

    expect(baseline.methodology.length > 0).toBe(true);
    expect(baseline.node_version.length > 0).toBe(true);
    expect(baseline.hardware.cores).toBeGreaterThan(0);
    expect(baseline.workload.messages).toBeGreaterThan(0);
    expect(baseline.workload.streamed_tokens).toBeGreaterThan(0);
  });
});

interface M1Mode {
  mode: string;
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
}

interface M1Baseline {
  benchmark: string;
  modes: M1Mode[];
  workload: { messages: number; streamed_tokens: number; window: string };
  protocol: { warmup_runs: number; measured_runs: number };
  node_version: string;
  hardware: { cpu: string; cores: number };
  color_env: { FORCE_COLOR: string };
  methodology: string;
}

describe("benchmark baseline M1 (T4.1)", () => {
  it("m1_thread_baseline_exists_with_mode_matrix", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../docs/benchmarks/m1-chat-thread-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as M1Baseline;

    expect(baseline.modes.length).toBe(2);
    const modeNames = baseline.modes.map((m) => m.mode).sort();
    expect(modeNames).toEqual(["plain", "windowed"]);
    // Oracle parity with the M0 block + env pin (review F-dom-2/F-tests-7:
    // a weaker oracle is how the unpinned baseline went green).
    expect(baseline.protocol.warmup_runs).toBeGreaterThanOrEqual(0);
    expect(baseline.color_env.FORCE_COLOR).toBe("1");
    expect(baseline.node_version.length > 0).toBe(true);
    expect(baseline.hardware.cores).toBeGreaterThan(0);
    for (const mode of baseline.modes) {
      expect(mode.runs.length).toBe(baseline.protocol.measured_runs);
      expect(mode.runs.length).toBeGreaterThanOrEqual(3);
      expect(Number.isFinite(mode.aggregate.frames_mean)).toBe(true);
      for (const run of mode.runs) {
        expect(run.frames).toBeGreaterThan(0);
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
        expect(Number.isFinite(run.peak_ms_per_frame)).toBe(true);
      }
      for (const metric of [
        "mean_ms_per_frame",
        "peak_ms_per_frame",
      ] as const) {
        expect(Number.isFinite(mode.aggregate[metric].mean)).toBe(true);
        expect(Number.isFinite(mode.aggregate[metric].std_dev)).toBe(true);
        expect(mode.aggregate[metric].std_dev).toBeGreaterThanOrEqual(0);
        const recomputed =
          mode.runs.reduce((a, r) => a + r[metric], 0) / mode.runs.length;
        expect(Math.abs(recomputed - mode.aggregate[metric].mean)).toBeLessThan(
          0.01,
        );
      }
    }
    expect(baseline.workload.messages).toBeGreaterThan(0);
    expect(baseline.workload.streamed_tokens).toBeGreaterThan(0);
    expect(baseline.methodology.length > 0).toBe(true);
  });
});

interface M2Baseline {
  benchmark: string;
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
  workload: {
    messages: number;
    cards: number;
    transitions: number;
    long_output_lines: number;
  };
  protocol: { warmup_runs: number; measured_runs: number };
  node_version: string;
  hardware: { cpu: string; cores: number };
  color_env: { FORCE_COLOR: string };
  methodology: string;
}

describe("benchmark baseline M2 (T3.2)", () => {
  it("m2_tool_cards_baseline_exists_with_protocol", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../docs/benchmarks/m2-tool-cards-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as M2Baseline;

    // M0-parity oracles + env pin (M1 review H-2 lesson: a bypassed runner
    // must never go green again).
    expect(baseline.protocol.measured_runs).toBeGreaterThanOrEqual(3);
    expect(baseline.runs.length).toBe(baseline.protocol.measured_runs);
    expect(baseline.protocol.warmup_runs).toBeGreaterThanOrEqual(1);
    expect(baseline.color_env.FORCE_COLOR).toBe("1");
    expect(baseline.node_version.length > 0).toBe(true);
    expect(baseline.hardware.cores).toBeGreaterThan(0);

    for (const run of baseline.runs) {
      expect(run.frames).toBeGreaterThan(0);
      expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
      expect(Number.isFinite(run.peak_ms_per_frame)).toBe(true);
    }
    expect(Number.isFinite(baseline.aggregate.frames_mean)).toBe(true);
    for (const metric of ["mean_ms_per_frame", "peak_ms_per_frame"] as const) {
      expect(Number.isFinite(baseline.aggregate[metric].mean)).toBe(true);
      expect(Number.isFinite(baseline.aggregate[metric].std_dev)).toBe(true);
      expect(baseline.aggregate[metric].std_dev).toBeGreaterThanOrEqual(0);
      const recomputed =
        baseline.runs.reduce((a, r) => a + r[metric], 0) / baseline.runs.length;
      expect(
        Math.abs(recomputed - baseline.aggregate[metric].mean),
      ).toBeLessThan(0.01);
    }

    expect(baseline.workload.messages).toBeGreaterThan(0);
    expect(baseline.workload.cards).toBeGreaterThan(0);
    expect(baseline.workload.transitions).toBeGreaterThan(0);
    expect(baseline.workload.long_output_lines).toBeGreaterThan(0);
    expect(baseline.methodology.length > 0).toBe(true);
  });
});
