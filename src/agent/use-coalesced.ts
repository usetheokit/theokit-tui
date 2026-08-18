import { useEffect, useRef, useState } from "react";

import { createFrameBudget, type FrameBudget } from "../renderer/frame-budget.js";

/** How long a window lasts by default: one frame at 30fps. */
const DEFAULT_WINDOW_MS = 34;

export interface UseCoalescedOptions {
  /** Minimum ms between recomputations. `0` disables coalescing. Default 34 (about 30fps). */
  windowMs?: number;
  /**
   * Monotonic clock, forwarded to the budget. Injected by tests; without this the tests would
   * measure `performance.now` and stop being deterministic.
   */
  now?: () => number;
  /**
   * Whether a screen reader is driving the terminal. When true the window is ZERO and every update
   * passes through.
   *
   * Coalescing works by dropping intermediate states, and intermediate states are exactly what a
   * screen reader must announce — shortening the window rather than removing it would still drop
   * them, and "fewer dropped announcements" is not accessibility. Defaults to the
   * `INK_SCREEN_READER` convention, read per call rather than at module load so it stays testable
   * (ADR D2).
   */
  screenReader?: boolean;
}

function readScreenReader(): boolean {
  return process.env["INK_SCREEN_READER"] === "true";
}

/**
 * A derived value, recomputed at most once per window.
 *
 * A streaming turn changes its message thread every few milliseconds, and deriving a timeline from
 * it is not free. This bounds recomputation per unit of TIME, which is the thing React's own
 * batching does not do: batching bounds work per tick, and a token arriving every 3ms produces a
 * tick every 3ms.
 *
 * Built on {@link createFrameBudget} rather than beside it (ADR D1). That primitive already owns
 * the monotonic clock and — importantly — the rule for a clock that jumps BACKWARDS, where it
 * treats its stored anchor as stale rather than clamping the delta, because clamping perpetuates
 * the freeze for the whole length of the jump instead of bounding it to one frame.
 *
 * **The trailing update is not an optimisation.** Without it the last change inside a window is
 * never rendered — the final token of a stream, the closing state of a turn — and everything looks
 * correct right up until the stream stops.
 */
export function useCoalesced<T>(
  compute: () => T,
  key: unknown,
  options: UseCoalescedOptions = {},
): T {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const screenReader = options.screenReader ?? readScreenReader();
  const effectiveWindow = screenReader ? 0 : windowMs;

  // The budget is stateful and MUST outlive a render. Created in the body it would be new every
  // render, its anchor always unset, and `shouldPaintNow` would always say yes — the throttle
  // would silently do nothing (ADR D4). A ref and not `useMemo`: `useMemo` is a hint React may
  // discard, and correctness must not rest on one.
  const budget = useRef<FrameBudget | undefined>(undefined);
  budget.current ??= createFrameBudget({
    frameBudgetMs: effectiveWindow,
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  // The LATEST compute, refreshed every render. Keying work on its identity would recompute every
  // render (callers pass an inline arrow); capturing the first one forever would make the trailing
  // update read a stale closure. Neither is acceptable, so the identity is ignored and the value
  // is kept current (ADR D4).
  const latest = useRef(compute);
  latest.current = compute;

  const state = useRef<{ value: T | undefined; key: unknown; primed: boolean }>({
    value: undefined,
    key: undefined,
    primed: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [, force] = useState(0);

  const stale = !state.current.primed || state.current.key !== key;
  if (stale && budget.current.shouldPaintNow()) {
    state.current = { value: latest.current(), key, primed: true };
  }

  useEffect(() => {
    // Idempotent: a second call while one is pending is a no-op, which is what makes the single
    // cleanup below sufficient under a double-invoked effect.
    if (!stale || timer.current !== undefined) return;
    const wait = budget.current?.msUntilNextFrame() ?? 0;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      force((n) => n + 1);
    }, wait);
  });

  useEffect(
    () => (): void => {
      if (timer.current === undefined) return;
      clearTimeout(timer.current);
      timer.current = undefined;
    },
    [],
  );

  return state.current.value as T;
}
