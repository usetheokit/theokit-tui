import { render } from "ink-testing-library";
import stringWidth from "string-width";
import { describe, expect, it } from "vitest";

import { MarkdownText } from "./markdown-text.js";

// M25 T1.1 — the table RENDER + the width-matrix oracle (blueprint Corner 3,
// RISK-1). `MarkdownText`'s Table reads ink's `useStdout().columns` (production-
// correct); the test shadows `stdout.columns` before render (the welcome-banner
// gated-mount idiom) to drive the budget. Gating assertion: at NO width does a
// rendered visual line exceed `columns` — grid when wide, wrapping plain text
// (data preserved, never truncated) when narrow.

/** Render MarkdownText with the stdout width shadowed before its first paint. */
function renderAtWidth(text: string, columns: number) {
  const instance = render(<MarkdownText text="probe" />);
  Object.defineProperty(instance.stdout, "columns", {
    get: () => columns,
    configurable: true,
  });
  instance.rerender(<MarkdownText text={text} key="w" />);
  return instance;
}

const TABLE = [
  "| name | age |",
  "| --- | ---: |",
  "| alice | 30 |",
  "| bob | 9 |",
].join("\n");

const WIDE_TABLE = [
  "| a fairly wide header | another wide column |",
  "| --- | --- |",
  "| some long-ish value | more wide content here |",
].join("\n");

describe("MarkdownText table render (M25 T1.1)", () => {
  it("renders_a_bordered_grid_when_wide", () => {
    const instance = renderAtWidth(TABLE, 80);
    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("┌"); // top-left corner → grid mode
    expect(frame).toContain("name"); // header cell
    expect(frame).toContain("alice");
    expect(frame).toContain("└"); // bottom border
    instance.unmount();
  });

  it("degrades_to_plain_text_when_too_narrow_for_the_grid", () => {
    const instance = renderAtWidth(WIDE_TABLE, 20);
    const frame = instance.lastFrame() ?? "";
    expect(frame).not.toContain("┌"); // no grid
    expect(frame).toContain("some long-ish value"); // data preserved
    instance.unmount();
  });

  it("no_rendered_line_exceeds_columns_across_the_width_matrix", () => {
    for (const columns of [80, 60, 40, 20, 10]) {
      const instance = renderAtWidth(WIDE_TABLE, columns);
      const lines = (instance.lastFrame() ?? "").split("\n");
      for (const line of lines) {
        expect(stringWidth(line)).toBeLessThanOrEqual(columns);
      }
      instance.unmount();
    }
  });

  it("respects_cjk_cell_width", () => {
    const cjk = ["| 名前 | age |", "| --- | --- |", "| 太郎 | 30 |"].join("\n");
    const instance = renderAtWidth(cjk, 40);
    for (const line of (instance.lastFrame() ?? "").split("\n")) {
      expect(stringWidth(line)).toBeLessThanOrEqual(40);
    }
    instance.unmount();
  });
});
