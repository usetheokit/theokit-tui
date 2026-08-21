import { describe, expect, it } from "vitest";
import type { SlashCommand } from "../../src/chat/slash-menu.js";
import { deriveSlashMenu } from "../../src/chat/slash-menu.js";

// M15 T1.1 (plan m15-composer-autocomplete, ADR D1): the PURE derivation —
// trigger/filter (codex command_popup.rs:93-117 token contract), prefix
// matching, selection clamp, sliding window (gemini SuggestionsDisplay
// reduced to 5 rows). No ink anywhere in this suite.

const CMDS: SlashCommand[] = [
  { name: "clear", description: "clear the thread" },
  { name: "help", description: "show help" },
  { name: "hello", description: "greet" },
];

const NINE: SlashCommand[] = Array.from({ length: 9 }, (_, i) => ({
  name: `cmd${i}`,
  description: `command ${i}`,
}));

describe("slash-menu-model (M15 T1.1)", () => {
  it("filter_token_follows_codex_contract", () => {
    const menu = deriveSlashMenu("/clear something", CMDS, 0, false);
    expect(menu.filter).toBe("clear");
    // `open` was asserted TRUE here and that was the bug, not the contract: with the menu open,
    // Enter completed the selection and replaced the line with the bare command, discarding
    // ` something`. The FILTER contract — first token after the slash — is what this test is for
    // and is unchanged. Measured against the reference: it shows the popup only while the caret is
    // inside the `/name` token (`is_editing_slash_command_name`).
    expect(menu.open).toBe(false);
    // Line 1 only.
    const multi = deriveSlashMenu("/he\n/clear", CMDS, 0, false);
    expect(multi.filter).toBe("he");
    // Leading spaces after the slash are trimmed before tokenizing.
    const spaced = deriveSlashMenu("/  help", CMDS, 0, false);
    expect(spaced.filter).toBe("help");
  });

  it("prefix_match_rejects_mid_name_substrings", () => {
    // Review r2-F1 (survived mutant): "el" is a SUBSTRING of help/hello
    // but a prefix of neither — the menu must not match.
    const menu = deriveSlashMenu("/el", CMDS, 0, false);
    expect(menu.open).toBe(false);
    expect(menu.matches).toHaveLength(0);
  });

  it("multiline_buffer_closes_the_menu", () => {
    // Review r2-F3: once the draft has a newline the user left command
    // mode — Enter must SUBMIT, never complete (the menu derives from
    // line 1 only and would stay stuck open otherwise).
    const menu = deriveSlashMenu("/he\nxy", CMDS, 0, false);
    expect(menu.open).toBe(false);
  });

  it("slash_not_at_line_start_never_opens", () => {
    // EC-1 (codex first-char contract).
    const menu = deriveSlashMenu("hello /wo", CMDS, 0, false);
    expect(menu.open).toBe(false);
    expect(menu.matches).toHaveLength(0);
  });

  it("prefix_matching_and_zero_match_closes", () => {
    const he = deriveSlashMenu("/he", CMDS, 0, false);
    expect(he.matches.map((m) => m.name)).toEqual(["help", "hello"]);
    const none = deriveSlashMenu("/zz", CMDS, 0, false);
    expect(none.open).toBe(false);
  });

  it("selection_clamps_when_filter_narrows", () => {
    // EC-3 (codex clamp_selection).
    const menu = deriveSlashMenu("/hel", CMDS, 2, false);
    expect(menu.matches.map((m) => m.name)).toEqual(["help", "hello"]);
    expect(menu.clampedIndex).toBe(1);
    const single = deriveSlashMenu("/help", CMDS, 2, false);
    expect(single.clampedIndex).toBe(0);
  });

  it("window_slides_and_flags_overflow", () => {
    const menu = deriveSlashMenu("/cmd", NINE, 7, false);
    expect(menu.matches).toHaveLength(9);
    expect(menu.windowStart).toBe(3); // keeps row 7 visible in a 5-window
    // B-076 — was `overflowUp/Down`, now the counts those booleans were derived from. Asserting
    // the NUMBER is strictly stronger: `toBe(true)` passed for 1 hidden row and for 40, so a
    // windowing regression that changed how many rows hid could not fail it.
    expect(menu.hiddenBefore).toBe(3);
    expect(menu.hiddenAfter).toBe(1); // row 8 still below
    const atEnd = deriveSlashMenu("/cmd", NINE, 8, false);
    expect(atEnd.windowStart).toBe(4);
    expect(atEnd.hiddenAfter).toBe(0);
    const atTop = deriveSlashMenu("/cmd", NINE, 0, false);
    expect(atTop.windowStart).toBe(0);
    expect(atTop.hiddenBefore).toBe(0);
  });

  it("the_menu_reports_how_many_rows_are_hidden", () => {
    // B-052 — the counts arrive via the `windowFor` spread and were unreachable through the type,
    // which hand-re-declared the window contract instead of extending `WindowView`. U-10: a
    // boolean cannot be turned back into a number, so the model has to report the count.
    const menu = deriveSlashMenu("/cmd", NINE, 7, false);
    expect(menu.hiddenBefore).toBe(3);
    expect(menu.hiddenAfter).toBe(1);
    const atTop = deriveSlashMenu("/cmd", NINE, 0, false);
    expect(atTop.hiddenBefore).toBe(0);
    expect(atTop.hiddenAfter).toBe(4);
  });

  it("the_closed_menu_cannot_be_mutated_through_the_reference_it_hands_out", () => {
    // B-052 review (F-tests-7 / F-wire-8) — `deriveSlashMenu` returns the SHARED `CLOSED_MENU` BY
    // REFERENCE at its early return, and one instance now serves both this menu and the
    // `@`-mention menu. The compile-time half is enforced by inference (`Object.freeze` returns
    // `Readonly<T>`, and the binding carries no annotation to discard it). This pins the RUNTIME
    // half: removing `Object.freeze` was measured to survive the entire suite.
    // The BY-REFERENCE path is `slash-menu.ts:83` — text that is not a slash menu at all.
    // `/zz` (no matches) takes the SPREAD path at `:92`, which correctly hands back a fresh
    // mutable object; measured, and the distinction is the point of this test.
    const closed = deriveSlashMenu("hello", CMDS, 0, false);
    expect(closed.open).toBe(false);
    expect(closed).toBe(deriveSlashMenu("world", CMDS, 0, false)); // same instance, shared
    expect(() => {
      (closed as { open: boolean }).open = true;
    }).toThrow(TypeError);
    expect(() => {
      (closed.matches as SlashCommand[]).push({ name: "x", description: "" });
    }).toThrow(TypeError);
    // The spread path is a different contract: a fresh, mutable copy each time.
    const spread = deriveSlashMenu("/zz", CMDS, 0, false);
    expect(spread).not.toBe(closed);
    expect(spread.open).toBe(false);
  });

  it("dismissed_reports_closed", () => {
    const menu = deriveSlashMenu("/he", CMDS, 0, true);
    expect(menu.open).toBe(false);
    // The latch RESET on filter change is the caller's job — the model
    // just reports the filter so the caller can compare.
    expect(menu.filter).toBe("he");
  });

  it("empty_commands_never_opens", () => {
    const menu = deriveSlashMenu("/he", [], 0, false);
    expect(menu.open).toBe(false);
  });

  it("bare_slash_lists_all_commands", () => {
    const menu = deriveSlashMenu("/", CMDS, 0, false);
    expect(menu.open).toBe(true);
    expect(menu.matches).toHaveLength(3);
    expect(menu.filter).toBe("");
  });

  it("model_module_is_pure_no_ink_import", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../../src/chat/slash-menu.ts", import.meta.url), "utf8");
    expect(source.match(/from "ink"/g)).toBeNull();
  });
});

