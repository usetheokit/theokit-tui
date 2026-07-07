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
    expect(() => truncateLines(["a"], -2)).toThrow("got -2");
  });

  it("helper_rejects_non_integer_max_lines", () => {
    expect(() => truncateLines(["a"], 2.5)).toThrow(TypeError);
    expect(() => truncateLines(["a"], 2.5)).toThrow("got 2.5");
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
    expect(frame).toContain("line-9"); // presence pairing (review tests-4)
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
    expect(frame).toContain("y"); // presence pairing (review tests-5)
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
    // EC-2: content sources are mutually exclusive. Direct function call
    // works ONLY because resolveContent precedes useTheoTheme (F10) — if the
    // hook moves first, switch these to renderFrame rejection asserts.
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

  it("expanded_still_rejects_invalid_max_lines", () => {
    // SEPA phase-2 F3: prop validity must not depend on `expanded`. Direct
    // call — Ink's error boundary swallows render-time throws (F10 note).
    const call = () =>
      ToolResult({ lines: ["a"], maxLines: 0, expanded: true });
    expect(call).toThrow(TypeError);
    expect(call).toThrow("maxLines must be an integer >= 1");
  });

  it("blank_line_occupies_a_row", async () => {
    // EC-11 render half (SEPA phase-2 F7): blank lines keep their row.
    const frame = await renderFrame(
      <ToolResult lines={["a", "", "b"]} expanded />,
    );
    expect(frame.split("\n")).toHaveLength(3);
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

describe("ToolResult — shell envelope (T2.2, ADR D5)", () => {
  it("shell_renders_stdout_plain", async () => {
    const frame = await renderFrame(
      <ToolResult shell={{ stdout: "total 42", stderr: "", exitCode: 0 }} />,
    );
    expect(frame).toContain("total 42");
  });

  it("shell_labels_stderr_block", async () => {
    const frame = await renderFrame(
      <ToolResult
        shell={{ stdout: "ok", stderr: "permission denied", exitCode: 0 }}
      />,
    );
    expect(frame).toContain("stderr:");
    expect(frame).toContain("permission denied");
  });

  it("nonzero_exit_renders_badge", async () => {
    const frame = await renderFrame(
      <ToolResult shell={{ stdout: "", stderr: "boom", exitCode: 2 }} />,
    );
    expect(frame).toContain("exited 2");
  });

  it("zero_exit_renders_no_badge", async () => {
    const frame = await renderFrame(
      <ToolResult shell={{ stdout: "done", stderr: "", exitCode: 0 }} />,
    );
    // Presence pairing (SEPA phase-2 F4): the absence oracle alone would
    // pass on an empty render.
    expect(frame).toContain("done");
    expect(frame).not.toContain("exited");
  });

  it("empty_streams_render_placeholder", async () => {
    const frame = await renderFrame(
      <ToolResult shell={{ stdout: "", stderr: "", exitCode: 0 }} />,
    );
    expect(frame).toContain("(no output)");
  });

  it("shell_truncation_covers_combined_streams", async () => {
    const stdout = numbered(30).join("\n");
    const stderr = ["e-0", "e-1", "e-2", "e-3", "e-4"].join("\n");
    const frame = await renderFrame(
      <ToolResult shell={{ stdout, stderr, exitCode: 1 }} maxLines={10} />,
    );
    // Pin the combined math (SEPA phase-2 F5): 30 stdout + 1 label + 5
    // stderr = 36 rows; maxLines 10 keeps 9 → hidden 27.
    expect(frame).toContain("… +27 lines hidden");
    expect(frame).toContain("e-4");
    expect(frame).not.toContain("line-0");
    // Badge survives truncation (appended AFTER the line budget).
    expect(frame).toContain("exited 1");
  });

  it("shell_without_exit_code_renders_no_badge", async () => {
    // EC-3: a mid-stream envelope must NOT render "exited undefined".
    const frame = await renderFrame(
      <ToolResult shell={{ stdout: "x-stream", stderr: "" }} />,
    );
    expect(frame).toContain("x-stream"); // presence pairing (F4)
    expect(frame).not.toContain("exited");
  });

  it("exit_code_renders_verbatim", async () => {
    // EC-12: signals/negative values pass through, no mapping.
    const frame = await renderFrame(
      <ToolResult shell={{ stdout: "", stderr: "killed", exitCode: 137 }} />,
    );
    expect(frame).toContain("exited 137");
    const negative = await renderFrame(
      <ToolResult shell={{ stdout: "", stderr: "killed", exitCode: -1 }} />,
    );
    expect(negative).toContain("exited -1");
  });

  it("trailing_newline_does_not_add_blank_line", async () => {
    // EC-7: "one\ntwo\n" is 2 lines — no phantom row before the badge.
    const frame = await renderFrame(
      <ToolResult shell={{ stdout: "one\ntwo\n", stderr: "", exitCode: 2 }} />,
    );
    const rows = frame.split("\n");
    const badgeIndex = rows.findIndex((row) => row.includes("exited 2"));
    expect(badgeIndex).toBeGreaterThan(0);
    expect(rows[badgeIndex - 1]).toContain("two");
  });

  it("truncation_past_stderr_label_keeps_pinned_label", async () => {
    // DV-3 resolved (review dom-frontend-1): when the budget cuts INTO the
    // stderr block, the label re-renders PINNED outside the budget (like the
    // exit badge) so EC-13's color-independent marker survives NO_COLOR.
    const stdout = numbered(30).join("\n");
    const stderr = ["e-0", "e-1", "e-2", "e-3", "e-4"].join("\n");
    const frame = await renderFrame(
      <ToolResult shell={{ stdout, stderr, exitCode: 0 }} maxLines={3} />,
    );
    expect(frame).toContain("e-4");
    expect(frame).toContain("stderr:");
    expect(frame).toContain("… +34 lines hidden");
    // The pinned label precedes the visible tail rows.
    const rows = frame.split("\n");
    expect(rows.findIndex((r) => r.includes("stderr:"))).toBeLessThan(
      rows.findIndex((r) => r.includes("e-4")),
    );
  });

  it("stderr_fully_capped_renders_capped_label", async () => {
    // Review arch-4: stdout consuming the whole combined 20k budget leaves
    // stderr with zero chars — the label says so instead of promising rows.
    const frame = await renderFrame(
      <ToolResult
        shell={{ stdout: "y".repeat(20000), stderr: "tail-error", exitCode: 1 }}
        maxLines={5}
      />,
    );
    expect(frame).toContain("stderr: (capped)");
    expect(frame).not.toContain("tail-error");
  });

  it("shell_char_cap_budget_is_combined_across_streams", async () => {
    // SEPA phase-2 F2: the 20k guard is a TOTAL budget — stdout consuming
    // all of it leaves stderr capped (indicator notes the cap).
    const frame = await renderFrame(
      <ToolResult
        shell={{ stdout: "y".repeat(20000), stderr: "tail-error", exitCode: 1 }}
        maxLines={5}
      />,
    );
    expect(frame).toContain("output capped at 20000 chars");
    expect(frame).not.toContain("tail-error");
    expect(frame).toContain("exited 1");
  });

  it("shell_conflicts_with_children_throw", async () => {
    // EC-2 shell-side.
    const call = () =>
      ToolResult({
        shell: { stdout: "", stderr: "", exitCode: 0 },
        children: "x",
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow("provide exactly one");
  });
});
