import { describe, expect, it } from "vitest";

import { projectKey } from "../../../src/renderer/input/key.js";

// M19 T1.1: the 12-field Key + input projection — the composer compat contract.

describe("projectKey (M19 T1.1)", () => {
  it("projects_arrows_to_the_12_fields", () => {
    expect(projectKey("\x1b[D").key.leftArrow).toBe(true);
    expect(projectKey("\x1b[C").key.rightArrow).toBe(true);
    expect(projectKey("\x1b[A").key.upArrow).toBe(true);
    expect(projectKey("\x1b[B").key.downArrow).toBe(true);
  });

  it("printable_char_flows_as_input_with_no_flags", () => {
    const { input, key } = projectKey("a");
    expect(input).toBe("a");
    expect(key.ctrl).toBe(false);
    expect(key.meta).toBe(false);
  });

  it("ctrl_j_newline_is_input_newline_all_flags_false", () => {
    // The composer contract: Ctrl+J inserts a newline (input "\n", no flags).
    const { input, key } = projectKey("\n");
    expect(input).toBe("\n");
    expect(key.return).toBe(false);
    expect(key.ctrl).toBe(false);
    expect(key.meta).toBe(false);
  });

  it("special_keys_blank_the_input", () => {
    expect(projectKey("\x1b[D").input).toBe(""); // arrow → no printable
    expect(projectKey("\x7f").input).toBe(""); // backspace → no printable
    expect(projectKey("\t").input).toBe(""); // tab → no printable
  });

  it("ctrl_letter_input_is_the_letter", () => {
    const { input, key } = projectKey("\x03"); // Ctrl+C
    expect(input).toBe("c");
    expect(key.ctrl).toBe(true);
  });

  it("uppercase_sets_shift", () => {
    const { input, key } = projectKey("A");
    expect(input).toBe("A");
    expect(key.shift).toBe(true);
  });

  it("return_and_backspace_and_delete_and_escape_flags", () => {
    expect(projectKey("\r").key.return).toBe(true);
    expect(projectKey("\x7f").key.backspace).toBe(true);
    expect(projectKey("\x1b[3~").key.delete).toBe(true);
    expect(projectKey("\x1b").key.escape).toBe(true);
    expect(projectKey("\t").key.tab).toBe(true);
  });

  it("meta_char_sets_meta", () => {
    expect(projectKey("\x1bb").key.meta).toBe(true);
  });
});

/**
 * Home/End were parsed and then discarded. `parseKeypress` maps every terminal form of them
 * (`[H`/`[1~`/`[7~`/`OH` and `[F`/`[4~`/`[8~`/`OF`) to the names "home"/"end", those names are in
 * `nonAlphanumericKeys` so `input` is blanked, and `projectKey` carried no field for either — so
 * the key reached the composer as nothing at all and the cursor did not move.
 *
 * Measured in a consumer (TheoCode B-068) by A/B against another terminal agent through the same
 * tmux channel: the identical byte sequences moved that cursor and were dropped here.
 *
 * The reducer actions these drive (`move-home`/`move-end`) already existed and are already bound to
 * ctrl+a/ctrl+e, so this connects a built capability rather than adding one.
 */
describe("projectKey — Home and End", () => {
  it("projects_home_in_every_terminal_form", () => {
    for (const seq of ["\x1b[H", "\x1b[1~", "\x1b[7~", "\x1bOH"]) {
      expect(projectKey(seq).key.home, `sequence ${JSON.stringify(seq)}`).toBe(true);
    }
  });

  it("projects_end_in_every_terminal_form", () => {
    for (const seq of ["\x1b[F", "\x1b[4~", "\x1b[8~", "\x1bOF"]) {
      expect(projectKey(seq).key.end, `sequence ${JSON.stringify(seq)}`).toBe(true);
    }
  });

  it("home_and_end_insert_no_text", () => {
    // The floor: a motion key that also typed a character would be worse than one that does
    // nothing. `nonAlphanumericKeys` already blanks these; this pins it.
    expect(projectKey("\x1b[H").input).toBe("");
    expect(projectKey("\x1b[F").input).toBe("");
  });

  it("home_and_end_are_not_set_by_other_keys", () => {
    for (const seq of ["\x1b[D", "\x1b[C", "\x1b[A", "\x1b[B", "a"]) {
      const { key } = projectKey(seq);
      expect(key.home, `sequence ${JSON.stringify(seq)}`).toBe(false);
      expect(key.end, `sequence ${JSON.stringify(seq)}`).toBe(false);
    }
  });
});
