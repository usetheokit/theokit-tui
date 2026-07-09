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

import { windowFor } from "./select-list-model.js";

export interface SlashCommand {
  /** Command name WITHOUT the slash (e.g. "help"). */
  name: string;
  /** One-line description rendered dim next to the name. */
  description: string;
}

export interface SlashMenu {
  /** True when the menu should render. */
  open: boolean;
  /** The filter token (text after `/` up to the first whitespace). */
  filter: string;
  /** Commands whose name starts with the filter, in declared order. */
  matches: SlashCommand[];
  /** Selection index clamped into the matches range. */
  clampedIndex: number;
  /** First visible row of the 5-row window. */
  windowStart: number;
  /** Rows hidden above/below the window. */
  overflowUp: boolean;
  overflowDown: boolean;
  /** Sigil rendered before each name. Slash commands use `/` (the default when
   * omitted); the `@`-mention menu sets `""` since the path is already whole. */
  sigil?: string;
}

export const SLASH_MENU_WINDOW = 5;

const CLOSED: SlashMenu = Object.freeze({
  open: false,
  filter: "",
  matches: [],
  clampedIndex: 0,
  windowStart: 0,
  overflowUp: false,
  overflowDown: false,
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
    return CLOSED;
  }
  // codex token contract: first whitespace-delimited token after the
  // slash (leading spaces trimmed) — `/clear something` filters "clear".
  const filter = firstLine.slice(1).trimStart().split(/\s+/, 1)[0] ?? "";
  const matches = commands.filter((command) => command.name.startsWith(filter));
  if (dismissed || multiline || matches.length === 0) {
    return { ...CLOSED, filter };
  }
  // Window/clamp/overflow via the shared M15 trailing-window (M22 DRY collapse).
  return {
    open: true,
    filter,
    matches,
    ...windowFor(matches.length, selectionIndex, SLASH_MENU_WINDOW),
  };
}
