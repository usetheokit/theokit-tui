import { describe, expect, it } from "vitest";

import { projectKey } from "./key.js";

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
