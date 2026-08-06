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
          "../benchmarks/baselines/m12-welcome-banner-baseline.json",
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
          "../benchmarks/baselines/m0-chat-message-baseline.json",
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

// M14 T2.2: the AppStatusBar OWN bench (ticking = the 1 Hz hook path under
// real timers; static = rerender loop with the bar present).
describe("benchmark baseline M14 (T2.2)", () => {
  it("m14_status_bar_baseline_contract", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../benchmarks/baselines/m14-status-bar-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      stack: { ink: string };
      load_1min_at_start: number;
      ticking_wall_ms: { mean: number };
      modes: {
        mode: string;
        runs: { mean_ms_per_frame: number }[];
        aggregate: { mean_ms_per_frame: { mean: number; std_dev: number } };
      }[];
    };
    expect(baseline.stack.ink).toBe("7.1.0");
    const modeNames = baseline.modes.map((m) => m.mode);
    expect(modeNames).toEqual(expect.arrayContaining(["ticking", "static"]));
    expect(baseline.load_1min_at_start).toBeLessThan(4);
    // 10 real 1 s ticks: wall between 9 and 12 s (plan T2.2 AC).
    expect(baseline.ticking_wall_ms.mean).toBeGreaterThan(9000);
    expect(baseline.ticking_wall_ms.mean).toBeLessThan(12000);
    for (const mode of baseline.modes) {
      for (const run of mode.runs) {
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
      }
    }
  });
});

// M15 T3.1: the composer typing bench (menu vs plain keystroke modes).
describe("benchmark baseline M15 (T3.1)", () => {
  it("m15_composer_baseline_contract", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../benchmarks/baselines/m15-composer-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      stack: { ink: string };
      load_1min_at_start: number;
      modes: {
        mode: string;
        runs: { mean_ms_per_frame: number }[];
        aggregate: { mean_ms_per_frame: { mean: number; std_dev: number } };
      }[];
    };
    expect(baseline.stack.ink).toBe("7.1.0");
    const modeNames = baseline.modes.map((m) => m.mode);
    expect(modeNames).toEqual(expect.arrayContaining(["menu", "plain"]));
    expect(baseline.load_1min_at_start).toBeLessThan(4);
    for (const mode of baseline.modes) {
      for (const run of mode.runs) {
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
      }
      expect(Number.isFinite(mode.aggregate.mean_ms_per_frame.mean)).toBe(true);
    }
  });
});

// M17 T3.1 (plan m17-renderer-skeleton, ADR D4): the OWN renderer bench — the
// FIRST dual-engine baseline with a BYTES-written axis (EC-5: the diff win IS
// bytes, not just ms). Two modes: `ink` (full-frame log-update) vs `own` (the
// differential engine). Both drive a byte-counting sink over the same
// 200-line append+update scene.
describe("benchmark baseline M17 (T3.1)", () => {
  it("m17_renderer_baseline_contract", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../benchmarks/baselines/m17-renderer-skeleton-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      load_1min_at_start: number;
      modes: {
        mode: string;
        bytes_written: number;
        aggregate: { mean_ms_per_frame: { mean: number; std_dev: number } };
      }[];
    };
    const modeNames = baseline.modes.map((m) => m.mode);
    expect(modeNames).toEqual(expect.arrayContaining(["ink", "own"]));
    expect(baseline.load_1min_at_start).toBeLessThan(4);
    for (const mode of baseline.modes) {
      expect(Number.isFinite(mode.bytes_written)).toBe(true);
      expect(mode.bytes_written).toBeGreaterThan(0);
      expect(Number.isFinite(mode.aggregate.mean_ms_per_frame.mean)).toBe(true);
    }
  });

  it("renderer_subpath_export_resolves", async () => {
    // The renderer is reachable AND the package.json export map declares the
    // ./renderer subpath (the real deliverable — root entry stays clean).
    const mod = await import("../src/renderer/index.js");
    expect(typeof mod.createRenderer).toBe("function");
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { exports: Record<string, unknown> };
    expect(pkg.exports["./renderer"]).toBeDefined();
  });
});