/**
 * The menu must CLOSE once an argument begins.
 *
 * The filter is the first token after the slash, so `/sandbox read-only` still matched the command
 * `sandbox` and the menu stayed open — Enter then completed the selection instead of submitting,
 * REPLACING the line with the bare command and discarding the argument. Measured in a consumer
 * (TheoCode B-089) across `/export <path>`, `/delete <id>` and `/sandbox <mode>`; the last is silent,
 * because the command is accepted and the setting simply does not change.
 *
 * Typing a space after the command name is the user leaving command SELECTION and starting to write
 * an argument. There is nothing left to choose.
 */
describe("deriveSlashMenu — an argument closes the menu", () => {
  const commands = [
    { name: "sandbox", description: "" },
    { name: "sessions", description: "" },
  ];

  it("closes_once_a_space_follows_the_command", () => {
    expect(deriveSlashMenu("/sandbox read-only", commands, 0, false).open).toBe(false);
  });

  it("closes_on_the_trailing_space_that_starts_the_argument", () => {
    // The space IS the commitment: the user has chosen the command and is now typing its argument.
    expect(deriveSlashMenu("/sandbox ", commands, 0, false).open).toBe(false);
  });

  it("stays_open_while_the_name_is_still_being_typed", () => {
    // The floor: closing on a prefix would break completion itself.
    expect(deriveSlashMenu("/sand", commands, 0, false).open).toBe(true);
    expect(deriveSlashMenu("/s", commands, 0, false).matches).toHaveLength(2);
  });

  it("stays_open_on_the_bare_slash", () => {
    expect(deriveSlashMenu("/", commands, 0, false).open).toBe(true);
  });

  it("still_reports_the_filter_when_closed_by_an_argument", () => {
    // The dismissal latch reads `filter`; dropping it would make the menu reopen on the next
    // keystroke of the argument.
    expect(deriveSlashMenu("/sandbox read-only", commands, 0, false).filter).toBe("sandbox");
  });
});
