import { render } from "ink-testing-library";
import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { sanitizeUntrusted, stripAnsi } from "./ansi.js";

const ESC = "";
const BEL = String.fromCharCode(7);

describe("stripAnsi (B-055)", () => {
  it("removes_the_escape_bytes_not_just_the_parameters", () => {
    // The defect this module exists to end: four sites in this repo spelled the pattern
    // `/\[[0-9;]*m/g` — a `/` straight into `\[`, with no ESC. Measured against the shipped
    // Banner, that leaves all 8 escape bytes in place while deleting the SGR parameters, so the
    // frame LOOKS stripped in a substring assertion and is not.
    const instance = render(<Text color="cyan">hello</Text>);
    const raw = instance.lastFrame() ?? "";
    instance.unmount();

    expect(raw.split(ESC).length - 1).toBeGreaterThan(0); // the fixture really is coloured
    const stripped = stripAnsi(raw);
    expect(stripped.split(ESC).length - 1).toBe(0);
    expect(stripped).toContain("hello");
  });

  it("leaves_bracketed_plain_text_alone", () => {
    // The negative case (rules/testing.md § 4.1) the whole suite was missing. An ESC-less
    // pattern eats content that was never an escape sequence: measured, it turns this input
    // into "value ] and  end".
    const input = "value [1m] and [;m end";
    expect(stripAnsi(input)).toBe(input);
  });

  it("is_sgr_only_and_leaves_an_osc_hyperlink_intact", () => {
    // ADR D2 — today's semantics are SGR-only, matching all 39 sites this module replaces.
    // Widening to the OSC families is a behaviour change to a shipped sanitiser
    // (`markdown/code-block.tsx:184` sanitises untrusted input) and is registered as B-078.
    // Pinning it here means that widening has to change a test on purpose.
    const osc8 = `${ESC}]8;;https://example.com${ESC}\\link${ESC}]8;;${ESC}\\`;
    expect(stripAnsi(osc8)).toBe(osc8);

    // And an SGR wrapped around an OSC still goes, so this is scope, not incapacity.
    expect(stripAnsi(`${ESC}[31m${osc8}${ESC}[39m`)).toBe(osc8);
  });

  it("is_sgr_only_and_leaves_other_csi_sequences_intact", () => {
    // B-055 review (F-tests-1) — the OSC test above cannot discriminate a CSI widening, because
    // its fixture is built entirely from `ESC ]`. Measured: a third mutant broadening the pattern
    // to every CSI final byte (`[0-9;]*[a-zA-Z]`) SURVIVED all four tests and 149 more across the
    // six most-migrated files. So ADR D2's safeguard — "widening must change a test on purpose" —
    // was true for OSC and false for CSI, on a helper whose one production caller sanitises
    // UNTRUSTED input.
    const cursorMoves = `${ESC}[2J${ESC}[1;1H${ESC}[?25l`;
    expect(stripAnsi(cursorMoves)).toBe(cursorMoves);
    expect(stripAnsi(`${ESC}[31m${cursorMoves}${ESC}[39m`)).toBe(cursorMoves);
  });

  it("joins_adjacent_colour_runs_so_a_bar_reads_as_one_string", () => {
    // The contract `metrics/progress-bar.test.tsx:7` already documented in a comment —
    // "Full ANSI strip incl. ESC, so adjacent color runs (filled + empty) join."
    expect(stripAnsi(`${ESC}[32m###${ESC}[39m${ESC}[90m...${ESC}[39m`)).toBe(
      "###...",
    );
  });
});

