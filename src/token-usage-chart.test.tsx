import { describe, expect, it } from "vitest";

import { TokenUsageChart } from "./token-usage-chart.js";
import { renderFrame } from "../tests/helpers.js";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001B\[[0-9;]*m/g;
const stripAnsi = (value: string): string => value.replace(ANSI_RE, "");

const count = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

// T2.2 (plan m5-metrics-surface, ADRs D2/D8): per-category comparison bars.
describe("TokenUsageChart", () => {
  it("renders_categories_in_fixed_order", async () => {
    const frame = await renderFrame(
      <TokenUsageChart usage={{ reasoning: 100, input: 1000, output: 500 }} />,
    );
    const rows = stripAnsi(frame).split("\n");
    expect(rows[0]).toMatch(/^input/);
    expect(rows[1]).toMatch(/^output/);
    expect(rows[2]).toMatch(/^reasoning/);
    expect(stripAnsi(frame)).not.toContain("cached");
  });

  it("largest_category_shows_full_bar", async () => {
    // Label col 6 ("output") + value col 3 ("500") + 2 spacers → width 21
    // leaves EXACTLY 10 bar cells (D8 relative scaling at a pinned width).
    const frame = await renderFrame(
      <TokenUsageChart usage={{ input: 1000, output: 500 }} width={21} />,
    );
    const rows = stripAnsi(frame).split("\n");
    expect(count(rows[0] ?? "", "█")).toBe(10);
    expect(count(rows[0] ?? "", "░")).toBe(0);
    expect(count(rows[1] ?? "", "█")).toBe(5);
    expect(count(rows[1] ?? "", "░")).toBe(5);
  });

  it("values_render_k_m_formatted", async () => {
    const frame = await renderFrame(
      <TokenUsageChart usage={{ input: 12_500 }} />,
    );
    expect(stripAnsi(frame)).toContain("12.5k");
  });

  it("present_zero_renders_empty_bar_and_zero", async () => {
    const frame = await renderFrame(
      <TokenUsageChart usage={{ input: 1000, cached: 0 }} />,
    );
    const rows = stripAnsi(frame).split("\n");
    const cachedRow = rows.find((r) => r.startsWith("cached")) ?? "";
    expect(count(cachedRow, "█")).toBe(0);
    expect(cachedRow).toMatch(/\b0$/);
  });

  it("all_present_zero_renders_zero_rows_without_throw", async () => {
    // EC-3: max === 0 → 0/0 would be NaN; the special case renders empty bars.
    const frame = await renderFrame(
      <TokenUsageChart usage={{ input: 0, output: 0 }} />,
    );
    const rows = stripAnsi(frame).split("\n");
    expect(rows).toHaveLength(2);
    expect(count(stripAnsi(frame), "█")).toBe(0);
  });

  it("tiny_category_next_to_huge_keeps_one_cell", async () => {
    // EC-8: the core's endpoint guard must be reached unmangled.
    const frame = await renderFrame(
      <TokenUsageChart usage={{ input: 1, output: 1_000_000 }} />,
    );
    const rows = stripAnsi(frame).split("\n");
    const inputRow = rows.find((r) => r.startsWith("input")) ?? "";
    expect(count(inputRow, "█")).toBeGreaterThanOrEqual(1);
  });

  it("single_category_renders_full_bar", async () => {
    // D8: bars scale to the LARGEST category — alone, it is the largest.
    // Literal fill-count at a pinned width (review tests-1): label "input"
    // (5) + value "500" (3) + 2 spacers → width 20 leaves EXACTLY 10 cells.
    const frame = await renderFrame(
      <TokenUsageChart usage={{ input: 500 }} width={20} />,
    );
    const plain = stripAnsi(frame);
    expect(count(plain, "█")).toBe(10);
    expect(count(plain, "░")).toBe(0);
  });

  it("all_absent_renders_nothing", async () => {
    expect(await renderFrame(<TokenUsageChart usage={{}} />)).toBe("");
  });

  it("rows_align_on_shared_label_column", async () => {
    const frame = await renderFrame(
      <TokenUsageChart usage={{ input: 1, reasoning: 1 }} />,
    );
    const rows = stripAnsi(frame).split("\n");
    expect(rows[0]?.indexOf("█")).toBe(rows[1]?.indexOf("█"));
  });

  it("width_matrix_lines_fit", async () => {
    for (const w of [60, 30, 20]) {
      const frame = await renderFrame(
        <TokenUsageChart
          usage={{ input: 12_500, output: 4_000, cached: 800 }}
          width={w}
        />,
      );
      for (const row of stripAnsi(frame).split("\n")) {
        expect(row.length, `width ${w}`).toBeLessThanOrEqual(w);
      }
    }
  });

  it("narrow_width_drops_bars_keeps_values", async () => {
    // Label-only degrade boundary (D4): bar cells < 3 → label + value only.
    const frame = await renderFrame(
      <TokenUsageChart usage={{ input: 12_500 }} width={14} />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("12.5k");
    expect(plain).not.toContain("█");
  });

  it("snapshots_partial_full_narrow", async () => {
    const partial = await renderFrame(
      <TokenUsageChart usage={{ input: 12_500, output: 4_000 }} width={40} />,
    );
    expect(stripAnsi(partial)).toContain("input");
    expect(stripAnsi(partial)).toContain("12.5k");
    expect(count(stripAnsi(partial), "█")).toBeGreaterThanOrEqual(1);
    expect(partial).toMatchSnapshot("token-usage-chart-partial");

    const full = await renderFrame(
      <TokenUsageChart
        usage={{ input: 12_500, output: 4_000, cached: 800, reasoning: 2_000 }}
        width={40}
      />,
    );
    expect(stripAnsi(full)).toContain("reasoning");
    expect(stripAnsi(full)).toContain("800");
    expect(full).toMatchSnapshot("token-usage-chart-full");

    const narrow = await renderFrame(
      <TokenUsageChart usage={{ input: 12_500, output: 4_000 }} width={20} />,
    );
    expect(stripAnsi(narrow)).toContain("12.5k");
    expect(narrow).toMatchSnapshot("token-usage-chart-narrow");
  });

  it("invalid_category_value_throws_typed", () => {
    expect(() => TokenUsageChart({ usage: { input: -5 } })).toThrow(TypeError);
    expect(() => TokenUsageChart({ usage: { input: -5 } })).toThrow(
      "TokenUsageChart: usage.input must be a finite number >= 0",
    );
    expect(() => TokenUsageChart({ usage: { output: Number.NaN } })).toThrow(
      TypeError,
    );
    expect(() => TokenUsageChart({ usage: { input: 1 }, width: 1.5 })).toThrow(
      TypeError,
    );
  });
});
