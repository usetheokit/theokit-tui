import { describe, expect, it } from "vitest";

import { displayPercent, formatPercent, renderFillBar } from "./fill-bar.js";

// T1.1 (plan m5-metrics-surface, ADRs D1/D3/D7): the single rounding authority.
// Every row below is a pinned oracle — rounding regressions must fail with a
// readable diff, never be absorbed by a snapshot.
describe("formatPercent", () => {
  it("format_percent_endpoint_table", () => {
    const rows: [number, string][] = [
      [-0.5, "0%"],
      [0, "0%"],
      [0.004, "1%"],
      [0.42, "42%"],
      [0.5, "50%"],
      [0.995, "99%"],
      [0.996, "99%"],
      [1, "100%"],
      [1.3, "100%"],
    ];
    for (const [ratio, expected] of rows) {
      expect(formatPercent(ratio), `ratio ${ratio}`).toBe(expected);
    }
  });

  it("format_percent_throws_on_non_finite", () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(() => formatPercent(bad)).toThrow(TypeError);
    }
  });
});

describe("renderFillBar", () => {
  it("fill_bar_counts_at_width_10", () => {
    const rows: [number, number][] = [
      [0, 0],
      [0.004, 1],
      [0.5, 5],
      [0.996, 9],
      [1, 10],
    ];
    for (const [ratio, cells] of rows) {
      const seg = renderFillBar(ratio, 10);
      expect(seg.filledCells, `ratio ${ratio}`).toBe(cells);
      expect(seg.filled).toBe("█".repeat(cells));
      expect(seg.empty).toBe("░".repeat(10 - cells));
      expect(seg.width).toBe(10);
    }
  });

  it("fill_never_full_until_truly_full", () => {
    expect(renderFillBar(0.999, 10).filledCells).toBe(9);
    expect(renderFillBar(1, 10).filledCells).toBe(10);
  });

  it("fill_never_empty_when_nonzero", () => {
    expect(renderFillBar(0.001, 10).filledCells).toBe(1);
    expect(renderFillBar(0, 10).filledCells).toBe(0);
  });

  it("label_and_bar_agree_at_edges", () => {
    // EC-1: label and bar consume ONE clamped display percent — they can never
    // split on the 0.4% / 99.6% edges.
    for (const ratio of [0.004, 0.42, 0.996]) {
      const label = formatPercent(ratio);
      const cells = renderFillBar(ratio, 10).filledCells;
      expect(label === "0%", `ratio ${ratio} empty-agreement`).toBe(cells === 0);
      expect(label === "100%", `ratio ${ratio} full-agreement`).toBe(cells === 10);
    }
  });

  it("ratio_clamps_out_of_range", () => {
    expect(renderFillBar(-2, 10).filledCells).toBe(0);
    expect(renderFillBar(7, 10).filledCells).toBe(10);
  });

  it("width_zero_and_negative_render_empty_segments", () => {
    for (const w of [0, -5]) {
      const seg = renderFillBar(0.5, w);
      expect(seg.filled).toBe("");
      expect(seg.empty).toBe("");
      expect(seg.width).toBe(0);
      expect(seg.filledCells).toBe(0);
    }
  });

  it("fractional_width_floors", () => {
    expect(renderFillBar(0.5, 10.9).width).toBe(10);
  });

  it("custom_glyphs_render", () => {
    const seg = renderFillBar(0.5, 4, { fullChar: "▌", emptyChar: "·" });
    expect(seg.filled).toBe("▌▌");
    expect(seg.empty).toBe("··");
  });

  it("ceil_rounding_shows_cell_for_tiny_ratio", () => {
    expect(renderFillBar(0.42, 10, { rounding: "ceil" }).filledCells).toBe(5);
    expect(renderFillBar(0.48, 10, { rounding: "floor" }).filledCells).toBe(4);
  });

  it("fill_cells_integer_numerator_at_wide_widths", () => {
    // EC-2: displayPercent/100 * width has verified float divergences
    // (7/100*100 === 7.000000000000001 → ceil 8); (p * w) / 100 keeps the
    // .0/.5 boundaries exactly representable.
    expect(renderFillBar(0.07, 100, { rounding: "ceil" }).filledCells).toBe(7);
    expect(renderFillBar(0.29, 50).filledCells).toBe(15);
  });

  it("glyph_options_reject_non_single_char", () => {
    // EC-4: multi-char / surrogate glyphs break the cells⇔columns invariant.
    for (const bad of ["", "ab", "🟩"]) {
      expect(() => renderFillBar(0.5, 10, { fullChar: bad })).toThrow(TypeError);
      expect(() => renderFillBar(0.5, 10, { emptyChar: bad })).toThrow(TypeError);
    }
    expect(() => renderFillBar(0.5, 10, { fullChar: "ab" })).toThrow("must be a single character");
  });

  it("fill_bar_throws_on_non_finite_ratio", () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(() => renderFillBar(bad, 10)).toThrow(TypeError);
    }
    expect(() => renderFillBar(Number.NaN, 10)).toThrow(
      "renderFillBar: ratio must be a finite number",
    );
  });
});

describe("displayPercent", () => {
  it("display_percent_is_the_left_derivation_seam", () => {
    // D7: ContextWindowBar derives 'left' as 100 − displayPercent(usedRatio)
    // — pinned here so the seam stays exported and integer-valued.
    expect(displayPercent(0.335)).toBe(34);
    expect(100 - displayPercent(0.335)).toBe(66);
    expect(displayPercent(5e-17)).toBe(1);
  });
});
