import { describe, expect, it, vi } from "vitest";

import { createFrameBudget } from "./frame-budget.js";

/**
 * M83 — a frame budget over the renderer's existing coalescing.
 *
 * ## What was already there, and what was not
 *
 * The renderer already coalesces: N commits per tick become one paint, via `queueMicrotask`. That
 * bounds paints per TICK. It does not bound them per unit of TIME — a stream emitting a token every
 * few milliseconds produces a paint every few milliseconds, and each paint is a full diff plus a
 * write to the terminal.
 *
 * ## Why the clock must be monotonic
 *
 * A wall clock (`Date.now()`) is not a duration source: NTP corrects it, DST shifts it, an operator
 * sets it. A frame budget built on one fails in both directions and neither is graceful — a backward
 * jump makes "no time has passed" true for as long as the jump lasted, so the UI FREEZES while the
 * stream keeps arriving; a forward jump releases every pending frame at once.
 *
 * `performance.now()` counts from an arbitrary origin and only ever goes forward, which is the only
 * property a budget actually needs.
 */

describe("the budget throttles paints per unit of TIME", () => {
  it("test_the_first_paint_is_never_delayed", () => {
    // A budget that made the first frame wait would add latency to every startup for no benefit:
    // there is nothing to coalesce with yet.
    const budget = createFrameBudget({ frameBudgetMs: 16, now: () => 0 });
    expect(budget.shouldPaintNow()).toBe(true);
  });

  it("test_a_second_paint_INSIDE_the_budget_is_deferred", () => {
    let clock = 0;
    const budget = createFrameBudget({ frameBudgetMs: 16, now: () => clock });
    budget.shouldPaintNow();
    clock = 5;
    expect(budget.shouldPaintNow()).toBe(false);
  });

  it("test_a_paint_AFTER_the_budget_elapses_is_allowed", () => {
    let clock = 0;
    const budget = createFrameBudget({ frameBudgetMs: 16, now: () => clock });
    budget.shouldPaintNow();
    clock = 16;
    expect(budget.shouldPaintNow()).toBe(true);
  });

  it("test_the_boundary_is_inclusive", () => {
    // Stated on purpose: at exactly the budget the frame is due. Off by one here drops one frame
    // per budget forever, which reads as "the UI is slightly behind" and is never diagnosed.
    let clock = 100;
    const budget = createFrameBudget({ frameBudgetMs: 16, now: () => clock });
    budget.shouldPaintNow();
    clock = 116;
    expect(budget.shouldPaintNow()).toBe(true);
  });
});

describe("a deferred frame is not a lost frame", () => {
  it("test_the_delay_until_the_next_frame_is_reported", () => {
    // The caller schedules with this. Without it, a deferred paint would need its own polling loop —
    // and the last token of a stream would sit unpainted until something else happened to commit.
    let clock = 0;
    const budget = createFrameBudget({ frameBudgetMs: 16, now: () => clock });
    budget.shouldPaintNow();
    clock = 6;
    expect(budget.msUntilNextFrame()).toBe(10);
  });

  it("test_the_delay_is_zero_once_the_budget_has_elapsed", () => {
    let clock = 0;
    const budget = createFrameBudget({ frameBudgetMs: 16, now: () => clock });
    budget.shouldPaintNow();
    clock = 50;
    expect(budget.msUntilNextFrame()).toBe(0);
  });
});

describe("the clock is monotonic by construction", () => {
  it("test_a_BACKWARD_jump_does_not_freeze_the_ui", () => {
    // The failure a wall clock produces. With `Date.now()`, an NTP correction backwards makes "no
    // time has passed" true for the length of the jump — and the UI stops repainting while the
    // stream keeps arriving. Clamping at zero means the worst case is one extra frame, not a freeze.
    let clock = 1_000;
    const budget = createFrameBudget({ frameBudgetMs: 16, now: () => clock });
    budget.shouldPaintNow();
    clock = 0; // the jump a monotonic source cannot produce, simulated
    expect(budget.shouldPaintNow()).toBe(true);
  });

  it("test_the_default_clock_is_performance_now_and_not_Date_now", () => {
    // Pinned, because the two are interchangeable at the call site and only one is a duration
    // source. A future edit swapping them would pass every test above with an injected clock.
    const spy = vi.spyOn(performance, "now");
    createFrameBudget({ frameBudgetMs: 16 }).shouldPaintNow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("the budget is opt-in", () => {
  it("test_a_zero_budget_never_defers", () => {
    // Additive by design: a caller that does not want throttling gets today's behaviour exactly.
    let clock = 0;
    const budget = createFrameBudget({ frameBudgetMs: 0, now: () => clock });
    budget.shouldPaintNow();
    clock = 0;
    expect(budget.shouldPaintNow()).toBe(true);
  });
});
