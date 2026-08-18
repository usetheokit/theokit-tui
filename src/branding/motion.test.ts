import { describe, expect, it } from "vitest";

import { isMotionEnabled } from "./motion.js";

// M24 T1.1 — the extracted reduced-motion gate (blueprint ADR D6). Pure: motion
// is enabled iff THEOKIT_TUI_NO_MOTION is empty AND stdout is a TTY AND the theme
// is not monochrome. The M12 WelcomeBanner delegates to this; the phrase-cycler /
// shimmer opt-ins gate on it.

const TTY = { isTTY: true } as const;
const PIPE = { isTTY: false } as const;

describe("isMotionEnabled (M24 T1.1)", () => {
  it("enabled_when_env_empty_tty_and_color", () => {
    expect(isMotionEnabled({}, TTY, false)).toBe(true);
  });

  it("disabled_when_NO_MOTION_is_set", () => {
    expect(isMotionEnabled({ THEOKIT_TUI_NO_MOTION: "1" }, TTY, false)).toBe(
      false,
    );
  });

  it("empty_string_NO_MOTION_counts_as_unset", () => {
    expect(isMotionEnabled({ THEOKIT_TUI_NO_MOTION: "" }, TTY, false)).toBe(
      true,
    );
  });

  it("disabled_on_non_tty", () => {
    expect(isMotionEnabled({}, PIPE, false)).toBe(false);
  });

  it("disabled_when_stdout_is_undefined", () => {
    expect(isMotionEnabled({}, undefined, false)).toBe(false);
  });

  it("disabled_under_monochrome", () => {
    expect(isMotionEnabled({}, TTY, true)).toBe(false);
  });
});
