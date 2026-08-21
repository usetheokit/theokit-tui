import { describe, expect, it } from "vitest";

import type { RendererNode } from "./host-config.js";
import { measureText, measureTextNode, squashTextNodes, wrapText } from "./text-measure.js";

// M18 T2.1 (plan m18-yoga-layout, ADR D3): the text measure func + wrap — Ink's
// measure-text.js / wrap-text.js / squash-text-nodes.js ported over the SAME
// libs Ink uses (widest-line, wrap-ansi, cli-truncate, string-width).

function textNode(value: string): RendererNode {
  return { type: "#text", props: {}, children: [], text: value };
}

function inkText(children: RendererNode[], props: Record<string, unknown> = {}): RendererNode {
  return { type: "ink-text", props, children };
}

describe("text-measure (M18 T2.1)", () => {
  it("measure_text_returns_widest_line_and_height", () => {
    expect(measureText("ab\ncde")).toEqual({ width: 3, height: 2 });
  });

  it("measure_text_empty_is_zero", () => {
    expect(measureText("")).toEqual({ width: 0, height: 0 });
  });

  it("measure_text_cjk_wide_char_counts_two", () => {
    expect(measureText("你好").width).toBe(4);
  });

  it("measure_text_filled_circle_glyph_counts_one_matching_ink", () => {
    // #40: ⏺ (U+23FA) is a NARROW glyph — Ink (string-width ^8.2.0) measures it
    // as width 1. The renderer's measurement must agree, or the assistant/tool
    // bullet over-counts by a cell and every following character misaligns
    // against the `> ` / `· ` prefixes. (string-width 7.x wrongly returned 2.)
    expect(measureText("⏺").width).toBe(1);
  });

  it("squash_concatenates_children", () => {
    const node = inkText([textNode("hello "), textNode("world")]);
    expect(squashTextNodes(node)).toBe("hello world");
  });

  it("squash_applies_internal_transform_to_nested_text", () => {
    const upper = (s: string): string => s.toUpperCase();
    const node = inkText([textNode("a"), inkText([textNode("b")], { internal_transform: upper })]);
    expect(squashTextNodes(node)).toBe("aB");
  });

  it("wrap_text_wrap_mode_breaks_long_line", () => {
    const wrapped = wrapText("hello world", 5, "wrap");
    expect(wrapped.split("\n").length).toBeGreaterThan(1);
    for (const line of wrapped.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(5);
    }
  });

  it("wrap_text_truncate_end_and_start", () => {
    expect(wrapText("hello world", 5, "truncate-end")).toBe("hell…");
    expect(wrapText("hello world", 5, "truncate-start")).toBe("…orld");
  });

  it("wrap_text_hard_and_middle_and_passthrough_modes", () => {
    // hard mode breaks mid-word; truncate-middle keeps both ends; an unknown
    // wrap type returns the text unchanged (Ink's fall-through).
    const hard = wrapText("abcdefghij", 4, "hard");
    expect(hard.split("\n")[0]!.length).toBeLessThanOrEqual(4);
    expect(wrapText("hello world", 7, "truncate-middle")).toContain("…");
    expect(wrapText("unchanged", 3, "nowrap")).toBe("unchanged");
  });

  it("measure_text_node_wraps_when_over_container_width", () => {
    const node = inkText([textNode("hello world")], {
      style: { textWrap: "wrap" },
    });
    const dims = measureTextNode(node, 5);
    expect(dims.width).toBeLessThanOrEqual(5);
    expect(dims.height).toBeGreaterThan(1);
  });

  it("measure_text_node_fits_returns_intrinsic", () => {
    const node = inkText([textNode("hi")]);
    expect(measureTextNode(node, 40)).toEqual({ width: 2, height: 1 });
  });

  it("measure_text_node_sub_cell_guard_returns_intrinsic", () => {
    // Yoga probes a <1px shrink — we must return the intrinsic size (Ink dom.js:100).
    const node = inkText([textNode("hello")]);
    expect(measureTextNode(node, 0.5)).toEqual({ width: 5, height: 1 });
  });
});
