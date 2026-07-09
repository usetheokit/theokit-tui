import { describe, expect, it } from "vitest";

import { pairIntraLines, segmentWords } from "./diff-word.js";
import type { DiffLine } from "./diff-model.js";

// M25 T2.1 — the pure intra-line word-diff core (blueprint ADR B). `segmentWords`
// runs jsdiff over a del/add pair and marks the changed words; `pairIntraLines`
// pairs equal-length adjacent del/add runs (assistant-ui recipe) so only genuine
// line-replacements highlight. No ink, no render.

const del = (text: string): DiffLine => ({ kind: "del", text });
const add = (text: string): DiffLine => ({ kind: "add", text });
const ctx = (text: string): DiffLine => ({ kind: "context", text });

describe("segmentWords (M25 T2.1)", () => {
  it("marks_changed_words_between_a_del_and_add", () => {
    const { del: d, add: a } = segmentWords("the quick fox", "the slow fox");
    expect(d.filter((s) => s.changed).map((s) => s.text)).toEqual(["quick"]);
    expect(a.filter((s) => s.changed).map((s) => s.text)).toEqual(["slow"]);
    // The unchanged words are shared.
    expect(d.map((s) => s.text).join("")).toBe("the quick fox");
    expect(a.map((s) => s.text).join("")).toBe("the slow fox");
  });

  it("identical_lines_have_no_changed_segments", () => {
    const { del: d, add: a } = segmentWords("same line", "same line");
    expect(d.some((s) => s.changed)).toBe(false);
    expect(a.some((s) => s.changed)).toBe(false);
  });

  it("strips_leading_whitespace_from_the_first_change", () => {
    // An indentation-only change must not highlight the leading whitespace.
    const { add: a } = segmentWords("x", "  x");
    const firstChanged = a.find((s) => s.changed);
    // The leading spaces are not marked changed (they render plain).
    expect(firstChanged?.text.startsWith(" ")).not.toBe(true);
  });
});

describe("pairIntraLines (M25 T2.1)", () => {
  it("pairs_an_equal_length_del_add_run", () => {
    const lines = [
      ctx("a"),
      del("the quick fox"),
      add("the slow fox"),
      ctx("b"),
    ];
    const map = pairIntraLines(lines);
    expect(map.get(lines[1]!)?.some((s) => s.changed)).toBe(true); // del
    expect(map.get(lines[2]!)?.some((s) => s.changed)).toBe(true); // add
    expect(map.has(lines[0]!)).toBe(false); // context not paired
  });

  it("does_not_pair_unequal_length_runs", () => {
    // 2 dels then 1 add → runs differ, no intra-line highlight.
    const lines = [del("one"), del("two"), add("three")];
    const map = pairIntraLines(lines);
    expect(map.size).toBe(0);
  });

  it("does_not_pair_non_adjacent_del_and_add", () => {
    const lines = [del("x"), ctx("mid"), add("y")];
    const map = pairIntraLines(lines);
    expect(map.size).toBe(0);
  });

  it("pairs_multiple_lines_in_a_run", () => {
    const lines = [del("aaa 1"), del("bbb 2"), add("aaa 9"), add("bbb 8")];
    const map = pairIntraLines(lines);
    expect(map.size).toBe(4); // both dels + both adds paired
  });
});
