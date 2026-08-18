import { describe, expect, it } from "vitest";

import { deriveSelectList, windowFor } from "./select-list-model.js";
import type { SelectListItem } from "./select-list-model.js";

// M22 T1.1 — the SelectList pure model. `windowFor` is the DRY core the M15
// slash-menu + M21 mention-menu delegate to (byte-identical trailing window);
// `deriveSelectList` adds prefix|fuzzy filtering + multi-select by value.

const item = (v: string, label = v, description = ""): SelectListItem => ({
  value: v,
  label,
  description,
});

describe("windowFor (M22 T1.1) — the M15 trailing window", () => {
  it("matches_the_m15_snapshot_values", () => {
    // The M15 window: index 7 in a 5-window over 10 → windowStart 3 (rows 3-7
    // visible), rows 0-2 hidden above, rows 8-9 hidden below.
    const w = windowFor(10, 7, 5);
    expect(w).toEqual({
      clampedIndex: 7,
      windowStart: 3,
      // U-10 — these two used to live in the comment above, because the shape could not carry them.
      hiddenBefore: 3,
      hiddenAfter: 2,
      overflowUp: true,
      overflowDown: true,
    });
  });

  it("clamps_the_index_and_never_windows_past_the_tail", () => {
    expect(windowFor(3, 99, 5)).toEqual({
      clampedIndex: 2,
      windowStart: 0, // 3 items < 5-window → no scroll
      hiddenBefore: 0,
      hiddenAfter: 0,
      overflowUp: false,
      overflowDown: false,
    });
  });

  it("is_a_safe_no_op_for_zero_items", () => {
    expect(windowFor(0, 0, 5)).toEqual({
      clampedIndex: 0,
      windowStart: 0,
      hiddenBefore: 0,
      hiddenAfter: 0,
      overflowUp: false,
      overflowDown: false,
    });
  });
});

describe("deriveSelectList (M22 T1.1)", () => {
  const items = [item("apple"), item("apricot"), item("banana")];

  it("prefix_filters_and_windows", () => {
    const view = deriveSelectList({
      items,
      filter: "ap",
      selectionIndex: 0,
      window: 5,
    });
    expect(view.open).toBe(true);
    expect(view.matches.map((m) => m.value)).toEqual(["apple", "apricot"]);
  });

  it("fuzzy_filters_and_ranks", () => {
    const view = deriveSelectList({
      items,
      filter: "bn",
      selectionIndex: 0,
      window: 5,
      fuzzy: true,
    });
    expect(view.matches.map((m) => m.value)).toEqual(["banana"]);
  });

  it("empty_query_shows_all_and_a_no_match_query_closes", () => {
    expect(
      deriveSelectList({ items, filter: "", selectionIndex: 0, window: 5 })
        .matches.length,
    ).toBe(3);
    expect(
      deriveSelectList({ items, filter: "zzz", selectionIndex: 0, window: 5 })
        .open,
    ).toBe(false);
  });

  it("multi_select_is_carried_by_value_across_a_filter_reorder", () => {
    // "banana" selected; a fuzzy filter re-orders matches — it stays selected.
    const selected = new Set(["banana"]);
    const view = deriveSelectList({
      items,
      filter: "a",
      selectionIndex: 0,
      window: 5,
      fuzzy: true,
      selected,
    });
    expect(view.selected.has("banana")).toBe(true);
    // The selection is a VALUE set, independent of the (re-ordered) match index.
    expect(view.matches.some((m) => m.value === "banana")).toBe(true);
  });
});

/**
 * U-10 — how many are hidden, not merely that some are.
 *
 * `windowFor` computes `windowStart` and is given `count` and `window`, so it already knows both
 * counts: `windowStart` IS the number hidden above, and `count - (windowStart + window)` the number
 * below. It reduced them to booleans and dropped the rest.
 *
 * A boolean cannot be recovered into a count, so any consumer rendering "N more above" has to
 * recompute the window arithmetic it just asked for — which is a second implementation of the same
 * formula, free to drift. TheoCode's backtrack overlay does exactly that (finding F-tui-14).
 *
 * The booleans stay, now derived from the counts, so nothing that reads them changes.
 */
