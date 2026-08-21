import { describe, expect, it } from "vitest";

import { deriveMentionMenu, findMentionToken } from "../../src/chat/mention-menu.js";
import { textBufferReducer } from "../../src/chat/text-buffer.js";

// M21 T4.1 — the `@`-mention menu model + the complete-mention reducer action.

describe("findMentionToken (M21 T4.1)", () => {
  it("finds_a_mention_token_mid_line", () => {
    // "review @src/fo|o" — cursor after "src/fo".
    const text = "review @src/foo";
    expect(findMentionToken(text, text.length)).toEqual({
      start: 7,
      query: "src/foo",
    });
  });

  it("triggers_at_the_buffer_start", () => {
    expect(findMentionToken("@foo", 4)).toEqual({ start: 0, query: "foo" });
  });

  it("does_not_trigger_when_glued_to_a_word", () => {
    // an email-like "a@b" — the @ is preceded by a word char.
    expect(findMentionToken("a@b", 3)).toBeNull();
  });

  it("closes_after_whitespace_past_the_token", () => {
    expect(findMentionToken("@foo bar", 8)).toBeNull();
  });

  it("allows_spaces_inside_a_path_token_once_a_slash_appears", () => {
    // A path with spaces (`~/Área de Trabalho/`) stays ONE token — whitespace no
    // longer terminates once a `/` has been typed (Claude Code path parity).
    const text = "@~/Área de Trabalho/";
    expect(findMentionToken(text, text.length)).toEqual({
      start: 0,
      query: "~/Área de Trabalho/",
    });
  });

  it("a_space_before_the_first_slash_still_closes_the_token", () => {
    // "@foo bar" has no slash → the space still ends it (unchanged behavior).
    expect(findMentionToken("@foo bar and @x", 8)).toBeNull();
  });
});

describe("deriveMentionMenu (M21 T4.1)", () => {
  it("opens_with_ranked_candidates_for_the_active_token", () => {
    const menu = deriveMentionMenu("@foo", 4, ["src/foo.ts", "foo.md"], 0);
    expect(menu.open).toBe(true);
    expect(menu.filter).toBe("foo");
    expect(menu.matches.map((m) => m.name)).toEqual(["src/foo.ts", "foo.md"]);
  });

  it("is_closed_without_a_token_or_without_candidates", () => {
    expect(deriveMentionMenu("plain text", 5, ["a.ts"], 0).open).toBe(false);
    expect(deriveMentionMenu("@foo", 4, [], 0).open).toBe(false);
  });

  it("uses_an_empty_sigil_so_paths_render_bare_not_slash_prefixed", () => {
    // The menu reuses the slash renderer, which prepends a sigil before each
    // name. Slash commands want `/`; mentions carry the full path already, so
    // the sigil MUST be empty — `src/foo.ts`, never `/src/foo.ts`.
    const menu = deriveMentionMenu("@foo", 4, ["src/foo.ts"], 0);
    expect(menu.sigil).toBe("");
  });

  it("clamps_selection_and_windows_a_long_list", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => `f${i}.ts`);
    const menu = deriveMentionMenu("@f", 2, candidates, 99);
    expect(menu.clampedIndex).toBe(9);
    // B-076 — the count, not the boolean it was derived from.
    expect(menu.hiddenBefore).toBeGreaterThan(0);
  });
});

describe("complete-mention reducer action (M21 T4.1)", () => {
  it("replaces_the_token_with_the_path_and_a_trailing_space", () => {
    // "@fo|" (cursor at 3) → complete to "src/foo.ts ".
    const next = textBufferReducer(
      { text: "@fo", cursorOffset: 3 },
      { type: "complete-mention", path: "src/foo.ts", from: 0, to: 3 },
    );
    expect(next.text).toBe("src/foo.ts ");
    expect(next.cursorOffset).toBe("src/foo.ts ".length);
  });

  it("preserves_surrounding_text", () => {
    const next = textBufferReducer(
      { text: "see @fo now", cursorOffset: 7 },
      { type: "complete-mention", path: "foo.ts", from: 4, to: 7 },
    );
    expect(next.text).toBe("see foo.ts  now");
  });

  it("a_directory_path_keeps_the_at_sigil_and_no_trailing_space_so_navigation_continues", () => {
    // Selecting a directory (path ends with `/`) RE-INSERTS the `@` and drops
    // the trailing space, so `findMentionToken` still detects the token and the
    // user keeps navigating INTO the directory (Claude Code parity). A file
    // selection (below) instead drops the `@` and adds a space — mention done.
    const next = textBufferReducer(
      { text: "@~/Áre", cursorOffset: 6 },
      { type: "complete-mention", path: "~/Área de Trabalho/", from: 0, to: 6 },
    );
    expect(next.text).toBe("@~/Área de Trabalho/"); // `@` kept, no trailing space
    expect(next.cursorOffset).toBe("@~/Área de Trabalho/".length);
  });
});
