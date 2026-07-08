import { describe, expect, it } from "vitest";

import { findWordBackward, findWordForward } from "./word-navigation.js";

// M21 T3.1 — pure grapheme-safe word boundaries.

describe("findWordBackward (M21 T3.1)", () => {
  it("moves_to_the_start_of_the_previous_word", () => {
    // "hello world|" → cursor 11 → back to 6 (start of "world").
    expect(findWordBackward("hello world", 11)).toBe(6);
  });

  it("skips_trailing_whitespace_first", () => {
    // "hello   |" → back over the spaces + "hello" → 0.
    expect(findWordBackward("hello   ", 8)).toBe(0);
  });

  it("stops_at_ascii_punctuation_inside_a_word", () => {
    // "foo.bar|" → back to just after the dot (start of "bar") = 4.
    expect(findWordBackward("foo.bar", 7)).toBe(4);
  });

  it("clamps_at_the_start", () => {
    expect(findWordBackward("abc", 0)).toBe(0);
  });

  it("is_grapheme_safe_over_emoji", () => {
    // "👍 done|" → back to the start of "done".
    const text = "👍 done";
    expect(findWordBackward(text, text.length)).toBe(text.indexOf("done"));
  });

  it("skips_a_pure_punctuation_run", () => {
    // "a +++|" → back over the "+++" run → 2 (after "a ").
    expect(findWordBackward("a +++", 5)).toBe(2);
  });

  it("returns_the_skip_position_when_only_whitespace_precedes", () => {
    // "   |" → all whitespace skipped → 0.
    expect(findWordBackward("   ", 3)).toBe(0);
  });
});

describe("findWordForward (M21 T3.1)", () => {
  it("moves_to_the_end_of_the_next_word", () => {
    // "|hello world" → forward to 5 (end of "hello").
    expect(findWordForward("hello world", 0)).toBe(5);
  });

  it("skips_leading_whitespace_first", () => {
    // "|   hello" → forward over the spaces + "hello" → 8.
    expect(findWordForward("   hello", 0)).toBe(8);
  });

  it("stops_at_ascii_punctuation_inside_a_word", () => {
    // "|foo.bar" → forward to the dot = 3.
    expect(findWordForward("foo.bar", 0)).toBe(3);
  });

  it("clamps_at_the_end", () => {
    expect(findWordForward("abc", 3)).toBe(3);
  });

  it("skips_a_pure_punctuation_run", () => {
    // "|+++ a" → forward over the "+++" run → 3.
    expect(findWordForward("+++ a", 0)).toBe(3);
  });

  it("returns_the_skip_position_when_only_whitespace_follows", () => {
    // "|   " → all whitespace skipped → 3.
    expect(findWordForward("   ", 0)).toBe(3);
  });
});
