import { describe, expect, it } from "vitest";

import { backtrackReducer, CLOSED_BACKTRACK } from "../../src/chat/backtrack.js";

const primed = backtrackReducer(CLOSED_BACKTRACK, { type: "prime", previews: ["a", "b", "c"] });

describe("backtrackReducer", () => {
  it("prime_arms_and_sets_previews_in_one_transition", () => {
    expect(primed).toEqual({ armed: true, selected: -1, previews: ["a", "b", "c"] });
  });

  it("older_walks_from_newest_and_clamps_at_zero", () => {
    let s = primed;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = backtrackReducer(s, { type: "older" });
      seen.push(s.selected);
    }
    expect(seen).toEqual([2, 1, 0, 0]);
  });

  it("newer_from_newest_returns_to_none", () => {
    const newest = backtrackReducer(primed, { type: "older" });
    expect(backtrackReducer(newest, { type: "newer" }).selected).toBe(-1);
    const mid = backtrackReducer(newest, { type: "older" });
    expect(backtrackReducer(mid, { type: "newer" }).selected).toBe(2);
  });

  it("reset_returns_closed", () => {
    expect(backtrackReducer(primed, { type: "reset" })).toBe(CLOSED_BACKTRACK);
  });

  it("prime_with_empty_list_stays_closed", () => {
    expect(backtrackReducer(CLOSED_BACKTRACK, { type: "prime", previews: [] })).toEqual(
      CLOSED_BACKTRACK,
    );
  });

  it("older_and_newer_on_closed_return_same_object", () => {
    expect(backtrackReducer(CLOSED_BACKTRACK, { type: "older" })).toBe(CLOSED_BACKTRACK);
    expect(backtrackReducer(CLOSED_BACKTRACK, { type: "newer" })).toBe(CLOSED_BACKTRACK);
  });
});
