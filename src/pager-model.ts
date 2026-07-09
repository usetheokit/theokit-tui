// M22 pager model (plan m22-interaction-primitives T3.1, ADR C1): the PURE
// scroll reducer — a faithful port of bubbles' viewport (viewport.go:200-342).
// State is `{ offset, viewportHeight, totalLines }`; the offset is always clamped
// to `[0, max(0, total - height)]`. Zero deps, zero ink — trivially unit-testable
// with a fake height (the deterministic-oracle DoD). The Pager component consumes
// this + renders the visible slice + a `line X/Y NN%` status line.

export interface PagerState {
  offset: number;
  viewportHeight: number;
  totalLines: number;
}

export type PagerAction =
  | { type: "line-up" }
  | { type: "line-down" }
  | { type: "page-up" }
  | { type: "page-down" }
  | { type: "half-up" }
  | { type: "half-down" }
  | { type: "goto-top" }
  | { type: "goto-bottom" }
  | { type: "resize"; viewportHeight: number; totalLines: number };

/** The largest valid offset (0 when the content fits the viewport). */
export function maxOffset(state: PagerState): number {
  return Math.max(0, state.totalLines - state.viewportHeight);
}

function clampOffset(state: PagerState, offset: number): PagerState {
  return { ...state, offset: Math.min(Math.max(0, offset), maxOffset(state)) };
}

const DELTAS: Record<
  Exclude<PagerAction["type"], "resize">,
  (state: PagerState) => number
> = {
  "line-up": (s) => s.offset - 1,
  "line-down": (s) => s.offset + 1,
  "page-up": (s) => s.offset - s.viewportHeight,
  "page-down": (s) => s.offset + s.viewportHeight,
  "half-up": (s) => s.offset - Math.floor(s.viewportHeight / 2),
  "half-down": (s) => s.offset + Math.floor(s.viewportHeight / 2),
  "goto-top": () => 0,
  "goto-bottom": (s) => maxOffset(s),
};

export function pagerReducer(
  state: PagerState,
  action: PagerAction,
): PagerState {
  if (action.type === "resize") {
    return clampOffset(
      {
        ...state,
        viewportHeight: action.viewportHeight,
        totalLines: action.totalLines,
      },
      state.offset,
    );
  }
  return clampOffset(state, DELTAS[action.type](state));
}

/** Fraction scrolled (0 at top, 1 at bottom; 1 when the content fits). */
export function scrollPercent(state: PagerState): number {
  const max = maxOffset(state);
  if (max === 0) {
    return 1;
  }
  return Math.min(Math.max(state.offset / max, 0), 1);
}

/** `[start, end)` line indices of the visible window. */
export function visibleRange(state: PagerState): [number, number] {
  return [state.offset, state.offset + state.viewportHeight];
}
