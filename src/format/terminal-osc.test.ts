import { describe, expect, it } from "vitest";

import {
  osc8Link,
  setTerminalTitle,
  supportsHyperlinks,
} from "./terminal-osc.js";

// M25 T4.1 — the terminal-title + OSC-8 hyperlink helpers (blueprint ADR D),
// mirroring notify.ts: pure, injectable env/out, no-op / degrade off-TTY or under
// a multiplexer (never leak raw escape bytes into a pipe or a multiplexer stream).

function fakeOut() {
  const writes: string[] = [];
  return {
    isTTY: true as boolean,
    write: (s: string): void => {
      writes.push(s);
    },
    writes,
  };
}

describe("setTerminalTitle (M25 T4.1)", () => {
  it("writes_the_osc0_title_sequence_on_a_tty", () => {
    const out = fakeOut();
    setTerminalTitle("theokit — build", out);
    expect(out.writes).toEqual(["\x1b]0;theokit — build\x07"]);
  });

  it("is_a_noop_off_tty", () => {
    const out = fakeOut();
    out.isTTY = false;
    setTerminalTitle("x", out);
    expect(out.writes).toEqual([]);
  });
});

describe("supportsHyperlinks (M25 T4.1)", () => {
  it("true_on_a_plain_tty", () => {
    expect(supportsHyperlinks({}, { isTTY: true })).toBe(true);
  });

  it("false_off_tty", () => {
    expect(supportsHyperlinks({}, { isTTY: false })).toBe(false);
  });

  it("false_under_a_multiplexer", () => {
    expect(supportsHyperlinks({ TMUX: "x" }, { isTTY: true })).toBe(false);
    expect(supportsHyperlinks({ STY: "x" }, { isTTY: true })).toBe(false);
    expect(supportsHyperlinks({ ZELLIJ: "0" }, { isTTY: true })).toBe(false);
  });
});

describe("osc8Link (M25 T4.1)", () => {
  it("wraps_text_in_the_osc8_sequence_when_supported", () => {
    const link = osc8Link("docs", "https://theo.dev", {}, { isTTY: true });
    expect(link).toBe("\x1b]8;;https://theo.dev\x07docs\x1b]8;;\x07");
  });

  it("returns_plain_text_off_tty", () => {
    const link = osc8Link("docs", "https://theo.dev", {}, { isTTY: false });
    expect(link).toBe("docs");
  });

  it("returns_plain_text_under_a_multiplexer", () => {
    const link = osc8Link(
      "docs",
      "https://theo.dev",
      { TMUX: "x" },
      { isTTY: true },
    );
    expect(link).toBe("docs");
  });
});

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

describe("terminal-osc — a caller value cannot open a second sequence (B-086)", () => {
  // Measured before the fix, as emitted bytes rather than as an argument. `setTerminalTitle` with
  // a BEL in the title produced:
  //
  //   1b5d303b6f6b07  1b5d35323b633b5a585a7062413d3d07  07
  //   ESC ] 0 ; ok BEL | ESC ] 5 2 ; c ; ZXZpbA== BEL | BEL
  //
  // The title sequence terminates at `ok`, and what follows is a COMPLETE OSC 52 clipboard write —
  // not a corrupted string, a second command. Clipboard write is on by default on five of nine
  // terminals read from their own source. This is CVE-2026-47090's shape in our own code.
  //
  // DETECTION POWER, MEASURED, written here rather than only in a commit message: replace the
  // `hasControlBytes` predicate with `() => false` and re-run this file.
  //
  //   predicate disabled -> 4 failed | 9 passed
  //   restored           -> 13 passed
  //
  // Assertions are on emitted BYTES, never `toContain`: B-055 records that a substring assertion is
  // exactly what let four broken strippers pass for a whole slice.

  const OSC52 = `${ESC}]52;c;ZXZpbA==${BEL}`;
  const ENV = { TERM: "xterm-256color" } as NodeJS.ProcessEnv;

  it("a_control_byte_in_the_title_is_refused", () => {
    const out = fakeOut();

    expect(() => {
      setTerminalTitle(`ok${BEL}${OSC52}`, out);
    }).toThrow(/control/i);
    expect(out.writes).toHaveLength(0);
  });

  it("a_control_byte_in_the_url_is_refused", () => {
    expect(() => {
      osc8Link("click", `https://ok${ESC}\\${OSC52}`, ENV, { isTTY: true });
    }).toThrow(/control/i);
  });

  it("a_control_byte_in_the_link_text_is_refused", () => {
    expect(() => {
      osc8Link(`a${BEL}${ESC}]0;OWNED${BEL}`, "https://ok", ENV, {
        isTTY: true,
      });
    }).toThrow(/control/i);
  });

  it("a_lone_escape_with_no_terminator_is_refused", () => {
    // ADR D3, and the branch where emitters historically fail: CVE-2022-46663's one-line fix in
    // `less` reads "End OSC8 hyperlink on invalid embedded escape sequence". A sequence MATCHER
    // cannot see this; a character predicate can, which is why the check is the latter.
    const out = fakeOut();

    expect(() => {
      setTerminalTitle(`ok${ESC}`, out);
    }).toThrow(/control/i);
    expect(out.writes).toHaveLength(0);
  });

  it("well_formed_values_emit_exactly_what_they_did_before", () => {
    const out = fakeOut();
    setTerminalTitle("theo — src/index.ts", out);

    expect(out.writes).toEqual([`${ESC}]0;theo — src/index.ts${BEL}`]);
    expect(osc8Link("click", "https://example.com", ENV, { isTTY: true })).toBe(
      `${ESC}]8;;https://example.com${BEL}click${ESC}]8;;${BEL}`,
    );
  });
});
