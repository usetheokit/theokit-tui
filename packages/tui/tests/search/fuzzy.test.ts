import { describe, expect, it } from "vitest";

import { fuzzyMatch, fuzzyRank } from "../../src/search/fuzzy.js";

// M21 T4.1 — the subsequence fuzzy matcher + ranker.

describe("fuzzyMatch (M21 T4.1)", () => {
  it("matches_a_subsequence", () => {
    expect(fuzzyMatch("fb", "foobar").matches).toBe(true);
    expect(fuzzyMatch("xyz", "foobar").matches).toBe(false);
  });

  it("empty_query_matches_everything", () => {
    expect(fuzzyMatch("", "anything")).toEqual({ matches: true, score: 0 });
  });

  it("query_longer_than_text_never_matches", () => {
    expect(fuzzyMatch("foobar", "foo").matches).toBe(false);
  });

  it("is_case_insensitive", () => {
    expect(fuzzyMatch("FOO", "foobar").matches).toBe(true);
  });

  it("scores_consecutive_and_word_boundary_matches_better_than_gaps", () => {
    // "sf" against "src/foo" (word-boundary s + f) beats a gappy match.
    const boundary = fuzzyMatch("sf", "src/foo").score;
    const gappy = fuzzyMatch("sf", "aaasaaaf").score;
    expect(boundary).toBeLessThan(gappy);
  });

  it("prefers_an_exact_match_strongly", () => {
    expect(fuzzyMatch("foo", "foo").score).toBeLessThan(fuzzyMatch("foo", "foobar").score);
  });
});

describe("fuzzyRank (M21 T4.1)", () => {
  it("ranks_matches_best_first_and_drops_non_matches", () => {
    const ranked = fuzzyRank("fb", ["zzz", "foobar", "fabulous", "fb"]);
    expect(ranked).not.toContain("zzz");
    // "fb" (exact-ish consecutive) ranks above the gappier candidates.
    expect(ranked[0]).toBe("fb");
    expect(ranked).toContain("foobar");
  });

  it("returns_empty_when_nothing_matches", () => {
    expect(fuzzyRank("qqq", ["abc", "def"])).toEqual([]);
  });
});
