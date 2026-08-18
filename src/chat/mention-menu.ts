import { windowFor } from "../prompts/select-list-model.js";
import { SLASH_MENU_WINDOW, type SlashMenu } from "./slash-menu.js";

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
 * start of a token (preceded by whitespace or the buffer start). The token ends
 * at the first whitespace — EXCEPT once a `/` has been seen (path mode), so a
 * path with spaces (`@~/Área de Trabalho/`) stays one token (Claude Code parity).
 * `review @src/foo and …` still mentions `src/foo`.
 */
export function findMentionToken(
  text: string,
  cursor: number,
): MentionToken | null {
  let sawSlash = false;
  for (let i = cursor - 1; i >= 0; i--) {
    const ch = text[i]!;
    if (ch === "/") {
      sawSlash = true;
    }
    if (/\s/.test(ch) && !sawSlash) {
      return null; // whitespace before any `/` → the token has ended
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
  return {
    open: true,
    filter: token.query,
    matches,
    sigil: "", // paths are whole; no `/` sigil (unlike the slash menu)
    ...windowFor(matches.length, selectionIndex, SLASH_MENU_WINDOW),
  };
}
