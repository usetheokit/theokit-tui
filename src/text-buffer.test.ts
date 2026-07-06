import { describe, expect, it } from "vitest";

import {
  graphemeAt,
  initialTextBuffer,
  textBufferReducer,
} from "./text-buffer.js";
import type { TextBufferState } from "./text-buffer.js";

const state = (text: string, cursorOffset: number): TextBufferState => ({
  text,
  cursorOffset,
});

describe("textBufferReducer (T3.1)", () => {
  it("insert_at_cursor_advances_cursor", () => {
    const next = textBufferReducer(state("hello", 2), {
      type: "insert",
      text: "X",
    });
    expect(next.text).toBe("heXllo");
    expect(next.cursorOffset).toBe(3);
  });

  it("delete_backward_removes_previous_grapheme", () => {
    const next = textBufferReducer(state("hello", 2), {
      type: "delete-backward",
    });
    expect(next.text).toBe("hllo");
    expect(next.cursorOffset).toBe(1);
  });

  it("delete_backward_at_start_is_noop", () => {
    const s = state("hello", 0);
    expect(textBufferReducer(s, { type: "delete-backward" })).toEqual(s);
  });

  it("delete_forward_removes_grapheme_at_cursor", () => {
    const next = textBufferReducer(state("hello", 1), {
      type: "delete-forward",
    });
    expect(next.text).toBe("hllo");
    expect(next.cursorOffset).toBe(1);
  });

  it("move_left_steps_one_grapheme_over_emoji", () => {
    // "a👍b": 👍 is a surrogate pair (2 code units) — ONE grapheme step.
    const next = textBufferReducer(state("a👍b", 3), { type: "move-left" });
    expect(next.cursorOffset).toBe(1);
  });

  it("move_right_at_end_is_noop", () => {
    const s = state("ab", 2);
    expect(textBufferReducer(s, { type: "move-right" }).cursorOffset).toBe(2);
  });

  it("move_home_and_end_target_line_boundaries", () => {
    const s = state("ab\ncd", 4);
    expect(textBufferReducer(s, { type: "move-home" }).cursorOffset).toBe(3);
    expect(textBufferReducer(s, { type: "move-end" }).cursorOffset).toBe(5);
  });

  it("move_home_at_offset_zero_with_leading_newline_is_noop", () => {
    // SEPA iteration-5 finding 2: lastIndexOf("\n", -1) clamps to 0 and
    // matches a leading newline, moving the cursor FORWARD. Must be a no-op.
    const s = state("\nab", 0);
    expect(textBufferReducer(s, { type: "move-home" }).cursorOffset).toBe(0);
  });

  it("newline_inserts_linefeed_at_cursor", () => {
    const next = textBufferReducer(state("abcd", 2), { type: "newline" });
    expect(next.text).toBe("ab\ncd");
    expect(next.cursorOffset).toBe(3);
  });

  it("clear_resets_buffer", () => {
    const next = textBufferReducer(state("abc", 2), { type: "clear" });
    expect(next).toEqual(initialTextBuffer);
  });

  it("insert_multichar_paste_like_text", () => {
    const next = textBufferReducer(state("ab", 1), {
      type: "insert",
      text: "wor ld",
    });
    expect(next.text).toBe("awor ldb");
    expect(next.cursorOffset).toBe(7);
  });

  it("delete_backward_removes_whole_emoji", () => {
    const next = textBufferReducer(state("a👍b", 3), {
      type: "delete-backward",
    });
    expect(next.text).toBe("ab");
    expect(next.cursorOffset).toBe(1);
  });

  it("delete_forward_at_end_is_noop", () => {
    const s = state("ab", 2);
    expect(textBufferReducer(s, { type: "delete-forward" })).toEqual(s);
  });

  it("move_left_at_start_is_noop", () => {
    const s = state("ab", 0);
    expect(textBufferReducer(s, { type: "move-left" })).toEqual(s);
  });

  it("grapheme_at_end_of_text_is_empty", () => {
    expect(graphemeAt("ab", 2)).toBe("");
    expect(graphemeAt("ab", 5)).toBe("");
  });

  it("move_end_without_trailing_newline_targets_text_end", () => {
    const s = state("abc", 1);
    expect(textBufferReducer(s, { type: "move-end" }).cursorOffset).toBe(3);
  });
});
