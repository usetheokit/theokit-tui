import { describe, expect, it } from "vitest";

import {
  graphemeAt,
  initialTextBuffer,
  killLineEnd,
  killLineStart,
  killWordBackward,
  killWordForward,
  textBufferReducer,
} from "./text-buffer.js";
import type { TextBufferState } from "./text-buffer.js";

const state = (text: string, cursorOffset: number): TextBufferState => ({
  text,
  cursorOffset,
});

describe("M21 kill primitives + word motions (T3.1)", () => {
  it("kill_line_end_removes_to_the_line_end_and_returns_the_slice", () => {
    const r = killLineEnd(state("hello world", 6));
    expect(r.state).toEqual({ text: "hello ", cursorOffset: 6 });
    expect(r.killed).toBe("world");
  });

  it("kill_line_start_removes_from_the_line_start", () => {
    const r = killLineStart(state("hello world", 6));
    expect(r.state).toEqual({ text: "world", cursorOffset: 0 });
    expect(r.killed).toBe("hello ");
  });

  it("kill_word_backward_removes_the_previous_word", () => {
    const r = killWordBackward(state("hello world", 11));
    expect(r.state).toEqual({ text: "hello ", cursorOffset: 6 });
    expect(r.killed).toBe("world");
  });

  it("kill_word_forward_removes_the_next_word", () => {
    const r = killWordForward(state("hello world", 0));
    expect(r.killed).toBe("hello");
    expect(r.state.text).toBe(" world");
  });

  it("kill_line_end_on_an_empty_line_kills_the_newline", () => {
    // cursor at the end of an empty first line ("\nrest"), C-k kills the newline.
    const r = killLineEnd(state("\nrest", 0));
    expect(r.killed).toBe("");
    // The line is empty, so lineEnd === cursor → nothing killed on THIS line;
    // Emacs then kills the newline on a second C-k. Our primitive kills the
    // line content; the composer issues the newline kill as a delete-forward.
    expect(r.state.text).toBe("\nrest");
  });

  it("move_word_left_and_right_reposition_the_cursor", () => {
    expect(
      textBufferReducer(state("hello world", 11), { type: "move-word-left" }),
    ).toEqual({ text: "hello world", cursorOffset: 6 });
    expect(
      textBufferReducer(state("hello world", 0), { type: "move-word-right" }),
    ).toEqual({ text: "hello world", cursorOffset: 5 });
  });

  it("set_replaces_the_whole_state_for_undo_restore", () => {
    const restored = state("recovered", 3);
    expect(
      textBufferReducer(state("current", 2), { type: "set", state: restored }),
    ).toEqual(restored);
  });
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

  it("move_home_targets_current_line_start", () => {
    const s = state("ab\ncd", 4);
    expect(textBufferReducer(s, { type: "move-home" }).cursorOffset).toBe(3);
  });

  it("move_end_targets_text_end_on_last_line", () => {
    const s = state("ab\ncd", 4);
    expect(textBufferReducer(s, { type: "move-end" }).cursorOffset).toBe(5);
  });

  it("move_end_on_non_last_line_lands_on_next_newline", () => {
    // Review F-tests-2: the found-newline branch on a critical path.
    const s = state("ab\ncd", 0);
    expect(textBufferReducer(s, { type: "move-end" }).cursorOffset).toBe(2);
  });

  it("out_of_range_cursor_is_clamped_at_the_reducer_boundary", () => {
    // Review F-arch-4: the reducer is public API — malformed caller state is
    // clamped to a grapheme-safe range instead of silently corrupting text.
    const next = textBufferReducer(
      { text: "ab", cursorOffset: 99 },
      { type: "insert", text: "X" },
    );
    expect(next.text).toBe("abX");
    expect(next.cursorOffset).toBe(3);
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

describe("complete-command action (M15 T1.1)", () => {
  it("buffer_complete_command_action", () => {
    // Replaces line 1 with "/name " keeping the rest; cursor lands after
    // the trailing space (plan D3).
    const state = { text: "/he\nrest", cursorOffset: 3 };
    const next = textBufferReducer(state, {
      type: "complete-command",
      name: "help",
    });
    expect(next.text).toBe("/help \nrest");
    expect(next.cursorOffset).toBe(6);
  });

  it("complete_command_on_single_line", () => {
    const next = textBufferReducer(
      { text: "/cl", cursorOffset: 3 },
      { type: "complete-command", name: "clear" },
    );
    expect(next.text).toBe("/clear ");
    expect(next.cursorOffset).toBe(7);
  });
});
