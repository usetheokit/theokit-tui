/** State of the Esc-to-edit-a-previous-message ladder. */
export interface BacktrackState {
  armed: boolean;
  /** Index into previews, oldest first; -1 = armed with nothing selected. */
  selected: number;
  previews: readonly string[];
}

export type BacktrackAction =
  | { type: "prime"; previews: readonly string[] }
  | { type: "older" }
  | { type: "newer" }
  | { type: "reset" };

export const CLOSED_BACKTRACK: BacktrackState = Object.freeze({
  armed: false,
  selected: -1,
  previews: Object.freeze([] as string[]),
});

/**
 * `prime` sets `armed`, `selected` and `previews` in ONE transition, so the overlay can never be
 * armed with an empty list. `older` / `newer` on a closed state return the same object.
 */
export function backtrackReducer(state: BacktrackState, action: BacktrackAction): BacktrackState {
  switch (action.type) {
    case "prime":
      return action.previews.length === 0
        ? CLOSED_BACKTRACK
        : { armed: true, selected: -1, previews: action.previews };
    case "older": {
      if (!state.armed) return state;
      const next = state.selected < 0 ? state.previews.length - 1 : Math.max(state.selected - 1, 0);
      return next === state.selected ? state : { ...state, selected: next };
    }
    case "newer": {
      if (!state.armed || state.selected < 0) return state;
      const next = state.selected >= state.previews.length - 1 ? -1 : state.selected + 1;
      return { ...state, selected: next };
    }
    case "reset":
      return CLOSED_BACKTRACK;
    default:
      return state;
  }
}