describe("U-10 — WindowView reports the hidden counts", () => {
  it("reports_how_many_are_hidden_above_and_below", () => {
    const view = windowFor(20, 10, 5);

    expect(view.hiddenBefore).toBe(view.windowStart);
    expect(view.hiddenAfter).toBe(20 - (view.windowStart + 5));
  });

  it("counts_are_zero_at_the_head", () => {
    const view = windowFor(20, 0, 5);

    expect(view.hiddenBefore).toBe(0);
    expect(view.hiddenAfter).toBe(15);
  });

  it("counts_are_zero_at_the_tail", () => {
    const view = windowFor(20, 19, 5);

    expect(view.hiddenAfter).toBe(0);
    expect(view.hiddenBefore).toBe(15);
  });

  it("a_list_that_fits_hides_nothing", () => {
    const view = windowFor(3, 1, 5);

    expect(view.hiddenBefore).toBe(0);
    expect(view.hiddenAfter).toBe(0);
  });

  it("an_empty_list_hides_nothing", () => {
    const view = windowFor(0, 0, 5);

    expect(view.hiddenBefore).toBe(0);
    expect(view.hiddenAfter).toBe(0);
  });

  it("the_booleans_still_agree_with_the_counts", () => {
    // Anti-vacuity floor: the existing contract must survive being derived from the new fields.
    const view = windowFor(20, 10, 5);

    expect(view.overflowUp).toBe(view.hiddenBefore > 0);
    expect(view.overflowDown).toBe(view.hiddenAfter > 0);
  });
});

// ---------------------------------------------------------------------------
// T3.4 — the centred anchor.
//
// `windowFor` already reports `hiddenBefore`/`hiddenAfter` as counts (U-10, 0.53.0). What stayed
// downstream was the ANCHOR: the trailing window keeps the selection at the BOTTOM, and an overlay
// that lets you walk backwards through history wants it in the MIDDLE, so the rows on either side
// are visible as you move.
//
// Deliberate deviation from the plan's pseudo-code, which proposed a new `windowAround(...)`. There
// is already a function that computes exactly this window and is exported and consumed; a second one
// beside it would be two implementations of one clamp, disagreeing the first time either is touched
// (G12). The anchor is an OPTION, and its default is the current behaviour — otherwise every list in
// every consumer silently re-anchors on upgrade.
describe("windowFor — centred anchor", () => {
  it("test_the_default_anchor_is_unchanged", () => {
    // The whole safety of adding the option. Same call, same answer as before it existed.
    expect(windowFor(10, 5, 5)).toEqual(windowFor(10, 5, 5, "trailing"));
    expect(
      windowFor(10, 5, 5).windowStart,
      "trailing keeps the selection at the bottom",
    ).toBe(1);
  });

  it("test_a_centred_selection_sits_in_the_middle_of_the_window", () => {
    const view = windowFor(10, 5, 5, "centred");
    expect(view.windowStart).toBe(3);
    expect(view.clampedIndex).toBe(5);
    expect(view.hiddenBefore).toBe(3);
    expect(view.hiddenAfter).toBe(2);
  });

  it("test_near_the_head_a_centred_window_clamps_instead_of_going_negative", () => {
    // Centring cannot centre at the ends, and the clamped case is where off-by-one lives — so both
    // ends are asserted explicitly rather than by symmetry.
    const view = windowFor(10, 0, 5, "centred");
    expect(view.windowStart).toBe(0);
    expect(view.hiddenBefore).toBe(0);
    expect(view.hiddenAfter).toBe(5);
  });

  it("test_near_the_tail_a_centred_window_clamps_instead_of_running_past_the_end", () => {
    const view = windowFor(10, 9, 5, "centred");
    expect(view.windowStart).toBe(5);
    expect(view.hiddenBefore).toBe(5);
    expect(view.hiddenAfter, "there is nothing after the last row").toBe(0);
  });

  it("test_a_window_larger_than_the_list_hides_nothing_under_either_anchor", () => {
    for (const anchor of ["trailing", "centred"] as const) {
      const view = windowFor(3, 1, 10, anchor);
      expect(view.windowStart, anchor).toBe(0);
      expect(view.hiddenBefore, anchor).toBe(0);
      expect(view.hiddenAfter, anchor).toBe(0);
      expect(view.clampedIndex, anchor).toBe(1);
    }
  });

  it("test_an_empty_list_is_a_no_op_under_either_anchor", () => {
    expect(windowFor(0, 3, 5, "centred")).toEqual(
      windowFor(0, 3, 5, "trailing"),
    );
  });

  it("test_the_selection_is_always_inside_the_window_it_returns", () => {
    // The property the whole function exists for, asserted across the space rather than at points.
    for (const total of [1, 2, 5, 10, 33]) {
      for (let selected = -2; selected <= total + 1; selected += 1) {
        for (const size of [1, 2, 5, 10]) {
          for (const anchor of ["trailing", "centred"] as const) {
            const view = windowFor(total, selected, size, anchor);
            if (total === 0) continue;
            const where = `total=${total} selected=${selected} size=${size} ${anchor}`;
            expect(view.clampedIndex, where).toBeGreaterThanOrEqual(
              view.windowStart,
            );
            expect(view.clampedIndex, where).toBeLessThan(
              view.windowStart + size,
            );
            expect(view.windowStart, where).toBeGreaterThanOrEqual(0);
            expect(
              view.hiddenBefore + Math.min(size, total) + view.hiddenAfter,
              where,
            ).toBe(total);
          }
        }
      }
    }
  });
});
