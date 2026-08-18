import { describe, expect, it } from "vitest";

import { formatCost, formatTokens } from "./format.js";

// T1.2 (plan m5-metrics-surface, ADR D3): deterministic hand-rolled formatters.
// Rows verified float-safe at plan time (edge-case review CONSIDERED-OK notes).
describe("formatTokens", () => {
  it("format_tokens_boundary_table", () => {
    const rows: [number, string][] = [
      [0, "0"],
      [999, "999"],
      [1000, "1k"],
      [1049, "1k"],
      [1050, "1.1k"],
      [9999, "10k"],
      [999_949, "999.9k"],
      [999_950, "1m"], // boundary promotion — the codex "1000K" anomaly, fixed
      [1_050_000, "1.1m"],
      [1_500_000_000, "1.5b"],
      [999_950_000_000, "1000b"], // promotion saturates at the last unit (EC-10)
    ];
    for (const [input, expected] of rows) {
      expect(formatTokens(input), `input ${input}`).toBe(expected);
    }
  });

  it("format_tokens_floors_fractional_input", () => {
    const out = formatTokens(1500.9);
    expect(out).toBe("1.5k");
  });

  it("format_tokens_throws_typed_on_invalid", () => {
    for (const bad of [-1, Number.NaN, Infinity]) {
      expect(() => formatTokens(bad)).toThrow(TypeError);
    }
    expect(() => formatTokens(-1)).toThrow(
      "formatTokens: value must be a finite number >= 0",
    );
  });
});

describe("formatCost", () => {
  it("format_cost_table", () => {
    const rows: [number, string][] = [
      [0, "$0.00"],
      [1.234, "~$1.23"],
      [1.236, "~$1.24"],
      [3.05, "~$3.05"], // single-digit cents keep the leading zero (EC-9)
      [999.994, "~$999.99"],
      [999.999, "~$1,000.00"], // cent-rounding crosses the grouping boundary (tests-3)
      [1000, "~$1,000.00"],
      [1234.5, "~$1,234.50"],
      [1_234_567.891, "~$1,234,567.89"], // multi-group commas (EC-9)
    ];
    for (const [input, expected] of rows) {
      expect(formatCost(input), `input ${input}`).toBe(expected);
    }
  });

  it("format_cost_sub_cent_honesty", () => {
    // Never "$0.00" for a nonzero cost; "<" already communicates imprecision,
    // so the "~" marker is dropped on sub-cent renders (plan T1.2 Deep Dive).
    expect(formatCost(0.004)).toBe("<$0.01");
    expect(formatCost(0.0001)).toBe("<$0.01");
    expect(formatCost(0.005)).toBe("~$0.01");
  });

  it("format_cost_approx_opt_out", () => {
    expect(formatCost(1.234, { approx: false })).toBe("$1.23");
    expect(formatCost(0, { approx: false })).toBe("$0.00");
  });

  it("format_cost_zero_has_no_marker", () => {
    expect(formatCost(0)).toBe("$0.00");
  });

  it("format_cost_throws_typed_on_invalid", () => {
    for (const bad of [-0.01, Number.NaN, Infinity]) {
      expect(() => formatCost(bad)).toThrow(TypeError);
    }
    expect(() => formatCost(-0.01)).toThrow(
      "formatCost: costUsd must be a finite number >= 0",
    );
  });
});
