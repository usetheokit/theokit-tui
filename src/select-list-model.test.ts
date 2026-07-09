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
      overflowUp: true,
      overflowDown: true,
    });
  });

  it("clamps_the_index_and_never_windows_past_the_tail", () => {
    expect(windowFor(3, 99, 5)).toEqual({
      clampedIndex: 2,
      windowStart: 0, // 3 items < 5-window → no scroll
      overflowUp: false,
      overflowDown: false,
    });
  });

  it("is_a_safe_no_op_for_zero_items", () => {
    expect(windowFor(0, 0, 5)).toEqual({
      clampedIndex: 0,
      windowStart: 0,
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
