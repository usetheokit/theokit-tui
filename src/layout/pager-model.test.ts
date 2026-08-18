import { describe, expect, it } from "vitest";

import {
  maxOffset,
  pagerReducer,
  scrollPercent,
  visibleRange,
  type PagerState,
} from "./pager-model.js";

// M22 T3.1 — the pure pager scroll model (bubbles viewport port): clamp,
// percent at boundaries, visible slice, and the canonical action set.

const state = (
  offset: number,
  viewportHeight = 5,
  totalLines = 20,
): PagerState => ({
  offset,
  viewportHeight,
  totalLines,
});

describe("pager-model (M22 T3.1)", () => {
  it("visible_range_is_the_offset_slice", () => {
    expect(visibleRange(state(3))).toEqual([3, 8]);
  });

  it("max_offset_is_total_minus_height_floored_at_zero", () => {
    expect(maxOffset(state(0, 5, 20))).toBe(15);
    expect(maxOffset(state(0, 30, 20))).toBe(0); // content shorter than viewport
  });

  it("clamps_the_offset_into_range", () => {
    expect(pagerReducer(state(14), { type: "line-down" }).offset).toBe(15); // max
    expect(pagerReducer(state(15), { type: "line-down" }).offset).toBe(15); // stays
    expect(pagerReducer(state(0), { type: "line-up" }).offset).toBe(0); // stays
  });

  it("page_and_half_page_actions", () => {
    expect(pagerReducer(state(0), { type: "page-down" }).offset).toBe(5);
    expect(pagerReducer(state(10), { type: "page-up" }).offset).toBe(5);
    expect(pagerReducer(state(0), { type: "half-down" }).offset).toBe(2); // floor(5/2)
  });

  it("goto_top_and_bottom", () => {
    expect(pagerReducer(state(9), { type: "goto-top" }).offset).toBe(0);
    expect(pagerReducer(state(0), { type: "goto-bottom" }).offset).toBe(15);
  });

  it("scroll_percent_at_boundaries", () => {
    expect(scrollPercent(state(0))).toBe(0); // top
    expect(scrollPercent(state(15))).toBe(1); // bottom
    expect(scrollPercent(state(0, 30, 20))).toBe(1); // content fits → 100%
  });

  it("resize_re_clamps_a_stale_offset", () => {
    // A large offset then the viewport grows / content shrinks → offset re-clamped.
    const next = pagerReducer(state(15, 5, 20), {
      type: "resize",
      viewportHeight: 5,
      totalLines: 8,
    });
    expect(next.totalLines).toBe(8);
    expect(next.offset).toBe(3); // maxOffset(8-5)=3
  });
});
