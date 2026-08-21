import { describe, expect, it } from "vitest";
import { renderFrame } from "../../tests/fixtures/helpers.js";
import { stripAnsi } from "../format/ansi.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";
import { Banner } from "./banner.js";

// M27 T1.1 — <Banner> art path + name degrade over the ink renderFrame harness.

const ART = ["  ___", " |_ _|", "  | |", " |___|"].join("\n");

describe("Banner — art path + name degrade (T1.1)", () => {
  it("renders_provided_art_verbatim", async () => {
    const frame = stripAnsi(await renderFrame(<Banner name="Theo" art={ART} />));
    for (const line of ART.split("\n")) {
      expect(frame).toContain(line.trimEnd());
    }
  });

  it("multiline_art_keeps_every_line", async () => {
    const frame = stripAnsi(await renderFrame(<Banner name="Theo" art={ART} />));
    // Every art line appears (no wrap/truncation collapsing rows).
    const present = ART.split("\n").filter((l) => frame.includes(l.trimEnd())).length;
    expect(present).toBe(ART.split("\n").length);
  });

  it("degrades_to_the_bold_name_when_art_is_absent", async () => {
    const frame = await renderFrame(<Banner name="Theo TUI" />);
    expect(stripAnsi(frame)).toContain("Theo TUI");
    expect(frame).toMatch(/\[1m/); // bold SGR on the name
    expect(stripAnsi(frame)).not.toContain("|_ _|"); // no art
  });

  it("version_renders_dim_after_the_name_on_the_degrade_path", async () => {
    const frame = await renderFrame(<Banner name="Theo" version="1.2.3" />);
    expect(stripAnsi(frame)).toContain("Theo");
    expect(stripAnsi(frame)).toContain("v1.2.3");
  });
});

const STATUS = [
  { label: "model", value: "theo-demo-1" },
  { label: "cwd", value: "~/projects/app" },
];

describe("Banner — framed status panel + layout (T2.1)", () => {
  it("renders_each_label_value_row_in_a_bordered_box", async () => {
    const frame = stripAnsi(
      await renderFrame(<Banner name="Theo" layout="banner" art={ART} status={STATUS} />),
    );
    expect(frame).toContain("model");
    expect(frame).toContain("theo-demo-1");
    expect(frame).toContain("cwd");
    expect(frame).toMatch(/[╭┌│╰└]/); // a box-drawing border char
  });

  it("banner_layout_stacks_the_art_above_the_status_panel", async () => {
    const frame = stripAnsi(
      await renderFrame(<Banner name="Theo" layout="banner" art={ART} status={STATUS} />),
    );
    const lines = frame.split("\n");
    const artLine = lines.findIndex((l) => l.includes("|_ _|"));
    const modelLine = lines.findIndex((l) => l.includes("theo-demo-1"));
    expect(artLine).toBeGreaterThanOrEqual(0);
    expect(modelLine).toBeGreaterThan(artLine); // status below the art
  });

  it("minimal_layout_omits_the_status_panel", async () => {
    const frame = stripAnsi(
      await renderFrame(<Banner name="Theo" layout="minimal" status={STATUS} />),
    );
    expect(frame).toContain("Theo");
    expect(frame).not.toContain("theo-demo-1"); // no status panel in minimal
  });

  it("monochrome_status_panel_degrades_to_a_single_border_no_accent", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={themes["no-color"]}>
        <Banner name="Theo" layout="banner" art={ART} status={STATUS} />
      </TheoTUIProvider>,
    );
    // Box still present (glyph survives), but no accent color SGR bytes.
    expect(stripAnsi(frame)).toContain("model");
    expect(frame).not.toMatch(/\[3[0-9]m/); // no foreground color SGR
  });
});
