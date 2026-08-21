import { describe, expect, it } from "vitest";

import { computeTableLayout, gridRowWidth } from "../../src/markdown/markdown-table.js";

// M25 T1.1 — the pure table layout core (blueprint ADR A). Binary fit-or-degrade:
// the bordered grid renders only when the FULL content fits the budget (no cell
// truncation → no data loss); otherwise it degrades to aligned plain text (which
// the renderer wraps, still no loss). Width via an injected `measure` (string-width
// in production; identity-length here for deterministic ASCII assertions).

const LEN = (s: string): number => s.length;

describe("computeTableLayout (M25 T1.1)", () => {
  it("uses_content_widths_when_the_grid_fits_the_budget", () => {
    const layout = computeTableLayout(
      ["name", "age"],
      [
        ["alice", "30"],
        ["bob", "9"],
      ],
      80,
      LEN,
    );
    expect(layout.degrade).toBe(false);
    expect(layout.widths).toEqual([5, 3]); // max("name","alice","bob")=5, max("age","30")=3
  });

  it("the_grid_row_width_never_exceeds_the_budget_when_not_degraded", () => {
    const layout = computeTableLayout(["name", "age"], [["alice", "30"]], 80, LEN);
    expect(gridRowWidth(layout.widths)).toBeLessThanOrEqual(80);
  });

  it("degrades_when_the_full_grid_exceeds_the_budget", () => {
    const layout = computeTableLayout(
      ["a very long header cell", "another wide column here"],
      [["some long value", "more wide content"]],
      20, // far too narrow for the bordered grid
      LEN,
    );
    expect(layout.degrade).toBe(true);
  });

  it("ragged_rows_are_measured_up_to_the_header_column_count", () => {
    const layout = computeTableLayout(
      ["a", "b", "c"],
      [["x", "yy"]], // missing 3rd cell
      80,
      LEN,
    );
    expect(layout.widths).toEqual([1, 2, 1]); // 3rd col falls back to header width
  });

  it("gridRowWidth_is_sum_of_widths_plus_the_border_overhead", () => {
    // 2 cols, widths [5,3] → 5+3 + (3*2+1) = 15
    expect(gridRowWidth([5, 3])).toBe(15);
  });
});
