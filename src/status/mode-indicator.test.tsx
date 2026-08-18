import { Box } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
import { ModeIndicator, PERMISSION_MODES } from "./mode-indicator.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";

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

/**
 * U-8 — a product with its own permission vocabulary can still use this indicator.
 *
 * `PermissionMode` is a closed union of the Claude Code idiom: `default | auto-accept | plan`. A
 * Codex-style agent has a different one — `suggest | auto-edit | full-auto` — so the component
 * refuses its modes at the boundary, by design.
 *
 * That refusal is right for a typo and wrong for a different vocabulary, and there was no way to
 * tell the two apart. So a consumer either maps its modes onto labels that mean something else, or
 * rebuilds the row. Measured from TheoCode, which has exactly that vocabulary (finding F-tui-12).
 *
 * `label` is the explicit escape: pass your own text and the component renders it with the same
 * styling and the same cycle hint. The union stays closed for `mode`, so a typo is still caught —
 * a consumer has to SAY it is outside the vocabulary rather than slip out of it.
 */
describe("U-8 — a custom label carries a foreign vocabulary", () => {
  it("custom_label_renders_with_the_house_styling", async () => {
    const frame = await renderFrame(<ModeIndicator label="⏵⏵ full-auto on" />);
    expect(frame).toContain("⏵⏵ full-auto on");
    expect(
      frame,
      "the cycle hint belongs to the row, not to the vocabulary",
    ).toContain("(shift+tab to cycle)");
  });

  it("builtin_modes_are_unchanged", async () => {
    // Anti-vacuity floor: the escape hatch must not alter the documented path.
    const frame = await renderFrame(<ModeIndicator mode="auto-accept" />);
    expect(frame).toContain("⏵⏵ auto-accept edits on");
  });

  it("an_invalid_mode_is_still_refused", () => {
    // The union stays closed: a typo must not become a silent custom label.
    expect(() =>
      // @ts-expect-error — deliberately invalid mode (negative case)
      ModeIndicator({ mode: "auto-acept" }),
    ).toThrow(TypeError);
  });
});
