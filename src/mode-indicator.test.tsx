import { Box } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { ModeIndicator, PERMISSION_MODES } from "./mode-indicator.js";
import { TheoTUIProvider, themes } from "./theme.js";

describe("ModeIndicator (#2 — permission-mode footer)", () => {
  it("renders_auto_accept_the_claude_code_way", async () => {
    const frame = await renderFrame(<ModeIndicator mode="auto-accept" />);
    expect(frame).toContain("⏵⏵ auto-accept edits on");
    expect(frame).toContain("(shift+tab to cycle)");
  });

  it("renders_plan_mode", async () => {
    const frame = await renderFrame(<ModeIndicator mode="plan" />);
    expect(frame).toContain("⏸ plan mode on");
    expect(frame).toContain("(shift+tab to cycle)");
  });

  it("default_mode_renders_nothing", async () => {
    const frame = await renderFrame(<ModeIndicator mode="default" />);
    expect(frame.trim()).toBe("");
  });

  it("invalid_mode_throws_typed_error", () => {
    expect(() =>
      // @ts-expect-error — deliberately invalid mode (negative case)
      ModeIndicator({ mode: "yolo" }),
    ).toThrow(TypeError);
    expect(() =>
      // @ts-expect-error — deliberately invalid mode
      ModeIndicator({ mode: "yolo" }),
    ).toThrow(/invalid mode/);
  });

  it("under_no_color_the_glyph_still_carries_the_mode", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={themes["no-color"]}>
        <ModeIndicator mode="auto-accept" />
      </TheoTUIProvider>,
    );
    // Color stripped, glyph + label remain (degrade-as-data).
    expect(frame).toContain("⏵⏵ auto-accept edits on");
  });

  it("accepts_margin_props", async () => {
    const raw = await renderFrame(
      <Box>
        <ModeIndicator mode="plan" marginTop={2} />
      </Box>,
    );
    expect(raw.split("\n")[0]?.trim()).toBe("");
  });

  it("exposes_the_permission_modes_union", () => {
    expect([...PERMISSION_MODES]).toEqual(["default", "auto-accept", "plan"]);
  });
});
