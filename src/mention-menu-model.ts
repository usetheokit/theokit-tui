import { SLASH_MENU_WINDOW, type SlashMenu } from "./slash-menu-model.js";

// M21 mention-menu (plan m21-premium-capabilities T4.1, Feature C / ADR C2/C3):
// the `@`-file-mention menu — a SIBLING of the `/`-command menu, sharing the
// SlashMenu shape + rendering. Unlike `/` (line-start, prefix — the M15 contract
// is left untouched), `@` triggers on the TOKEN containing the cursor (mid-line
// mentions) and its candidates are FUZZY-ranked file paths supplied by the async
// file-search provider. This model is pure: the caller fetches + ranks the paths
// and passes them in; the model finds the token, windows, and clamps.

const CLOSED: SlashMenu = Object.freeze({
  open: false,
  filter: "",
  matches: [],
  clampedIndex: 0,
  windowStart: 0,
  overflowUp: false,
  overflowDown: false,
});

export interface MentionToken {
  /** Offset of the `@`. */
  start: number;
  /** Text after the `@` up to the cursor (the fuzzy query). */
  query: string;
}

/**
 * The active `@`-mention token at the cursor, or null. `@` triggers only at the
 * start of a token (preceded by whitespace or the buffer start) and the token
 * ends at the first whitespace — so `review @src/foo and …` mentions `src/foo`.
 */
export function findMentionToken(
  text: string,
  cursor: number,
): MentionToken | null {
  for (let i = cursor - 1; i >= 0; i--) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      return null; // whitespace before an `@` → no active token here
    }
    if (ch === "@") {
      if (i === 0 || /\s/.test(text[i - 1]!)) {
        return { start: i, query: text.slice(i + 1, cursor) };
      }
      return null; // `@` glued to a word (e.g. an email) is not a mention
    }
  }
  return null;
}

/**
 * Derive the mention menu from the buffer + already-ranked candidate paths.
 * Returns a `SlashMenu` so it plugs into the existing `SlashMenuList` renderer.
 */
export function deriveMentionMenu(
  text: string,
  cursor: number,
  candidates: readonly string[],
  selectionIndex: number,
): SlashMenu {
  const token = findMentionToken(text, cursor);
  if (!token || candidates.length === 0) {
    return { ...CLOSED, filter: token?.query ?? "" };
  }
  const matches = candidates.map((path) => ({ name: path, description: "" }));
  const clampedIndex = Math.min(
    Math.max(selectionIndex, 0),
    matches.length - 1,
  );
  const windowStart = Math.min(
    Math.max(clampedIndex - (SLASH_MENU_WINDOW - 1), 0),
    Math.max(matches.length - SLASH_MENU_WINDOW, 0),
  );
  return {
    open: true,
    filter: token.query,
    matches,
    clampedIndex,
    windowStart,
    overflowUp: windowStart > 0,
    overflowDown: windowStart + SLASH_MENU_WINDOW < matches.length,
  };
}
