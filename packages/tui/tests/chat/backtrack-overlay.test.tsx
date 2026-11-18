import { describe, expect, it } from "vitest";

import { BacktrackOverlay } from "../../src/chat/backtrack-overlay.js";
import { stripAnsi } from "../../src/format/ansi.js";
import { renderFrame } from "../fixtures/helpers.js";

describe("BacktrackOverlay", () => {
  it("marks_the_selected_numbered_row_and_shows_position", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <BacktrackOverlay previews={["one", "two\nlines", "three"]} selected={1} />,
      ),
    );
    expect(plain).toContain("2/3");
    expect(plain).toMatch(/❯ 2\. two lines/);
    expect(plain).toContain("1. one");
  });

  it("renders_nothing_for_an_empty_list", async () => {
    expect((await renderFrame(<BacktrackOverlay previews={[]} selected={-1} />)).trim()).toBe("");
  });

  it("accepts_custom_header_and_hint", async () => {
    const plain = stripAnsi(
      await renderFrame(<BacktrackOverlay previews={["a"]} selected={0} header="Msg" hint="go" />),
    );
    expect(plain).toContain("Msg");
    expect(plain).toContain("go");
  });
});
