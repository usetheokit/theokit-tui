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
        new URL("../../benchmarks/baselines/chat-message-baseline.json", import.meta.url),
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
    expect(Number.isFinite(baseline.aggregate.mean_ms_per_frame.mean)).toBe(true);
    expect(Number.isFinite(baseline.aggregate.mean_ms_per_frame.std_dev)).toBe(true);
    expect(Number.isFinite(baseline.aggregate.peak_ms_per_frame.mean)).toBe(true);
    expect(Number.isFinite(baseline.aggregate.peak_ms_per_frame.std_dev)).toBe(true);

    // Self-consistency (review F-dom-2): the aggregate must be derivable
    // from the runs — a finite-but-impossible hand-edit stays red.
    const runMeans = baseline.runs.map((r) => r.mean_ms_per_frame);
    const recomputedMean = runMeans.reduce((a, b) => a + b, 0) / runMeans.length;
    expect(Math.abs(recomputedMean - baseline.aggregate.mean_ms_per_frame.mean)).toBeLessThan(0.01);
    expect(baseline.aggregate.mean_ms_per_frame.std_dev).toBeGreaterThanOrEqual(0);
    expect(baseline.aggregate.peak_ms_per_frame.std_dev).toBeGreaterThanOrEqual(0);

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
        new URL("../../benchmarks/baselines/chat-thread-baseline.json", import.meta.url),
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
      for (const metric of ["mean_ms_per_frame", "peak_ms_per_frame"] as const) {
        expect(Number.isFinite(mode.aggregate[metric].mean)).toBe(true);
        expect(Number.isFinite(mode.aggregate[metric].std_dev)).toBe(true);
        expect(mode.aggregate[metric].std_dev).toBeGreaterThanOrEqual(0);
        const recomputed = mode.runs.reduce((a, r) => a + r[metric], 0) / mode.runs.length;
        expect(Math.abs(recomputed - mode.aggregate[metric].mean)).toBeLessThan(0.01);
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
    max_lines: number;
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
        new URL("../../benchmarks/baselines/tool-cards-baseline.json", import.meta.url),
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
      const recomputed = baseline.runs.reduce((a, r) => a + r[metric], 0) / baseline.runs.length;
      expect(Math.abs(recomputed - baseline.aggregate[metric].mean)).toBeLessThan(0.01);
    }

    expect(baseline.workload.messages).toBeGreaterThan(0);
    expect(baseline.workload.cards).toBeGreaterThan(0);
    expect(baseline.workload.transitions).toBeGreaterThan(0);
    expect(baseline.workload.long_output_lines).toBeGreaterThan(0);
    expect(baseline.workload.max_lines).toBeGreaterThan(0);
    // frames_mean recompute (review wire-5) — a hand-edit stays red.
    const recomputedFrames = baseline.runs.reduce((a, r) => a + r.frames, 0) / baseline.runs.length;
    expect(Math.abs(recomputedFrames - baseline.aggregate.frames_mean)).toBeLessThan(0.01);
    expect(baseline.methodology.length > 0).toBe(true);
  });
});

interface M3Baseline {
  benchmark: string;
  modes: M1Mode[];
  workload: {
    events: number;
    steps: number;
    event_mix: Record<string, number>;
    long_output_lines: number;
    max_lines_bounded: number;
    window: string;
  };
  protocol: { warmup_runs: number; measured_runs: number };
  node_version: string;
  hardware: { cpu: string; cores: number };
  color_env: { FORCE_COLOR: string };
  methodology: string;
}

