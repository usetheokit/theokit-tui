import { useEffect, useRef } from "react";

/**
 * Invoke a callback only when a level RISES through a caller-supplied ordering.
 *
 * This package ships the channels for telling a user something — `Toast`, `Notice`, `notify` — and
 * none of them enforces when to use one. `notify` writes a bell on every call; `Toast` disciplines
 * dismissal, not firing. So the rule "say it when it gets worse, and only then" is re-derived by
 * hand at every call site, and two parts of it fail SILENTLY:
 *
 * - reading the previous level after overwriting it makes `previous === level` always, so the
 *   warning never fires;
 * - a hand-written escalation boolean needs one clause per upward pair, and omitting one means the
 *   URGENT warning never arrives while the first one still does — so the user has been told once
 *   and now believes they are being told.
 *
 * Both produce "the warning does not appear", which is invisible because an absent warning looks
 * like an absent problem.
 *
 * **It owns no thresholds, no classifier and no copy.** Deciding WHICH level you are at is the
 * caller's policy and, for the measured consumer, lives in a different package entirely. This hook
 * only knows that one level ranks above another.
 */
export function useRisingEdge<L extends string>(
  level: L,
  /**
   * The levels, LEAST severe first. A caller passing them descending gets warnings on recovery and
   * silence on escalation — the name states the direction because no type can catch that.
   */
  severityAscending: readonly L[],
  onRise: (level: L) => void,
): void {
  // Validated in the RENDER body, not the effect, and that placement is load-bearing — but the
  // reason written here was wrong until 2026-08-18 and is worth correcting rather than deleting.
  //
  // It said React does not surface an effect throw as a rejection. Measured under a real ink
  // render, an effect throw DOES reach ink's error boundary and produces the same ERROR panel a
  // render throw does. What is true is narrower: under `renderFrame` / `ink-testing-library` the
  // two are indistinguishable — both yield an empty frame — so a test of an effect throw could not
  // tell a fired guard from a silent one. Render-body validation is synchronous, so a test calling
  // this hook directly reaches the throw and can assert its message.
  const rank = severityAscending.indexOf(level);
  if (rank === -1) {
    throw new TypeError(
      `useRisingEdge: level "${level}" is not in the ordering [${severityAscending.join(", ")}]`,
    );
  }

  // Held in a ref rather than depended on, the idiom `Toast` already uses here: callers pass an
  // inline arrow, and depending on it would re-run the effect every render.
  const onRiseRef = useRef(onRise);
  onRiseRef.current = onRise;

  const previous = useRef<number | undefined>(undefined);

  useEffect(() => {
    const before = previous.current;
    previous.current = rank;
    // The first observed level never fires: there is no previous level to have risen from, and
    // firing would warn about a state the user has not entered.
    if (before === undefined || rank <= before) return;
    onRiseRef.current(level);
    // `level` is derived from `rank`, and depending on both would re-run when a caller renames a
    // level without changing its position. Depending on `rank` alone is what makes a fall-then-rise
    // re-arm rather than firing twice at the top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rank]);
}
