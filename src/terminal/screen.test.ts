import { describe, expect, it } from "vitest";

import { CLEAR_SCREEN_AND_SCROLLBACK } from "./screen.js";

// B-013 (plan b013-clear-screen, ADRs D1-D3).
describe("CLEAR_SCREEN_AND_SCROLLBACK", () => {
  // THE test. `\x1b[3J` is the whole item: without it the screen looks correctly cleared and the
  // old conversation is still there when someone scrolls up — a mistake with no visible symptom
  // and an unbounded delay before anyone finds it.
  it("erases_the_scrollback_and_not_only_the_screen", () => {
    expect(CLEAR_SCREEN_AND_SCROLLBACK).toContain("\u001B[3J");
  });

  it("erases_the_visible_screen", () => {
    expect(CLEAR_SCREEN_AND_SCROLLBACK).toContain("\u001B[2J");
  });

  it("returns_the_cursor_home", () => {
    expect(CLEAR_SCREEN_AND_SCROLLBACK).toContain("\u001B[H");
  });

  it("erases_before_it_moves_the_cursor", () => {
    const eraseScreen = CLEAR_SCREEN_AND_SCROLLBACK.indexOf("\u001B[2J");
    const eraseScrollback = CLEAR_SCREEN_AND_SCROLLBACK.indexOf("\u001B[3J");
    const home = CLEAR_SCREEN_AND_SCROLLBACK.lastIndexOf("\u001B[H");
    expect(eraseScreen).toBeLessThan(eraseScrollback);
    expect(eraseScrollback).toBeLessThan(home);
  });

  // D3 — the renderer keeps scrollback on a full redraw, deliberately: it owns the screen and
  // erasing history would destroy output it did not write. These two must never converge, and
  // nothing but this assertion would notice if they did.
  it("is_not_the_renderers_keep_scrollback_sequence", () => {
    expect(CLEAR_SCREEN_AND_SCROLLBACK).not.toBe("\u001B[2J\u001B[H");
  });
});
