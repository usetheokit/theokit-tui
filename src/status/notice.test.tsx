import { Box } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";
import { NOTICE_VARIANTS, Notice } from "./notice.js";

describe("Notice (#3 — inline banner)", () => {
  it("warning_uses_the_bang_marker", async () => {
    const frame = await renderFrame(
      <Notice variant="warning">
        Both apiKeyHelper and ANTHROPIC_API_KEY set · auth may not work
      </Notice>,
    );
    expect(frame).toContain("!!");
    expect(frame).toContain("auth may not work");
  });

  it("info_uses_the_left_bar_marker", async () => {
    const frame = await renderFrame(
      <Notice variant="info">Opus 4.8 is now available! · /model to switch</Notice>,
    );
    expect(frame).toContain("│");
    expect(frame).toContain("Opus 4.8 is now available!");
  });

  it("success_and_error_markers", async () => {
    const ok = await renderFrame(<Notice variant="success">done</Notice>);
    expect(ok).toContain("✓");
    const err = await renderFrame(<Notice variant="error">failed</Notice>);
    expect(err).toContain("✗");
  });

  it("defaults_to_info", async () => {
    const frame = await renderFrame(<Notice>heads up</Notice>);
    expect(frame).toContain("│");
    expect(frame).toContain("heads up");
  });

  it("carries_color_in_a_themed_terminal", async () => {
    const frame = await renderFrame(<Notice variant="warning">warn</Notice>);
    expect(frame).toContain("[33m"); // yellow SGR
  });

  it("under_no_color_the_marker_still_carries_the_variant", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={themes["no-color"]}>
        <Notice variant="warning">warn</Notice>
      </TheoTUIProvider>,
    );
    expect(frame).toContain("!!");
    expect(frame).not.toContain("[33m"); // color stripped
  });

  it("invalid_variant_throws_typed_error", () => {
    expect(() =>
      // @ts-expect-error — deliberately invalid variant (negative case)
      Notice({ variant: "nope", children: "x" }),
    ).toThrow(TypeError);
  });

  it("accepts_margin_props", async () => {
    const raw = await renderFrame(
      <Box>
        <Notice variant="info" marginTop={2}>
          spaced
        </Notice>
      </Box>,
    );
    expect(raw.split("\n")[0]?.trim()).toBe("");
  });

  it("exposes_the_variants_union", () => {
    expect([...NOTICE_VARIANTS]).toEqual(["info", "warning", "success", "error"]);
  });
});
