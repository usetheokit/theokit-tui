// M22 select-list model (plan m22-interaction-primitives T1.1, ADR A1/A2/A4):
// the PURE, ink-free windowed-list model that generalizes the M15 slash-menu +
// M21 mention-menu. `windowFor` is the DRY core — the EXACT M15 trailing-window
// clamp (`slash-menu-model.ts:75-78`), extracted so the slash + mention menus
// delegate to one authoritative site (behavior-preserving). `deriveSelectList`
// layers prefix|fuzzy filtering + multi-select BY VALUE (a Set<string>, not a
// matches-index — fuzzy re-orders matches). Zero deps beyond `fuzzy.ts`.

import { fuzzyMatch } from "../search/fuzzy.js";

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
  /** U-10 — how many rows sit above the window. `overflowUp` is `hiddenBefore > 0`. */
  hiddenBefore: number;
  /** U-10 — how many rows sit below the window. `overflowDown` is `hiddenAfter > 0`. */
  hiddenAfter: number;
  overflowUp: boolean;
  overflowDown: boolean;
}

/**
 * Where the selected row sits inside the window.
 *
 * `trailing` (the default, and the M15 behaviour) keeps it at the BOTTOM — right for a menu that
 * grows upward from a prompt. `centred` keeps it in the MIDDLE, which is what an overlay that walks
 * backwards through history needs: the rows on either side stay visible as you move.
 */
export type WindowAnchor = "trailing" | "centred";

/**
 * A window must be a positive integer, or the counts this module returns stop describing the list.
 *
 * B-021 ADR D1 — REFUSE, do not clamp. `window = 0` put `windowStart` PAST the selection so nothing
 * rendered while both arrows claimed rows; `window = -1` made the counts sum to 21 in a list of 20;
 * a fractional window hid seven and a half rows.
 *
 * Clamping was rejected because of why the counts exist at all: `windowFor` below records that U-10
 * replaced two booleans with numbers precisely because information was being destroyed. Clamping
 * destroys the caller's mistake instead, and they learn nothing.
 *
 * `component` is the name the CALLER recognises, so the message does not point at a model function
 * nobody called — the failure `src/agent/agent-timeline.tsx:62` identified.
 *
 * It THROWS and does not report. Reporting from here would import `src/status` — a feature folder —
 * into a module whose own header declares it pure with "zero deps beyond `fuzzy.ts`", inverting the
 * dependency direction `rules/architecture.md` § 1 holds. B-025 faced this exact choice for
 * `assertFiniteNonNegative` and DECLINED for the same reason (`src/metrics/usage-panel.tsx:117`);
 * this slice violated that ruling and review caught it. The reporting happens at the component
 * boundary, in the try/catch shape `usage-panel.tsx:121` already uses.
 *
 * @internal
 */
export function assertPositiveWindow(window: number, component: string): void {
  if (!Number.isInteger(window) || window <= 0) {
    throw new TypeError(
      `${component}: window must be a positive integer — got ${String(window)}`,
    );
  }
}

/**
 * The windowed view for a match count + selection.
 *
 * T3.4 — `anchor` is an OPTION rather than a second function. There was already exactly one
 * implementation of this clamp, exported and consumed; a sibling `windowAround` beside it would be
 * two implementations of one rule, disagreeing the first time either is touched (G12). The default
 * is the existing behaviour, because anything else silently re-anchors every list in every consumer
 * on upgrade.
 *
 * Byte-identical to `slash-menu-model.ts:69-87` for `count > 0` under the default anchor; a safe
 * no-op at `count === 0`.
 */
export function windowFor(
  count: number,
  selectionIndex: number,
  window: number,
  anchor: WindowAnchor = "trailing",
): WindowView {
  // ABOVE the empty-list return, deliberately. Below it, `windowFor(0, 10, -1)` succeeded while
  // `windowFor(20, 10, -1)` threw — the same invalid argument accepted or refused depending on data
  // unrelated to what is being validated. On the `deriveSelectList` path that meant an invalid
  // window crashed only once the filter matched something: a data-dependent failure far from the
  // mistake. Found independently by three reviewers (B-021 review: F-arch-3, F-wire-2, F-dom-3).
  assertPositiveWindow(window, "windowFor");
  if (count === 0) {
    return {
      clampedIndex: 0,
      windowStart: 0,
      hiddenBefore: 0,
      hiddenAfter: 0,
      overflowUp: false,
      overflowDown: false,
    };
  }
  const clampedIndex = Math.min(Math.max(selectionIndex, 0), count - 1);
  // How far above the selection the window opens. Trailing puts the selection on the last row;
  // centred puts it in the middle, biased UP on an even window so the row keeps more context ahead
  // of it than behind — which is the direction a list is usually read.
  const lead = anchor === "centred" ? Math.floor((window - 1) / 2) : window - 1;
  const windowStart = Math.min(
    Math.max(clampedIndex - lead, 0),
    Math.max(count - window, 0),
  );
  // U-10 — the counts are what this function already computed; the booleans are derived from them
  // rather than the other way round. Reporting only the booleans threw away information the caller
  // then had to recompute, by reimplementing this same arithmetic.
  const hiddenBefore = windowStart;
  const hiddenAfter = Math.max(count - (windowStart + window), 0);
  return {
    clampedIndex,
    windowStart,
    hiddenBefore,
    hiddenAfter,
    overflowUp: hiddenBefore > 0,
    overflowDown: hiddenAfter > 0,
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
  // `deriveSelectList` is PUBLIC (`src/prompts/index.ts:9`) and its `window` is a required,
  // unvalidated number — a fourth entry point the plan failed to enumerate. Without this it throws
  // naming `windowFor`, which is precisely the misattribution ADR D3 exists to prevent, left
  // unapplied on the one public path where it still bites (B-021 review: F-wire-1).
  assertPositiveWindow(opts.window, "deriveSelectList");
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