// M18 T3.1 (plan m18-yoga-layout, ADR D4): the layout+render bench vs Ink on
// the thread workload — the committed baseline is the milestone's runtime
// evidence.
describe("benchmark baseline M18 (T3.1)", () => {
  it("m18_layout_baseline_contract", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../benchmarks/baselines/m18-renderer-layout-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      load_1min_at_start: number;
      modes: {
        mode: string;
        aggregate: { mean_ms_per_frame: { mean: number; std_dev: number } };
      }[];
    };
    const modeNames = baseline.modes.map((m) => m.mode);
    expect(modeNames).toEqual(expect.arrayContaining(["own", "ink"]));
    expect(baseline.load_1min_at_start).toBeLessThan(4);
    for (const mode of baseline.modes) {
      expect(Number.isFinite(mode.aggregate.mean_ms_per_frame.mean)).toBe(true);
      expect(mode.aggregate.mean_ms_per_frame.mean).toBeGreaterThan(0);
    }
  });
});

// M20 T3.1 (plan m20-scrollback-cutover, ADR D5): the comparative cutover
// baseline — BOTH engines on the same streaming ChatThread, on ms/frame AND
// bytes_written axes. bytes_written is the differential engine's headline
// (Ink's log-update rewrites the frame region; our engine rewrites only changed
// rows). The committed baseline is the cutover ADR's runtime evidence.
describe("benchmark baseline M20 (T3.1)", () => {
  it("m20_comparative_baseline_contract", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../benchmarks/baselines/m20-comparative-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      load_1min_at_start: number;
      modes: {
        mode: string;
        runs: { mean_ms_per_frame: number; bytes_written: number }[];
        aggregate: {
          mean_ms_per_frame: { mean: number; std_dev: number };
          bytes_written: { mean: number; std_dev: number };
        };
      }[];
    };
    const modeNames = baseline.modes.map((m) => m.mode);
    expect(modeNames).toEqual(expect.arrayContaining(["v4", "ink"]));
    expect(baseline.load_1min_at_start).toBeLessThan(4);
    for (const mode of baseline.modes) {
      for (const run of mode.runs) {
        expect(Number.isFinite(run.mean_ms_per_frame)).toBe(true);
        expect(Number.isFinite(run.bytes_written)).toBe(true);
      }
      expect(Number.isFinite(mode.aggregate.mean_ms_per_frame.mean)).toBe(true);
      expect(mode.aggregate.mean_ms_per_frame.mean).toBeGreaterThan(0);
      expect(Number.isFinite(mode.aggregate.bytes_written.mean)).toBe(true);
      expect(mode.aggregate.bytes_written.mean).toBeGreaterThan(0);
    }
    // The differential engine writes materially fewer bytes than Ink's
    // log-update on the streaming workload (the cutover's headline advantage).
    const v4 = baseline.modes.find((m) => m.mode === "v4")!;
    const ink = baseline.modes.find((m) => m.mode === "ink")!;
    expect(v4.aggregate.bytes_written.mean).toBeLessThan(
      ink.aggregate.bytes_written.mean,
    );
  });
});

// M21 T3.1: the OWN editor-path bench — the pure editor reducer per keystroke.
describe("benchmark baseline M21 editor (T3.1)", () => {
  it("m21_editor_baseline_contract", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../benchmarks/baselines/m21-editor-baseline.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      load_1min_at_start: number;
      workload: { keystrokes: number };
      runs: { us_per_op: number }[];
      aggregate: { us_per_op: { mean: number; std_dev: number } };
    };
    expect(baseline.load_1min_at_start).toBeLessThan(4);
    expect(baseline.workload.keystrokes).toBeGreaterThan(0);
    for (const run of baseline.runs) {
      expect(Number.isFinite(run.us_per_op)).toBe(true);
    }
    expect(Number.isFinite(baseline.aggregate.us_per_op.mean)).toBe(true);
    expect(baseline.aggregate.us_per_op.mean).toBeGreaterThan(0);
  });
});