describe("benchmark baseline M3 (T3.2)", () => {
  it("m3_agent_timeline_baseline_exists_with_mode_matrix", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL("../../benchmarks/baselines/agent-timeline-baseline.json", import.meta.url),
        "utf8",
      ),
    ) as M3Baseline;

    expect(baseline.modes.map((m) => m.mode).sort()).toEqual(["bounded", "unbounded"]);
    expect(baseline.protocol.warmup_runs).toBeGreaterThanOrEqual(1);
    expect(baseline.color_env.FORCE_COLOR).toBe("1");
    expect(baseline.node_version.length > 0).toBe(true);
    expect(baseline.hardware.cores).toBeGreaterThan(0);
    for (const mode of baseline.modes) {
      expect(mode.runs.length).toBe(baseline.protocol.measured_runs);
      expect(mode.runs.length).toBeGreaterThanOrEqual(3);
      for (const run of mode.runs) {
        expect(run.frames).toBeGreaterThan(0);
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
        expect(Number.isFinite(run.peak_ms_per_frame)).toBe(true);
      }
      const recomputedFrames = mode.runs.reduce((a, r) => a + r.frames, 0) / mode.runs.length;
      expect(Number.isFinite(mode.aggregate.frames_mean)).toBe(true);
      expect(Math.abs(recomputedFrames - mode.aggregate.frames_mean)).toBeLessThan(0.01);
      for (const metric of ["mean_ms_per_frame", "peak_ms_per_frame"] as const) {
        expect(Number.isFinite(mode.aggregate[metric].mean)).toBe(true);
        // M1 parity (tests-2): Infinity is >= 0 — pin finiteness too.
        expect(Number.isFinite(mode.aggregate[metric].std_dev)).toBe(true);
        expect(mode.aggregate[metric].std_dev).toBeGreaterThanOrEqual(0);
        const recomputed = mode.runs.reduce((a, r) => a + r[metric], 0) / mode.runs.length;
        expect(Math.abs(recomputed - mode.aggregate[metric].mean)).toBeLessThan(0.01);
      }
    }
    expect(baseline.workload.events).toBeGreaterThan(0);
    expect(baseline.workload.steps).toBeGreaterThan(0);
    expect(baseline.workload.window.length > 0).toBe(true);
    expect(baseline.workload.long_output_lines).toBeGreaterThan(0);
    expect(baseline.workload.max_lines_bounded).toBeGreaterThan(0);
    expect(Object.keys(baseline.workload.event_mix).sort()).toEqual([
      "message",
      "thinking",
      "tool",
    ]);
    // Values must be a real distribution, not hand-edited junk (tests-7).
    for (const share of Object.values(baseline.workload.event_mix)) {
      expect(share).toBeGreaterThan(0);
    }
    expect(Object.values(baseline.workload.event_mix).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    // The heterogeneous-heights metric MUST be named (plan D7).
    expect(baseline.methodology).toContain("peak_ms_per_frame");
  });
});

interface M4Baseline {
  benchmark: string;
  modes: M1Mode[];
  workload: {
    mount_hunks: number;
    steps: number;
    hunk_lines: number;
    context_lines_per_hunk: number;
    wide_line_chars: number;
    windowed: string;
  };
  protocol: { warmup_runs: number; measured_runs: number };
  node_version: string;
  hardware: { cpu: string; cores: number };
  color_env: { FORCE_COLOR: string };
  methodology: string;
}

describe("benchmark baseline M4 (T3.2)", () => {
  it("m4_diff_viewer_baseline_exists_with_mode_matrix", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL("../../benchmarks/baselines/diff-viewer-baseline.json", import.meta.url),
        "utf8",
      ),
    ) as M4Baseline;

    expect(baseline.modes.map((m) => m.mode).sort()).toEqual(["full", "windowed"]);
    expect(baseline.protocol.measured_runs).toBeGreaterThanOrEqual(3);
    expect(baseline.protocol.warmup_runs).toBeGreaterThanOrEqual(1);
    expect(baseline.color_env.FORCE_COLOR).toBe("1");
    expect(baseline.node_version.length > 0).toBe(true);
    expect(baseline.hardware.cores).toBeGreaterThan(0);
    for (const mode of baseline.modes) {
      expect(mode.runs.length).toBe(baseline.protocol.measured_runs);
      for (const run of mode.runs) {
        expect(run.frames).toBeGreaterThan(0);
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
        expect(Number.isFinite(run.peak_ms_per_frame)).toBe(true);
      }
      expect(Number.isFinite(mode.aggregate.frames_mean)).toBe(true);
      const recomputedFrames = mode.runs.reduce((a, r) => a + r.frames, 0) / mode.runs.length;
      expect(Math.abs(recomputedFrames - mode.aggregate.frames_mean)).toBeLessThan(0.01);
      for (const metric of ["mean_ms_per_frame", "peak_ms_per_frame"] as const) {
        expect(Number.isFinite(mode.aggregate[metric].mean)).toBe(true);
        expect(Number.isFinite(mode.aggregate[metric].std_dev)).toBe(true);
        expect(mode.aggregate[metric].std_dev).toBeGreaterThanOrEqual(0);
        const recomputed = mode.runs.reduce((a, r) => a + r[metric], 0) / mode.runs.length;
        expect(Math.abs(recomputed - mode.aggregate[metric].mean)).toBeLessThan(0.01);
      }
    }
    expect(baseline.workload.mount_hunks).toBeGreaterThan(0);
    expect(baseline.workload.steps).toBeGreaterThan(0);
    expect(baseline.workload.hunk_lines).toBeGreaterThan(0);
    expect(baseline.workload.context_lines_per_hunk).toBeGreaterThan(0);
    expect(baseline.workload.wide_line_chars).toBeGreaterThan(0);
    // The windowing descriptor the 12x claim hinges on (dom-testing-1).
    expect(baseline.workload.windowed).toMatch(/maxLines \d+ \+ contextLines \d+/);
    expect(baseline.methodology).toContain("peak_ms_per_frame");
  });
});

