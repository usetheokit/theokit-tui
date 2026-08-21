import { describe, expect, it } from "vitest";

import { parseKeypress } from "../../../src/renderer/input/parse-keypress.js";

// M19 T1.1 (plan m19-input-stack, ADR D2/D4): the keypress semantics — a
// faithful port of Ink's parse-keypress.js (legacy path; kitty is T3.1
// awareness-only). A framed byte sequence → {name, ctrl, meta, shift, sequence}.
// The composer's 12-field surface is projected from `name` (see key.ts).

describe("parseKeypress (M19 T1.1)", () => {
  it("parses_arrow_keys_csi_and_ss3", () => {
    expect(parseKeypress("\x1b[D").name).toBe("left");
    expect(parseKeypress("\x1b[C").name).toBe("right");
    expect(parseKeypress("\x1b[A").name).toBe("up");
    expect(parseKeypress("\x1b[B").name).toBe("down");
    expect(parseKeypress("\x1bOA").name).toBe("up"); // SS3 form
  });

  it("parses_ctrl_letter", () => {
    const k = parseKeypress("\x03"); // Ctrl+C
    expect(k.name).toBe("c");
    expect(k.ctrl).toBe(true);
  });

  it("parses_meta_char", () => {
    const k = parseKeypress("\x1bb"); // Alt+b
    expect(k.name).toBe("b");
    expect(k.meta).toBe(true);
  });

  it("parses_backspace_delete_tab_escape_return", () => {
    expect(parseKeypress("\x7f").name).toBe("backspace");
    expect(parseKeypress("\x1b[3~").name).toBe("delete");
    expect(parseKeypress("\t").name).toBe("tab");
    expect(parseKeypress("\x1b").name).toBe("escape");
    expect(parseKeypress("\r").name).toBe("return");
  });

  it("ctrl_j_is_enter_with_all_modifiers_false", () => {
    // The composer contract (chat-composer.tsx:78-79): Ctrl+J = \n, NOT return,
    // no ctrl/meta — so it inserts a newline in multiline mode.
    const k = parseKeypress("\n");
    expect(k.name).toBe("enter");
    expect(k.ctrl).toBe(false);
    expect(k.meta).toBe(false);
  });

  it("uppercase_letter_sets_shift", () => {
    const k = parseKeypress("A");
    expect(k.name).toBe("a");
    expect(k.shift).toBe(true);
  });

  it("lowercase_letter_is_the_name", () => {
    expect(parseKeypress("a").name).toBe("a");
  });

  it("shift_tab_is_tab", () => {
    expect(parseKeypress("\x1b[Z").name).toBe("tab");
  });

  it("backspace_variants_and_meta_backspace", () => {
    expect(parseKeypress("\b").name).toBe("backspace"); // Ctrl+H
    const meta = parseKeypress("\x1b\x7f"); // Alt+Backspace
    expect(meta.name).toBe("backspace");
    expect(meta.meta).toBe(true);
  });

  it("number_space_and_meta_return_and_double_escape", () => {
    expect(parseKeypress("5").name).toBe("number");
    expect(parseKeypress(" ").name).toBe("space");
    const metaReturn = parseKeypress("\x1b\r");
    expect(metaReturn.name).toBe("return");
    expect(metaReturn.meta).toBe(true);
    const dblEsc = parseKeypress("\x1b\x1b");
    expect(dblEsc.name).toBe("escape");
    expect(dblEsc.meta).toBe(true);
  });

  it("csi_modifier_encodes_ctrl_and_shift", () => {
    // ESC [ 1 ; 5 D = Ctrl+Left; ; 2 = Shift.
    const ctrlLeft = parseKeypress("\x1b[1;5D");
    expect(ctrlLeft.name).toBe("left");
    expect(ctrlLeft.ctrl).toBe(true);
    const shiftUp = parseKeypress("\x1b[1;2A");
    expect(shiftUp.shift).toBe(true);
  });

  it("rxvt_ctrl_and_shift_key_codes", () => {
    expect(parseKeypress("\x1bOa").ctrl).toBe(true); // rxvt Ctrl+Up code "Oa"
    expect(parseKeypress("\x1b[a").shift).toBe(true); // rxvt Shift+Up code "[a"
  });

  it("double_escape_function_key_sets_meta", () => {
    // ESC ESC [ D = Alt+Left (the fn-key double-escape → meta branch).
    const k = parseKeypress("\x1b\x1b[D");
    expect(k.name).toBe("left");
    expect(k.meta).toBe(true);
  });

  it("single_punctuation_char_has_empty_name_no_flags", () => {
    // A printable punctuation char matches no category → empty name, no flags
    // (it flows through as `input` for the composer to insert).
    const k = parseKeypress("!");
    expect(k.name).toBe("");
    expect(k.ctrl).toBe(false);
    expect(k.meta).toBe(false);
    expect(k.sequence).toBe("!");
  });
});
