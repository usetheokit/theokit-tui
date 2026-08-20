import { describe, expect, it } from "vitest";

import { createElement } from "react";
import { render } from "ink-testing-library";

import { CodeBlock } from "./code-block.js";

// B-078 — what an UNTRUSTED code block can put on the terminal.
//
// `toCodeLines` sanitises its input, and until this slice the sanitiser removed SGR only. The
// question is not "does it strip colours" but "can a model's output reach the terminal as a control
// sequence", and the answer is measured here in BYTES rather than asserted.
//
// Byte assertions, not `toContain`, deliberately: B-055's first test records that a substring
// assertion is exactly what let four broken strippers pass for a whole slice.

const ESC = "";
const BEL = "";

/** Every 0x1B in `s`, as a count — the property that matters, independent of shape. */
const escapeCount = (s: string): number => s.split(ESC).length - 1;

const tick = (): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, 0);
  });

/**
 * Renders through **ink**, and that choice is load-bearing.
 *
 * B-078 — the first version of this file used this repo's own renderer
 * (`tests/renderer/itl-adapter`) and every test passed, including the one for a defect measured to
 * be live. The escapes are renderer-dependent: measured on the same input, ink's frame is
 * byte-for-byte identical to it (4 escape bytes for the ST form, 2 for the BEL form) while the
 * custom renderer's frame carries none.
 *
 * A test that measures the path where the defect is absent asserts nothing about the path where it
 * is present. This is a third variant of the family B-052 and B-072 belong to: not an oracle taken
 * from the code, not a fixture coupled to a moved literal, but the WRONG PATH measured.
 *
 * The sanitiser itself lands in `toCodeLines`, upstream of both renderers, so it protects either.
 */
const frameOf = async (code: string): Promise<string> => {
  const inst = render(createElement(CodeBlock, { code, language: "text" }));
  for (let i = 0; i < 8; i += 1) await tick();
  const frame = inst.lastFrame() ?? "";
  inst.unmount();
  return frame;
};

describe("CodeBlock — untrusted escape sequences (B-078)", () => {
  it("osc8_hyperlink_does_not_reach_the_frame", async () => {
    // Measured before the fix: the frame was BYTE-FOR-BYTE identical to this input, for the
    // ST-terminated and the BEL-terminated form alike. OSC 8 makes attacker text clickable, and
    // CVE-2023-46321 / CVE-2023-46322 (both CVSS 9.8) are what a hostile URI scheme does next.
    const st = `${ESC}]8;;https://evil.example/pwn${ESC}\\click${ESC}]8;;${ESC}\\`;
    const bel = `${ESC}]8;;https://evil.example/pwn${BEL}click${ESC}]8;;${BEL}`;

    expect(escapeCount(await frameOf(st))).toBe(0);
    expect(escapeCount(await frameOf(bel))).toBe(0);
  });

  it("osc52_clipboard_write_does_not_reach_the_frame", async () => {
    // This passes TODAY, and for the wrong reason: `ink@7.1.0` deliberately preserves every OSC
    // token, and OSC 52 only dies one layer below in `@alcalzone/ansi-tokenize`, which misparses it.
    // That is an undocumented dependency bug and `ink` is a caret range — so this test exists to
    // hold the line if that bug is ever fixed.
    //
    // It matters because clipboard WRITE is on by default on five of nine terminals read from their
    // own source: Windows Terminal, kitty, alacritty, WezTerm, Ghostty.
    const payload = `${ESC}]52;c;ZXZpbA==${BEL}tail`;

    expect(escapeCount(await frameOf(payload))).toBe(0);
  });

  it("osc52_clipboard_read_does_not_reach_the_frame", async () => {
    // The interrogation form. No terminal in the surveyed set answers it unprompted, so this is
    // defence in depth rather than the live threat — recorded as such instead of overstated.
    const payload = `${ESC}]52;c;?${BEL}`;

    expect(escapeCount(await frameOf(payload))).toBe(0);
  });

  it("a_lone_escape_byte_is_removed", async () => {
    // The NEGATIVE case (`rules/testing.md` § 4.1), and the one that decides the design. A
    // structural matcher for `OSC ... terminator` does not match an OSC that never terminates, so
    // something else has to. This is the shape of CVE-2022-46663 in `less`, whose one-line fix is
    // "End OSC8 hyperlink on invalid embedded escape sequence": an emitter or a filter is only as
    // safe as its ERROR handling.
    const truncated = `${ESC}]8;;`;

    expect(escapeCount(await frameOf(truncated))).toBe(0);
  });

  it("bracketed_plain_text_is_untouched", async () => {
    // The edge case mirroring `src/format/ansi.test.tsx` — the new pass must not start eating
    // content that was never an escape sequence.
    const frame = await frameOf("value [1m] and [;m end");

    expect(frame).toContain("value [1m] and [;m end");
  });

  it("tabs_and_newlines_survive", async () => {
    // The two C0 code points the backstop must NOT remove: `toCodeLines` splits on \n and expands
    // \t, so removing either would corrupt every code block rather than protect it.
    const frame = await frameOf("first\n\tindented");

    expect(frame).toContain("first");
    expect(frame).toContain("indented");
  });
});