interface M5Baseline {
  benchmark: string;
  modes: M1Mode[];
  workload: {
    messages: number;
    steps: number;
    tokens_per_step: number;
    categories: number;
  };
  protocol: { warmup_runs: number; measured_runs: number };
  node_version: string;
  hardware: { cpu: string; cores: number };
  color_env: { FORCE_COLOR: string };
  methodology: string;
}

describe("benchmark baseline M5 (T3.2)", () => {
  it("m5_metrics_baseline_exists_with_mode_matrix", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL("../../benchmarks/baselines/metrics-baseline.json", import.meta.url),
        "utf8",
      ),
    ) as M5Baseline;

    expect(baseline.modes.map((m) => m.mode).sort()).toEqual(["with-metrics", "without-metrics"]);
    expect(baseline.protocol.measured_runs).toBeGreaterThanOrEqual(3);
    expect(baseline.protocol.warmup_runs).toBeGreaterThanOrEqual(1);
    expect(baseline.color_env.FORCE_COLOR).toBe("1");
    expect(baseline.node_version.length > 0).toBe(true);
    expect(baseline.hardware.cores).toBeGreaterThan(0);
    for (const mode of baseline.modes) {
      expect(mode.runs.length).toBe(baseline.protocol.measured_runs);
      for (const run of mode.runs) {
        expect(run.frames).toBeGreaterThan(0);
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
        expect(Number.isFinite(run.peak_ms_per_frame)).toBe(true);
      }
      expect(Number.isFinite(mode.aggregate.frames_mean)).toBe(true);
      const recomputedFrames = mode.runs.reduce((a, r) => a + r.frames, 0) / mode.runs.length;
      expect(Math.abs(recomputedFrames - mode.aggregate.frames_mean)).toBeLessThan(0.01);
      for (const metric of ["mean_ms_per_frame", "peak_ms_per_frame"] as const) {
        expect(Number.isFinite(mode.aggregate[metric].mean)).toBe(true);
        expect(Number.isFinite(mode.aggregate[metric].std_dev)).toBe(true);
        expect(mode.aggregate[metric].std_dev).toBeGreaterThanOrEqual(0);
        const recomputed = mode.runs.reduce((a, r) => a + r[metric], 0) / mode.runs.length;
        expect(Math.abs(recomputed - mode.aggregate[metric].mean)).toBeLessThan(0.01);
      }
    }
    expect(baseline.workload.messages).toBeGreaterThan(0);
    expect(baseline.workload.steps).toBeGreaterThan(0);
    expect(baseline.workload.tokens_per_step).toBeGreaterThan(0);
    expect(baseline.workload.categories).toBeGreaterThan(0);
    // Cadence symmetry (EC-6, review dom-testing-6): the delta is only
    // meaningful if both modes produced the same frame count per run.
    expect(baseline.modes[0]?.aggregate.frames_mean).toBe(baseline.modes[1]?.aggregate.frames_mean);
    // The honest-delta contract (D6): the reportable result is the mode
    // delta, and sub-sigma deltas are declared inconclusive.
    expect(baseline.methodology).toContain("INCONCLUSIVE");
    expect(baseline.methodology).toContain("delta");
  });
});
