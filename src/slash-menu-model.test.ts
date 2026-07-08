import { describe, expect, it } from "vitest";

import { deriveSlashMenu } from "./slash-menu-model.js";
import type { SlashCommand } from "./slash-menu-model.js";

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
    expect(menu.open).toBe(true);
    // Line 1 only.
    const multi = deriveSlashMenu("/he\n/clear", CMDS, 0, false);
    expect(multi.filter).toBe("he");
    // Leading spaces after the slash are trimmed before tokenizing.
    const spaced = deriveSlashMenu("/  help", CMDS, 0, false);
    expect(spaced.filter).toBe("help");
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
    expect(menu.overflowUp).toBe(true);
    expect(menu.overflowDown).toBe(true); // row 8 still below
    const atEnd = deriveSlashMenu("/cmd", NINE, 8, false);
    expect(atEnd.windowStart).toBe(4);
    expect(atEnd.overflowDown).toBe(false);
    const atTop = deriveSlashMenu("/cmd", NINE, 0, false);
    expect(atTop.windowStart).toBe(0);
    expect(atTop.overflowUp).toBe(false);
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
    const source = readFileSync(
      new URL("./slash-menu-model.ts", import.meta.url),
      "utf8",
    );
    expect(source.match(/from "ink"/g)).toBeNull();
  });
});
