import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

/**
 * B-075 — the negative cases the nine tests above never had.
 *
 * Measured before the guard existed, with a clock the test owned and four calls 100 ms apart:
 *
 *   frameBudgetMs=NaN       shouldPaintNow=[false, false, false, false]
 *   frameBudgetMs=Infinity  shouldPaintNow=[true, false, false, false]
 *   frameBudgetMs=-1        shouldPaintNow=[true, true, true, true]
 *
 * `NaN` never painted AT ALL, not merely after the first paint: `NaN <= 0` is false and
 * `Infinity >= NaN` is false, so even the first frame was refused. Through the public hook the
 * shape was worse than a freeze — `useCoalesced` with `windowMs: NaN` rendered the literal string
 * "undefined", computed ZERO times, and re-rendered 6-7 times over 12 ticks against a control's 2,
 * because `msUntilNextFrame` returned 0 and the timer rescheduled itself.
 *
 * `-1` was silently identical to `0`, which is a documented value meaning "throttling off"
 * — see `frame-budget.ts` line 26. Refusing it is a BREAKING change for a caller who spelled
 * "off" that way, taken deliberately in ADR D3 of `b075-frame-budget-validation-plan.md`.
 */

/**
 * Guard records this file's tests produced, captured instead of printed — the shape
 * `usage-panel.test.tsx` lines 28-44 established. Capturing rather than silencing is the point:
 * the record is half the contract, and without asserting on it the suite cannot tell
 * a reporting guard from a plain throw.
 */
let guardRecords: string[] = [];
let realStderrWrite: typeof process.stderr.write;

beforeEach(() => {
  guardRecords = [];
  realStderrWrite = process.stderr.write;
  process.stderr.write = ((chunk: unknown): boolean => {
    const text = String(chunk);
    if (text.startsWith("[theokit/tui]")) {
      guardRecords.push(text);
      return true;
    }
    return realStderrWrite.call(process.stderr, text as never);
  }) as typeof process.stderr.write;
});

afterEach(() => {
  process.stderr.write = realStderrWrite;
});

describe("an invalid budget is refused at construction", () => {
  it("test_a_NaN_budget_is_refused_at_construction", () => {
    // The worst input measured: not a frozen last frame, but a surface that never paints once.
    expect(() => createFrameBudget({ frameBudgetMs: Number.NaN })).toThrow(
      TypeError,
    );
    expect(() => createFrameBudget({ frameBudgetMs: Number.NaN })).toThrow(
      "createFrameBudget: frameBudgetMs must be a finite number >= 0 — got NaN",
    );
  });

  it("test_an_infinite_budget_is_refused_at_construction", () => {
    expect(() =>
      createFrameBudget({ frameBudgetMs: Number.POSITIVE_INFINITY }),
    ).toThrow(TypeError);
    expect(() =>
      createFrameBudget({ frameBudgetMs: Number.POSITIVE_INFINITY }),
    ).toThrow(
      "createFrameBudget: frameBudgetMs must be a finite number >= 0 — got Infinity",
    );
  });

  it("test_a_negative_budget_is_refused_rather_than_silently_meaning_zero", () => {
    // ADR D3 — the one input with a plausible dependant. `-1` behaved exactly like `0` today,
    // so a caller who wrote it meaning "off" had working software. Two spellings of one intent,
    // one of them undocumented and pinned by nothing, is the ambiguity a boundary guard is for.
    expect(() => createFrameBudget({ frameBudgetMs: -1 })).toThrow(TypeError);
    expect(() => createFrameBudget({ frameBudgetMs: -1 })).toThrow(
      "createFrameBudget: frameBudgetMs must be a finite number >= 0 — got -1",
    );
  });

  it("test_the_refusal_leaves_a_durable_record", () => {
    // The other half of `rules/error-handling.md` § 3.1, and the half a `toThrow` cannot see.
    // Mutation-measured below: downgrading `reportGuardFailure` to a bare `throw` fails THIS
    // test and only this test.
    expect(() => createFrameBudget({ frameBudgetMs: Number.NaN })).toThrow(
      TypeError,
    );
    expect(guardRecords.join("")).toContain("createFrameBudget: frameBudgetMs");
  });
});

describe("the accepted edges of the range stay accepted", () => {
  // These two are GREEN before the guard and green after, deliberately: they are regression pins,
  // not RED tests. What they guard against is substitution — `assertPositiveWindow`
  // (`select-list-model.ts` line 64) is the house helper closest to hand, reads as the more
  // rigorous of the two, and requires a POSITIVE INTEGER. Swapping it in would compile, satisfy
  // every negative case above, and silently break both values below. `0` is documented as
  // "disables throttling" and is what `use-coalesced.ts` line 60 passes on every render under a
  // screen reader, so that substitution would break accessibility and call itself a guard.
  it("test_a_zero_budget_is_still_accepted_because_zero_means_off", () => {
    const budget = createFrameBudget({ frameBudgetMs: 0, now: () => 0 });
    expect(budget.shouldPaintNow()).toBe(true);
    expect(budget.msUntilNextFrame()).toBe(0);
  });

  it("test_a_fractional_budget_is_still_accepted", () => {
    let clock = 0;
    const budget = createFrameBudget({ frameBudgetMs: 2.5, now: () => clock });
    expect(budget.shouldPaintNow()).toBe(true);
    clock = 1;
    expect(budget.msUntilNextFrame()).toBe(1.5);
    expect(budget.shouldPaintNow()).toBe(false);
    clock = 2.5;
    expect(budget.shouldPaintNow()).toBe(true);
  });
});
