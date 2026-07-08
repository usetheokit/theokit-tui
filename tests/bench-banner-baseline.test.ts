import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface ModeEntry {
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

interface BannerBaseline {
  benchmark: string;
  stack: { ink: string; react: string; ink_testing_library: string };
  color_env: { FORCE_COLOR: string };
  protocol: { warmup_runs: number; measured_runs: number };
  reveal_wall_ms: { mean: number; std_dev: number };
  modes: ModeEntry[];
  methodology: string;
}

// M12 T2.2 (plan ADR D3): the OWN-bench contract — the recorded M9 flip
// condition fired (the reveal IS a per-frame path), so the committed
// baseline is the milestone's runtime-evidence artifact. Split from
// tests/bench-baseline.test.ts for the 500-line file budget (M10
// provenance-suite precedent).
describe("benchmark baseline M12 (T2.2)", () => {
  it("m12_banner_baseline_contract", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../docs/benchmarks/m12-welcome-banner-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as BannerBaseline;

    expect(baseline.stack.ink).toBe("7.1.0");
    expect(baseline.color_env.FORCE_COLOR).toBe("1");
    const modeNames = baseline.modes.map((m) => m.mode);
    expect(modeNames).toEqual(expect.arrayContaining(["reveal", "static"]));
    expect(baseline.protocol.measured_runs).toBeGreaterThanOrEqual(3);

    for (const mode of baseline.modes) {
      expect(mode.runs.length).toBe(baseline.protocol.measured_runs);
      for (const run of mode.runs) {
        expect(run.frames).toBeGreaterThan(0);
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
        expect(Number.isFinite(run.peak_ms_per_frame)).toBe(true);
      }
      expect(Number.isFinite(mode.aggregate.mean_ms_per_frame.mean)).toBe(true);
      expect(Number.isFinite(mode.aggregate.mean_ms_per_frame.std_dev)).toBe(
        true,
      );
    }

    // DoD: the reveal completes in < 2 s — measured, not assumed.
    expect(Number.isFinite(baseline.reveal_wall_ms.mean)).toBe(true);
    expect(baseline.reveal_wall_ms.mean).toBeLessThan(2000);
    expect(baseline.methodology).toMatch(/real timers/i);
  });
});

// M13 T3.1: the chat-message baseline gained a modes[] axis (plain +
// markdown) while keeping the legacy top-level runs/aggregate = plain
// (contract compatibility). Lives here for the 500-line budget of
// tests/bench-baseline.test.ts.
describe("benchmark baseline M13 (T3.1)", () => {
  it("m13_chat_message_markdown_mode_contract", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../docs/benchmarks/m0-chat-message-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      load_1min_at_start: number;
      runs: unknown[];
      modes: {
        mode: string;
        runs: { mean_ms_per_frame: number }[];
        aggregate: { mean_ms_per_frame: { mean: number; std_dev: number } };
      }[];
    };
    const modeNames = baseline.modes.map((m) => m.mode);
    expect(modeNames).toEqual(expect.arrayContaining(["plain", "markdown"]));
    expect(Number.isFinite(baseline.load_1min_at_start)).toBe(true);
    expect(baseline.load_1min_at_start).toBeLessThan(4);
    for (const mode of baseline.modes) {
      for (const run of mode.runs) {
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
      }
      expect(Number.isFinite(mode.aggregate.mean_ms_per_frame.mean)).toBe(true);
    }
    // Legacy top-level shape survives (the pre-M13 contract reads it).
    expect(baseline.runs.length).toBeGreaterThan(0);
  });
});
