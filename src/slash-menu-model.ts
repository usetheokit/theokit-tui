// M15 slash-menu model (plan m15-composer-autocomplete, ADR D1): PURE
// derivation of the slash menu from the composer buffer — trigger/filter
// per codex's contract (command_popup.rs:93-117: the FIRST token after a
// leading '/' on the FIRST line filters), prefix matching, selection
// clamp (codex clamp_selection) and a 5-row sliding window (gemini
// SuggestionsDisplay reduced). Zero deps, zero ink.

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
  if (!firstLine.startsWith("/") || commands.length === 0) {
    return CLOSED;
  }
  // codex token contract: first whitespace-delimited token after the
  // slash (leading spaces trimmed) — `/clear something` filters "clear".
  const filter = firstLine.slice(1).trimStart().split(/\s+/, 1)[0] ?? "";
  const matches = commands.filter((command) => command.name.startsWith(filter));
  if (dismissed || matches.length === 0) {
    return { ...CLOSED, filter };
  }
  const clampedIndex = Math.min(
    Math.max(selectionIndex, 0),
    matches.length - 1,
  );
  // Slide the window to keep the active row visible (gemini scrollOffset
  // reduced): never past the tail, never negative.
  const windowStart = Math.min(
    Math.max(clampedIndex - (SLASH_MENU_WINDOW - 1), 0),
    Math.max(matches.length - SLASH_MENU_WINDOW, 0),
  );
  return {
    open: true,
    filter,
    matches,
    clampedIndex,
    windowStart,
    overflowUp: windowStart > 0,
    overflowDown: windowStart + SLASH_MENU_WINDOW < matches.length,
  };
}
