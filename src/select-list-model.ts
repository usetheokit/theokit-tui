// M22 select-list model (plan m22-interaction-primitives T1.1, ADR A1/A2/A4):
// the PURE, ink-free windowed-list model that generalizes the M15 slash-menu +
// M21 mention-menu. `windowFor` is the DRY core — the EXACT M15 trailing-window
// clamp (`slash-menu-model.ts:75-78`), extracted so the slash + mention menus
// delegate to one authoritative site (behavior-preserving). `deriveSelectList`
// layers prefix|fuzzy filtering + multi-select BY VALUE (a Set<string>, not a
// matches-index — fuzzy re-orders matches). Zero deps beyond `fuzzy.ts`.

import { fuzzyMatch } from "./fuzzy.js";

export interface SelectListItem {
  /** Stable identity (multi-select is keyed by this). */
  value: string;
  /** Displayed + matched text. */
  label: string;
  /** One-line dim description (optional). */
  description?: string;
}

/** The window/clamp/overflow result for a match count + selection. */
export interface WindowView {
  clampedIndex: number;
  windowStart: number;
  overflowUp: boolean;
  overflowDown: boolean;
}

/**
 * The M15 trailing window: the active row is kept visible at the BOTTOM of the
 * window (never past the tail, never negative). Byte-identical to
 * `slash-menu-model.ts:69-87` for `count > 0`; a safe no-op at `count === 0`.
 */
export function windowFor(
  count: number,
  selectionIndex: number,
  window: number,
): WindowView {
  if (count === 0) {
    return {
      clampedIndex: 0,
      windowStart: 0,
      overflowUp: false,
      overflowDown: false,
    };
  }
  const clampedIndex = Math.min(Math.max(selectionIndex, 0), count - 1);
  const windowStart = Math.min(
    Math.max(clampedIndex - (window - 1), 0),
    Math.max(count - window, 0),
  );
  return {
    clampedIndex,
    windowStart,
    overflowUp: windowStart > 0,
    overflowDown: windowStart + window < count,
  };
}

export interface SelectListView<
  Item extends SelectListItem,
> extends WindowView {
  open: boolean;
  filter: string;
  matches: Item[];
  /** Multi-select values (empty for single-select). */
  selected: ReadonlySet<string>;
}

export interface DeriveSelectListOptions<Item extends SelectListItem> {
  items: readonly Item[];
  filter: string;
  selectionIndex: number;
  window: number;
  /** Fuzzy rank (M21 `fuzzy.ts`) vs case-insensitive prefix. Default prefix. */
  fuzzy?: boolean;
  /** Multi-select values, carried across filter changes (ADR A2). */
  selected?: ReadonlySet<string>;
}

function filterItems<Item extends SelectListItem>(
  items: readonly Item[],
  filter: string,
  fuzzy: boolean,
): Item[] {
  if (filter === "") {
    return [...items];
  }
  if (!fuzzy) {
    const lower = filter.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().startsWith(lower));
  }
  return items
    .map((item) => ({ item, match: fuzzyMatch(filter, item.label) }))
    .filter((entry) => entry.match.matches)
    .sort((a, b) => a.match.score - b.match.score)
    .map((entry) => entry.item);
}

/** Derive the full SelectList view: filter → rank → window → multi-select. */
export function deriveSelectList<Item extends SelectListItem>(
  opts: DeriveSelectListOptions<Item>,
): SelectListView<Item> {
  const matches = filterItems(opts.items, opts.filter, opts.fuzzy === true);
  const view = windowFor(matches.length, opts.selectionIndex, opts.window);
  return {
    open: matches.length > 0,
    filter: opts.filter,
    matches,
    selected: opts.selected ?? new Set<string>(),
    ...view,
  };
}
