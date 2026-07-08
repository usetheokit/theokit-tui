import { describe, expect, it } from "vitest";

import { createInputParser } from "./input-parser.js";

// M19 T1.1 (plan m19-input-stack, ADR D2): the byte framer — a faithful port of
// Ink's input-parser.js. Slices a raw stdin stream into complete key/paste
// events, holding partial sequences in `pending`, splitting held-backspace runs,
// and framing bracketed paste as an atomic `{paste}` event.

describe("createInputParser (M19 T1.1)", () => {
  it("frames_a_single_key_sequence", () => {
    const parser = createInputParser();
    expect(parser.push("\x1b[D")).toEqual(["\x1b[D"]);
  });

  it("frames_bracketed_paste_as_atomic_event_markers_stripped", () => {
    const parser = createInputParser();
    const events = parser.push("\x1b[200~hello world\x1b[201~");
    expect(events).toEqual([{ paste: "hello world" }]);
  });

  it("splits_held_backspace_run_into_individual_events", () => {
    const parser = createInputParser();
    expect(parser.push("\x7f\x7f\x7f")).toEqual(["\x7f", "\x7f", "\x7f"]);
  });

  it("holds_partial_sequence_in_pending_then_completes", () => {
    const parser = createInputParser();
    expect(parser.push("\x1b[")).toEqual([]); // incomplete CSI → pending
    expect(parser.push("D")).toEqual(["\x1b[D"]); // completes on next chunk
  });

  it("holds_partial_paste_until_end_marker", () => {
    const parser = createInputParser();
    expect(parser.push("\x1b[200~abc")).toEqual([]); // no end marker yet
    expect(parser.push("def\x1b[201~")).toEqual([{ paste: "abcdef" }]);
  });

  it("mixes_text_and_keys_in_one_chunk", () => {
    const parser = createInputParser();
    expect(parser.push("ab\x1b[Dcd")).toEqual(["ab", "\x1b[D", "cd"]);
  });

  it("flushes_a_lone_pending_escape", () => {
    const parser = createInputParser();
    parser.push("\x1b"); // lone ESC → pending (could be Esc or alt-prefix)
    expect(parser.hasPendingEscape()).toBe(true);
    expect(parser.flushPendingEscape()).toBe("\x1b");
  });

  it("frames_ss3_and_double_escape_and_escaped_codepoint", () => {
    const parser = createInputParser();
    expect(parser.push("\x1bOA")).toEqual(["\x1bOA"]); // SS3 arrow
    expect(parser.push("\x1b\x1b[D")).toEqual(["\x1b\x1b[D"]); // alt+left (double ESC CSI)
    expect(parser.push("\x1bx")).toEqual(["\x1bx"]); // ESC + char (alt+x)
  });

  it("flush_returns_undefined_when_no_pending_escape", () => {
    const parser = createInputParser();
    parser.push("ab"); // plain text, no pending
    expect(parser.hasPendingEscape()).toBe(false);
    expect(parser.flushPendingEscape()).toBeUndefined();
  });

  it("reset_clears_pending", () => {
    const parser = createInputParser();
    parser.push("\x1b["); // partial → pending
    parser.reset();
    expect(parser.hasPendingEscape()).toBe(false);
    expect(parser.push("D")).toEqual(["D"]); // pending was cleared
  });

  it("holds_partial_ss3_and_double_escape_in_pending", () => {
    const parser = createInputParser();
    expect(parser.push("\x1bO")).toEqual([]); // incomplete SS3 → pending
    expect(parser.push("A")).toEqual(["\x1bOA"]);
    expect(parser.push("\x1b\x1b")).toEqual([]); // incomplete double-escape → pending
    expect(parser.push("[C")).toEqual(["\x1b\x1b[C"]);
  });

  it("frames_wide_codepoint_after_escape", () => {
    const parser = createInputParser();
    // ESC + an astral-plane char (surrogate pair, codePoint > 0xffff).
    expect(parser.push("\x1b\u{1f600}")).toEqual(["\x1b\u{1f600}"]);
  });

  it("frames_legacy_double_bracket_function_key", () => {
    const parser = createInputParser();
    expect(parser.push("\x1b[[A")).toEqual(["\x1b[[A"]); // Cygwin/libuv F1
  });

  it("backspace_run_with_leading_text_splits_text_first", () => {
    const parser = createInputParser();
    expect(parser.push("ab\x7f")).toEqual(["ab", "\x7f"]);
  });

  it("double_escape_partial_csi_and_non_control_fallback", () => {
    const p1 = createInputParser();
    expect(p1.push("\x1b\x1b[")).toEqual([]); // partial CSI after double ESC → pending
    expect(p1.push("C")).toEqual(["\x1b\x1b[C"]);
    const p2 = createInputParser();
    // Double ESC then a non-[/O char → the double-ESC is framed alone, char follows.
    expect(p2.push("\x1b\x1bx")).toEqual(["\x1b\x1b", "x"]);
  });

  it("invalid_ss3_final_byte_falls_to_escaped_codepoint", () => {
    const parser = createInputParser();
    // ESC O then a C0 control (0x01) — not a valid SS3 final byte.
    expect(parser.push("\x1bO\x01")).toEqual(["\x1bO", "\x01"]);
  });

  it("invalid_csi_byte_falls_to_escaped_codepoint", () => {
    const parser = createInputParser();
    // ESC [ then a C0 control (0x01) — not a param/intermediate/final byte, so
    // the CSI parse fails and framing falls back to ESC+codepoint ("\x1b[").
    expect(parser.push("\x1b[\x01")).toEqual(["\x1b[", "\x01"]);
  });
});