describe("sanitizeUntrusted (B-078)", () => {
  // Unit-level on purpose. The end-to-end tests in `markdown/code-block-escapes.test.tsx` render
  // through ink, and ink removes some of these on its own — so a renderer test cannot tell which
  // pass of this function is doing the work. Measured: with the control backstop deleted, all six
  // of those end-to-end tests still passed. Here each pass is asserted separately, so a regression
  // names which one broke.
  //
  // DETECTION POWER, MEASURED — and written HERE rather than only in a commit message, because a
  // commit message is not read by the person editing this file, and `BACKLOG.md` is gitignored so
  // evidence living only there does not survive the machine. Delete one `.replace(...)` from
  // `sanitizeUntrusted` and re-run THIS file:
  //
  //   .replace(CONTROL_RE, "") removed  -> 2 failed | 10 passed
  //   .replace(OSC_RE, "")     removed  -> 2 failed | 10 passed
  //   .replace(CSI_RE, "")     removed  -> 1 failed |  11 passed
  //   nothing removed                   -> 12 passed
  //
  // Each pass has its own kill set, which is the property that makes this file worth having. The
  // end-to-end layer gives 0 failed for the first of those three.

  it("removes_an_osc_string_terminated_either_way", () => {
    expect(sanitizeUntrusted(`${ESC}]8;;https://evil${ESC}\\x`)).toBe("x");
    expect(sanitizeUntrusted(`${ESC}]52;c;ZXZpbA==${BEL}x`)).toBe("x");
  });

  it("does_not_collapse_two_osc_strings_into_one_match", () => {
    // Non-greedy, and this is what proves it: a greedy matcher would swallow `keep` along with
    // both sequences and return only the tail.
    const two = `${ESC}]8;;a${BEL}keep${ESC}]8;;${BEL}tail`;
    expect(sanitizeUntrusted(two)).toBe("keeptail");
  });

  it("removes_csi_sequences_whatever_the_final_byte", () => {
    expect(sanitizeUntrusted(`${ESC}[2J${ESC}[1;1H${ESC}[?25lx`)).toBe("x");
    expect(sanitizeUntrusted(`${ESC}[31mred${ESC}[39m`)).toBe("red");
  });

  it("disarms_a_truncated_osc_that_no_matcher_can_match", () => {
    // THE test for the backstop, and the reason it exists. A structural matcher for
    // `OSC … terminator` cannot match an OSC that never terminates — the shape of CVE-2022-46663
    // in `less`. A stateless character filter can, and cannot desynchronise the way a parser did.
    //
    // The residue is INERT TEXT, not nothing, and that is the right outcome rather than a
    // shortfall: the escape byte is gone so the terminal reads it as characters, and what remains
    // shows the reader what was in the input. Deleting it too would hide the attempt, and would
    // mean guessing how far a sequence "would have" run — which is the guessing this design
    // refuses.
    expect(sanitizeUntrusted(`${ESC}]8;;`)).toBe("]8;;");
    expect(sanitizeUntrusted(`before${ESC}]52;c;`)).toBe("before]52;c;");

    // The property that actually matters, asserted as itself.
    for (const truncated of [`${ESC}]8;;`, `before${ESC}]52;c;`, `${ESC}[`]) {
      expect(sanitizeUntrusted(truncated)).not.toContain(ESC);
    }
  });

  it("removes_the_8_bit_c1_forms_too", () => {
    // U+009D is 8-bit OSC, U+009B is 8-bit CSI: an alternative spelling of the same sequences that
    // neither matcher above sees, because both are anchored on ESC.
    expect(sanitizeUntrusted("\u009D52;c;ZXZpbA==\u009Cx")).toBe(
      "52;c;ZXZpbA==x",
    );
    expect(sanitizeUntrusted("a\u009Bb")).toBe("ab");
  });

  it("keeps_the_three_control_bytes_a_code_block_needs", () => {
    // Negative-space assertion: `toCodeLines` splits on newlines and expands tabs, so removing
    // these would corrupt every code block rather than protect one.
    expect(sanitizeUntrusted("a\tb\nc\r")).toBe("a\tb\nc\r");
  });

  it("leaves_bracketed_plain_text_alone", () => {
    expect(sanitizeUntrusted("value [1m] and [;m end")).toBe(
      "value [1m] and [;m end",
    );
  });
});
