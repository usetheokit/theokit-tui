import { describe, expect, it } from "vitest";

import { detectKittyActive, KITTY_DISABLE, KITTY_ENABLE } from "./kitty.js";

// M19 T3.1 (plan m19-input-stack, ADR D5): kitty keyboard protocol —
// handshake + AWARENESS only (full CSI-u decode is M21). Enable pushes the
// disambiguate flag + queries + a DA sentinel; a `\x1b[?<flags>u` reply with
// flags != 0 means kitty is active; a DA-only reply means it is not.

describe("kitty handshake (M19 T3.1)", () => {
  it("enable_bytes_push_flag_query_and_da_sentinel", () => {
    expect(KITTY_ENABLE).toContain("\x1b[>1u"); // push flag 1 (disambiguate)
    expect(KITTY_ENABLE).toContain("\x1b[?u"); // query current flags
    expect(KITTY_ENABLE).toContain("\x1b[c"); // DA sentinel (non-kitty fallback)
  });

  it("disable_bytes_pop_the_kitty_stack", () => {
    expect(KITTY_DISABLE).toBe("\x1b[<u");
  });

  it("detects_active_from_nonzero_flags_reply", () => {
    expect(detectKittyActive("\x1b[?1u")).toBe(true);
    expect(detectKittyActive("\x1b[?15u")).toBe(true);
  });

  it("detects_inactive_from_zero_flags_or_da_only_reply", () => {
    expect(detectKittyActive("\x1b[?0u")).toBe(false); // explicit zero
    expect(detectKittyActive("\x1b[?62;c")).toBe(false); // DA reply, no ?u
    expect(detectKittyActive("")).toBe(false);
  });
});
