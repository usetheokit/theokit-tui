/**
 * M83 — a frame budget over the renderer's existing coalescing.
 *
 * ## What was already there
 *
 * The renderer coalesces N commits per tick into one paint (`queueMicrotask`). That bounds paints
 * per TICK; it does not bound them per unit of TIME. A stream emitting a token every few
 * milliseconds produces a paint every few milliseconds, and each paint is a full diff plus a write
 * to the terminal.
 *
 * ## Why the clock is monotonic, and why that is not a detail
 *
 * A wall clock is not a duration source. NTP corrects it, DST shifts it, an operator sets it. A
 * frame budget built on `Date.now()` fails in both directions, and neither failure is graceful:
 *
 * - **backwards** — "no time has passed" stays true for as long as the jump lasted, so the UI
 *   FREEZES while the stream keeps arriving. This is the one a consumer already hit and documented.
 * - **forwards** — every pending frame is released at once.
 *
 * `performance.now()` counts from an arbitrary origin and only ever moves forward, which is the only
 * property a budget needs. The default is pinned by a test, because the two are interchangeable at
 * the call site and only one is correct.
 */

import { assertFiniteNonNegative } from "../format/format.js";
import { reportGuardFailure } from "../status/guard-sink.js";

export interface FrameBudgetOptions {
  /**
   * Minimum ms between paints. Finite and >= 0.
   *
   * `0` disables throttling — today's behaviour, exactly — and it is the ONLY spelling of that
   * intent. `-1` used to be a silent synonym for it and is now refused (B-075, ADR D3): two
   * spellings of one intent, one of them undocumented and pinned by nothing, is precisely what a
   * boundary guard exists to remove.
   *
   * Fractions are honoured, so this is deliberately NOT `assertPositiveWindow`'s positive-integer
   * contract — that helper is the wrong half of the house pair here, and would reject both `0` and
   * `2.5`.
   */
  readonly frameBudgetMs: number;
  /** Monotonic clock. Injected for tests; defaults to `performance.now`. */
  readonly now?: () => number;
}

export interface FrameBudget {
  /** Whether a paint may run now. Records the time when it says yes. */
  shouldPaintNow(): boolean;
  /** How long until the next frame is due. `0` when one is due already. */
  msUntilNextFrame(): number;
}

export function createFrameBudget(options: FrameBudgetOptions): FrameBudget {
  // B-075 — validated at CONSTRUCTION, not inside `shouldPaintNow`. A check on the paint path
  // would fire every frame, which under `.claude/rules/error-handling.md` § 3.1's never-deduplicate
  // rule floods the log, and it would name a paint rather than the call the caller actually wrote.
  //
  // The house shape (`context-window-bar.tsx:46-54`): the pure predicate throws, and the CALLER
  // reports — `assertFiniteNonNegative` is shared by components that know their own names and it
  // knows none of them, so it deliberately does no reporting of its own.
  //
  // Unlike `select-list-model.ts:55-60`, which declined this same import, this module is not a
  // pure model: it is a published factory on `@theokit/tui/renderer` that knows its own name, and
  // it has no component boundary above it — `use-coalesced.ts:67` calls it from a ref initialiser.
  // Throwing bare here would leave the failure with no durable record anywhere.
  try {
    assertFiniteNonNegative(
      options.frameBudgetMs,
      "createFrameBudget: frameBudgetMs must be a finite number >= 0",
    );
  } catch (err) {
    // NARROWED, not cast. `reportGuardFailure` validates `error instanceof Error` even though its
    // parameter is TYPED `Error`, and `guard-sink.ts:202-208` records why: an unvalidated value
    // made `error.message` throw from outside the guarded region, replacing the guard's diagnostic
    // with a TypeError about the reporter and leaving no record at all.
    //
    // `err as Error` is the assertion that cannot happen — and an `as` is exactly the shape that
    // rule warns about: a reachability claim with the argument left out. `assertFiniteNonNegative`
    // throws a TypeError today, so the cast is true today; the wrap costs one expression and stays
    // true if it ever stops being.
    reportGuardFailure(
      "createFrameBudget",
      err instanceof Error ? err : new TypeError(String(err)),
    );
  }
  const now = options.now ?? ((): number => performance.now());
  const budgetMs = options.frameBudgetMs;
  let lastPaintAt: number | undefined;

  const elapsed = (): number => {
    if (lastPaintAt === undefined) return Number.POSITIVE_INFINITY;
    const delta = now() - lastPaintAt;
    // A NEGATIVE delta means the clock moved backwards, so the stored timestamp is from a future
    // that no longer exists — it can never be reached again by waiting.
    //
    // My first version clamped this to zero, and the test caught that clamping does not fix the
    // freeze, it PERPETUATES it: every subsequent call also reads zero, and the UI stays frozen for
    // the whole length of the jump. Treating the anchor as stale and repainting immediately is what
    // actually bounds the damage to a single frame.
    return delta < 0 ? Number.POSITIVE_INFINITY : delta;
  };

  return {
    shouldPaintNow(): boolean {
      // The first paint is never delayed: there is nothing to coalesce with yet, and delaying it
      // would add latency to every startup for no benefit.
      // `>=` and not `>`: at exactly the budget the frame is DUE. Off by one drops one frame per
      // budget forever, which reads as "the UI is slightly behind" and is never diagnosed.
      if (budgetMs <= 0 || elapsed() >= budgetMs) {
        lastPaintAt = now();
        return true;
      }
      return false;
    },

    msUntilNextFrame(): number {
      if (budgetMs <= 0 || lastPaintAt === undefined) return 0;
      return Math.max(0, budgetMs - elapsed());
    },
  };
}
