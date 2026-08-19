import { render } from "ink-testing-library";
import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { stripAnsi } from "./ansi.js";

const ESC = "";

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
