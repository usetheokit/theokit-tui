import { Box } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { ToolResult, truncateLines } from "./tool-result.js";

const numbered = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `line-${i}`);

describe("truncateLines — pure helper (T2.1, ADR D7)", () => {
  it("helper_returns_all_lines_when_within_limit", () => {
    expect(truncateLines(["a", "b"], 10)).toEqual({
      visible: ["a", "b"],
      hidden: 0,
    });
  });

  it("helper_exact_fit_has_no_hidden", () => {
    const result = truncateLines(numbered(10), 10);
    expect(result.hidden).toBe(0);
    expect(result.visible).toHaveLength(10);
  });

  it("helper_one_over_keeps_tail", () => {
    const result = truncateLines(numbered(11), 10);
    expect(result.visible).toHaveLength(9);
    expect(result.hidden).toBe(2);
    expect(result.visible[0]).toBe("line-2");
  });

  it("helper_max_lines_one_keeps_indicator_only", () => {
    // EC-1: naive slice(-(1-1)) = slice(-0) would return ALL lines.
    expect(truncateLines(numbered(5), 1)).toEqual({ visible: [], hidden: 5 });
  });

  it("helper_rejects_zero_max_lines", () => {
    // EC-1 negative lens: fail-fast typed error, no magic clamping.
    const call = () => truncateLines(["a"], 0);
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      "truncateLines: maxLines must be an integer >= 1 — got 0",
    );
  });

  it("helper_rejects_negative_max_lines", () => {
    expect(() => truncateLines(["a"], -2)).toThrow(TypeError);
  });

  it("helper_rejects_non_integer_max_lines", () => {
    expect(() => truncateLines(["a"], 2.5)).toThrow(TypeError);
  });

  it("helper_counts_blank_lines", () => {
    // EC-11: blank "" lines are valid content — they count and render.
    expect(truncateLines(["a", "", "b"], 2)).toEqual({
      visible: ["b"],
      hidden: 2,
    });
  });
});

describe("ToolResult — plain content (T2.1)", () => {
  it("renders_tail_with_hidden_indicator", async () => {
    const frame = await renderFrame(
      <ToolResult lines={numbered(20)} maxLines={10} />,
    );
    expect(frame).not.toContain("line-0");
    expect(frame).toContain("line-19");
    expect(frame).toContain("… +11 lines hidden");
  });

  it("expanded_renders_everything", async () => {
    const frame = await renderFrame(
      <ToolResult lines={numbered(20)} maxLines={10} expanded />,
    );
    expect(frame).toContain("line-0");
    expect(frame).not.toContain("hidden");
  });

  it("exact_fit_renders_without_indicator", async () => {
    const frame = await renderFrame(
      <ToolResult lines={numbered(10)} maxLines={10} />,
    );
    expect(frame).not.toContain("hidden");
  });

  it("char_cap_fires_on_pathological_input", async () => {
    const frame = await renderFrame(<ToolResult lines={["y".repeat(30000)]} />);
    expect(frame).toContain("output capped at 20000 chars");
  });

  it("cap_does_not_fire_at_exactly_20000_chars", async () => {
    // EC-5: boundary is > 20000 — exactly 20000 passes untouched.
    const frame = await renderFrame(
      <ToolResult lines={["y".repeat(20000)]} expanded />,
    );
    expect(frame).not.toContain("capped");
  });

  it("expanded_does_not_bypass_char_cap", async () => {
    // EC-5: the 20k cap is an input guard, not display truncation.
    const frame = await renderFrame(
      <ToolResult lines={["y".repeat(30000)]} expanded />,
    );
    expect(frame).toContain("output capped at 20000 chars");
  });

  it("crlf_content_splits_without_stray_carriage_returns", async () => {
    // EC-6: Windows-spawned tool output must not leak \r into frames.
    const frame = await renderFrame(<ToolResult>{"a\r\nb"}</ToolResult>);
    expect(frame).not.toContain("\r");
    expect(frame).toContain("a");
    expect(frame).toContain("b");
  });

  it("conflicting_content_sources_throw_typed_error", () => {
    // EC-2: content sources are mutually exclusive.
    const call = () => ToolResult({ lines: ["a"], children: "b" });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      "ToolResult: provide exactly one of children | lines | shell",
    );
  });

  it("no_content_source_renders_nothing", async () => {
    // EC-2: zero sources is legal — renders nothing.
    const frame = await renderFrame(<ToolResult />);
    expect(frame).toBe("");
  });

  it("render_max_lines_one_shows_indicator_only", async () => {
    // EC-1 at the RENDER layer: visible=[] must not resurrect all rows
    // (slice(-0) hazard lives in the render path too).
    const frame = await renderFrame(
      <ToolResult lines={numbered(5)} maxLines={1} />,
    );
    expect(frame).toContain("… +5 lines hidden");
    expect(frame).not.toContain("line-0");
    expect(frame).not.toContain("line-4");
  });

  it("result_frame_matches_snapshot", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <ToolResult lines={numbered(15)} maxLines={5} />
      </Box>,
    );
    expect(frame).toMatchSnapshot("tool-result-truncated");
  });
});
