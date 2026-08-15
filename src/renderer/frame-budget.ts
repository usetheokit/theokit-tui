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

export interface FrameBudgetOptions {
  /** Minimum ms between paints. `0` disables throttling — today's behaviour, exactly. */
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
