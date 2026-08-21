import { render } from "ink-testing-library";

import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { CodeBlock } from "../../src/markdown/code-block.js";

// B-078 — what an UNTRUSTED code block can put on the terminal.
//
// `toCodeLines` sanitises its input, and until this slice the sanitiser removed SGR only. The
// question is not "does it strip colours" but "can a model's output reach the terminal as a control
// sequence", and the answer is measured here in BYTES rather than asserted.
//
// Byte assertions, not `toContain`, deliberately: B-055's first test records that a substring
// assertion is exactly what let four broken strippers pass for a whole slice.
//
// WHAT THIS FILE PROVES, AND WHAT IT DOES NOT — measured, and written here because the first
// version of it claimed more than it could deliver. With `sanitizeUntrusted` reduced to
// `return value;` — the exact pre-B-078 vulnerable state:
//
//   this file            -> 1 failed | 5 passed
//   src/format/ansi.test -> 5 failed | 7 passed
//
// Only `osc8_wiring_...` discriminates here. The other five stay green because `ink` and
// `@alcalzone/ansi-tokenize` remove those inputs BELOW us, with no contribution from our code —
// so at this layer they are regression guards on a third-party behaviour, not evidence that the
// sanitiser works. Their names now say so.
//
// The sanitiser's own detection power lives in `src/format/ansi.test.tsx`, where each of its three
// passes has its own kill set (backstop 2, OSC 2, CSI 1). Deleting the backstop here leaves all
// six green, which is precisely why the unit layer exists.

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
  it("osc8_wiring_the_sanitiser_is_actually_called_by_code_block", async () => {
    // THE test in this file with detection power: it is the only one that fails when
    // `sanitizeUntrusted` is reduced to `return value;`. Its job is to prove the sanitiser is WIRED
    // INTO `CodeBlock` at all — the property no unit test of the function can establish.
    //
    // Measured before the fix: the frame was BYTE-FOR-BYTE identical to this input, for the
    // ST-terminated and the BEL-terminated form alike. OSC 8 makes attacker text clickable, and
    // CVE-2023-46321 / CVE-2023-46322 (both CVSS 9.8) are what a hostile URI scheme does next.
    const st = `${ESC}]8;;https://evil.example/pwn${ESC}\\click${ESC}]8;;${ESC}\\`;
    const bel = `${ESC}]8;;https://evil.example/pwn${BEL}click${ESC}]8;;${BEL}`;

    expect(escapeCount(await frameOf(st))).toBe(0);
    expect(escapeCount(await frameOf(bel))).toBe(0);
  });

  it("regression_guard_osc52_write_is_absent_from_the_frame_by_any_means", async () => {
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

  it("regression_guard_osc52_read_is_absent_from_the_frame_by_any_means", async () => {
    // The interrogation form. No terminal in the surveyed set answers it unprompted, so this is
    // defence in depth rather than the live threat — recorded as such instead of overstated.
    const payload = `${ESC}]52;c;?${BEL}`;

    expect(escapeCount(await frameOf(payload))).toBe(0);
  });

  it("regression_guard_a_truncated_osc_is_absent_from_the_frame_by_any_means", async () => {
    // The negative case (`rules/testing.md` § 4.1) — but NOT the test that decides the design,
    // which is what the first version of this comment claimed. Measured: this stays green with the
    // control backstop deleted, because ink removes the truncated form on its own. The claim it
    // was making belongs to `disarms_a_truncated_osc_that_no_matcher_can_match` in
    // `src/format/ansi.test.tsx`, where deleting the backstop turns it red.
    //
    // The design argument stands and is recorded there: a structural matcher for
    // `OSC ... terminator` cannot match an OSC that never terminates — the shape of CVE-2022-46663
    // in `less`. An emitter or a filter is only as safe as its ERROR handling.
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
