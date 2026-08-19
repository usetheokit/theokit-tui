// M15 slash-menu model (plan m15-composer-autocomplete, ADR D1): PURE
// derivation of the slash menu from the composer buffer — trigger/filter
// per codex's contract (command_popup.rs:93-117: the FIRST token after a
// leading '/' on the FIRST line filters), prefix matching, selection
// clamp (codex clamp_selection) and a 5-row sliding window (gemini
// SuggestionsDisplay reduced). Zero deps, zero ink.
//
// M22: the window/clamp/overflow math is now delegated to the shared
// `windowFor` (select-list-model.ts) — one authoritative site for the slash +
// mention + SelectList windows (DRY). The trigger/filter contract is unchanged.

import { windowFor, type WindowView } from "../prompts/select-list-model.js";

export interface SlashCommand {
  /** Command name WITHOUT the slash (e.g. "help"). */
  name: string;
  /** One-line description rendered dim next to the name. */
  description: string;
}

/**
 * B-052 — the window contract is INHERITED from `WindowView`, never re-declared. It used to be
 * copied by hand, which omitted `hiddenBefore` / `hiddenAfter`: the `windowFor` spread below
 * widened the value and this type narrowed it back, so the renderer drew a bare arrow over counts
 * it already held. U-10 — a boolean cannot be turned back into a number.
 */
export interface SlashMenu extends WindowView {
  /** True when the menu should render. */
  open: boolean;
  /** The filter token (text after `/` up to the first whitespace). */
  filter: string;
  /** Commands whose name starts with the filter, in declared order. `readonly` because
   * `CLOSED_MENU` is a shared frozen instance that escapes to callers by reference. */
  matches: readonly SlashCommand[];
  /** Sigil rendered before each name. Slash commands use `/` (the default when
   * omitted); the `@`-mention menu sets `""` since the path is already whole. */
  sigil?: string;
}

export const SLASH_MENU_WINDOW = 5;

/**
 * The closed menu, shared by BOTH menus that use this shape (`mention-menu.ts` imports it).
 *
 * B-052 review — the window half is taken from `windowFor`'s own empty-list branch instead of
 * being written out again. Two frozen literals used to hand-copy those six fields, and adding the
 * counts made each copy LONGER: the same duplication the interface change removed, one layer down.
 * Deliberately module-internal — `src/chat/index.ts` does not re-export it, so this adds nothing
 * to the published surface.
 *
 * Frozen SHALLOW, and `matches` is frozen too because this object escapes to callers by reference
 * at `deriveSlashMenu`'s early return, not only by spread.
 *
 * **No `: SlashMenu` annotation, deliberately.** `Object.freeze` returns `Readonly<T>`; annotating
 * the binding discards it, so only the fields declared `readonly` on the interface stay protected
 * and the other eight typecheck as writable while throwing at runtime — a data-dependent failure
 * (B-052 review, F-arch-4). Inferring the type keeps every field read-only at compile time, and
 * `tsc --noEmit` was measured clean at every existing use site: assignment, spread and return.
 */
export const CLOSED_MENU = Object.freeze({
  open: false,
  filter: "",
  matches: Object.freeze([]),
  ...windowFor(0, 0, SLASH_MENU_WINDOW),
});

/**
 * Derives the menu state from the buffer text. The dismissal LATCH is the
 * caller's state — a dismissed menu reports `open: false` while still
 * exposing `filter` so the caller can reset the latch when it changes.
 */
export function deriveSlashMenu(
  text: string,
  commands: readonly SlashCommand[],
  selectionIndex: number,
  dismissed: boolean,
): SlashMenu {
  const firstLine = text.split("\n", 1)[0] ?? "";
  // A multiline draft left command mode (review r2-F3): the menu derives
  // from line 1 only and would sit stuck open while Enter hijacked the
  // submit into a completion. The filter is still reported for the latch.
  const multiline = text.includes("\n");
  if (!firstLine.startsWith("/") || commands.length === 0) {
    return CLOSED_MENU;
  }
  // codex token contract: first whitespace-delimited token after the
  // slash (leading spaces trimmed) — `/clear something` filters "clear".
  const afterSlash = firstLine.slice(1).trimStart();
  const filter = afterSlash.split(/\s+/, 1)[0] ?? "";
  const matches = commands.filter((command) => command.name.startsWith(filter));
  // An ARGUMENT has begun: the user typed a space after the command name, which is them leaving
  // selection and starting to write the argument. There is nothing left to choose, and leaving the
  // menu open means Enter completes instead of submitting — REPLACING the line with the bare
  // command and discarding what was typed. Measured in a consumer across `/export <path>`,
  // `/delete <id>` and `/sandbox <mode>`; the last failed silently, which is the worst shape for a
  // setting about what an agent may do to a disk (TheoCode B-089).
  const argumentStarted = afterSlash.length > filter.length;
  if (dismissed || multiline || argumentStarted || matches.length === 0) {
    return { ...CLOSED_MENU, filter };
  }
  // Window/clamp/overflow via the shared M15 trailing-window (M22 DRY collapse).
  return {
    open: true,
    filter,
    matches,
    ...windowFor(matches.length, selectionIndex, SLASH_MENU_WINDOW),
  };
}
