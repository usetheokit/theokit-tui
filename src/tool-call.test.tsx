import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { ToolCall, ToolCallCard } from "./tool-call.js";

/** cli-spinners `dots` frame[0] — deterministic at renderFrame's 0ms tick (D6). */
const DOTS_FRAME_0 = "⠋";

/** Compound-SGR-safe strip (SEPA phase-1 F7). */
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\u001B\[[0-9;]*m/g, "");

describe("ToolCall — status lifecycle (T1.1)", () => {
  it("renders_pending_with_circle_glyph", async () => {
    const frame = await renderFrame(
      <ToolCall name="search" status="pending" />,
    );
    // Positional oracle (SEPA phase-1 F3): "o" must be the INDICATOR, not a
    // char inside the name.
    expect(stripAnsi(frame).startsWith("o")).toBe(true);
    expect(frame).toContain("search");
  });

  it("renders_success_with_check_glyph", async () => {
    const frame = await renderFrame(
      <ToolCall name="search" status="success" />,
    );
    expect(frame).toContain("✓");
  });

  it("renders_failed_with_x_glyph", async () => {
    const frame = await renderFrame(<ToolCall name="search" status="failed" />);
    expect(stripAnsi(frame).startsWith("x")).toBe(true);
  });

  it("running_shows_spinner_first_frame", async () => {
    // EC-14 canary: pins the coupling between renderFrame's 0ms tick and
    // cli-spinners' 80ms dots interval — see tests/helpers.tsx.
    const frame = await renderFrame(
      <ToolCall name="search" status="running" />,
    );
    expect(frame).toContain(DOTS_FRAME_0);
  });

  it("each_status_frame_matches_snapshot", async () => {
    for (const status of ["pending", "running", "success", "failed"] as const) {
      const frame = await renderFrame(
        <Box width={40}>
          <ToolCall name="grep" status={status} summary="src/**" />
        </Box>,
      );
      expect(frame).toMatchSnapshot(`tool-call-${status}`);
    }
  });

  it("invalid_status_throws_typed_error", () => {
    const call = () => ToolCall({ name: "x", status: "done" as never });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      'ToolCall: invalid status "done" — expected "pending" | "running" | "success" | "failed"',
    );
  });

  it("summary_renders_dim_after_name", async () => {
    const frame = await renderFrame(
      <ToolCall name="grep" status="success" summary="in 3 files" />,
    );
    expect(frame).toContain("in 3 files");
  });

  it("empty_name_renders_indicator_only", async () => {
    // EC-9: empty-but-valid name is legal — indicator still renders.
    // Frames carry ANSI (FORCE_COLOR=1 pin) — strip before the exact-equality.
    const frame = await renderFrame(<ToolCall name="" status="success" />);
    expect(stripAnsi(frame).trim()).toBe("✓");
  });

  it("name_with_newline_renders_single_header_line", async () => {
    // EC-8: the header is ONE line by contract — newlines sanitized to spaces.
    const frame = await renderFrame(
      <ToolCall name={"rm\n-rf"} status="failed" />,
    );
    expect(frame.split("\n")).toHaveLength(1);
    expect(frame).toContain("rm -rf");
  });

  it("summary_with_newline_renders_single_header_line", async () => {
    // EC-8 summary path (SEPA phase-1 F4) — mutation-visible without this.
    const frame = await renderFrame(
      <ToolCall name="grep" status="success" summary={"a\nb"} />,
    );
    expect(frame.split("\n")).toHaveLength(1);
    expect(frame).toContain("a b");
  });
});

describe("ToolCallCard — header + indented body (T1.2)", () => {
  it("card_renders_header_and_indented_body", async () => {
    const frame = await renderFrame(
      <ToolCallCard name="grep" status="success">
        <Text>12 matches</Text>
      </ToolCallCard>,
    );
    expect(frame).toContain("✓");
    expect(frame).toContain("12 matches");
    expect(frame.split("\n")[1]).toMatch(/^ {3}\S/); // exactly the indicator width (F8)
  });

  it("card_without_children_equals_row", async () => {
    const rowFrame = await renderFrame(
      <ToolCall name="grep" status="success" />,
    );
    const cardFrame = await renderFrame(
      <ToolCallCard name="grep" status="success" />,
    );
    expect(cardFrame).toBe(rowFrame);
  });

  it("card_frame_matches_snapshot", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <ToolCallCard name="grep" status="failed" summary="src/**">
          <Text>no matches found</Text>
        </ToolCallCard>
      </Box>,
    );
    expect(frame).toMatchSnapshot("tool-call-card");
  });

  it("card_with_string_children_renders_body", async () => {
    // EC-4: a raw string inside Ink's <Box> throws — the most natural consumer
    // call must not crash; string children are auto-wrapped in <Text>.
    const frame = await renderFrame(
      <ToolCallCard name="ls" status="success">
        {"12 matches"}
      </ToolCallCard>,
    );
    expect(frame).toContain("12 matches");
  });

  it("card_with_empty_string_children_equals_row", async () => {
    // EC-4: empty-string child is content-less — collapses to the bare row.
    const rowFrame = await renderFrame(<ToolCall name="ls" status="success" />);
    const cardFrame = await renderFrame(
      <ToolCallCard name="ls" status="success">
        {""}
      </ToolCallCard>,
    );
    expect(cardFrame).toBe(rowFrame);
  });
});
