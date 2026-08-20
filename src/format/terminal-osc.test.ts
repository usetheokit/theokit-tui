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
  // DETECTION POWER, MEASURED, written here rather than only in a commit message. Re-measure when
  // this file changes — the numbers below were stale within one slice, which is the standing cost
  // of recording them here instead of somewhere that travels with the code by itself.
  //
  //   hasControlBytes -> () => false            8 failed | 10 passed (18)
  //   restored                                 18 passed
  //
  // Three MORE mutants, each added because a reviewer found the suite could not kill it. They are
  // listed with what they break, so a future reader can re-run them rather than trust this comment:
  //
  //   refuseControlBytes moved BELOW osc8Link's supportsHyperlinks gate     1 failed
  //   RangeError -> Error                                                   1 failed
  //   range narrowed to BEL+ESC only (drops the rest of C0, and all of C1)  1 failed
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

  it("refuses_off_tty_too_where_the_call_is_otherwise_a_noop", () => {
    // ORDER IS A DECISION, pinned here rather than left implicit. `refuseControlBytes` runs BEFORE
    // the TTY gate, so a call that would have written nothing now throws.
    //
    // That is the point rather than a side effect: the off-TTY path is where tests and CI run, so
    // validating there is what surfaces a caller's bug BEFORE it reaches a real terminal. The cost
    // is real and is stated in this test rather than by pointing at the CHANGELOG: a consumer
    // piping output gets an exception where it previously got a SILENT NO-OP, which is a harsher
    // change than the on-TTY case where they were already getting a broken terminal. Naming the
    // gentler half only would be the flattering description rather than the true one.
    const out = {
      isTTY: false,
      write: (): void => undefined,
      writes: [] as string[],
    };

    expect(() => {
      setTerminalTitle(`bad${BEL}`, out);
    }).toThrow(/control/i);
  });

  it("does_not_refuse_ordinary_text", () => {
    // The other half of a validator's contract, and the half that is usually missing: what it must
    // NOT reject. Measured — accents, CJK, emoji and long strings all pass, so the range is
    // control bytes and not "anything unusual".
    const out = fakeOut();

    for (const title of [
      "theo — src/índex.ts",
      "テスト · 日本語",
      "deploy ✅ 3/4",
      "café ☕ — build",
      "a".repeat(200),
    ]) {
      expect(() => {
        setTerminalTitle(title, out);
      }).not.toThrow();
    }
    expect(out.writes).toHaveLength(5);
  });

  it("osc8Link_refuses_before_the_hyperlink_gate_too", () => {
    // B-086 review (M-B, HIGH) — the ordering gap nobody pinned, and it matters MORE here than in
    // `setTerminalTitle`. Off-TTY that function writes nothing, so a late check would merely be
    // pointless; `osc8Link` off-TTY RETURNS `text` VERBATIM TO THE CALLER, so a check placed after
    // `supportsHyperlinks` would hand the unvalidated string straight back.
    //
    // Measured before this test existed: moving the check below the gate left all 15 tests green.
    for (const out of [{ isTTY: false }, { isTTY: true }]) {
      for (const env of [ENV, { ...ENV, TMUX: "1" } as NodeJS.ProcessEnv]) {
        expect(() => {
          osc8Link("click", `https://ok${BEL}`, env, out);
        }).toThrow(/control/i);
        expect(() => {
          osc8Link(`click${BEL}`, "https://ok", env, out);
        }).toThrow(/control/i);
      }
    }
  });

  it("the_refusal_is_a_RangeError_not_a_bare_Error", () => {
    // B-086 review (M-C) — `/control/i` matched the MESSAGE, so widening the thrown type to `Error`
    // left all 15 green. The type is part of the contract: a caller distinguishing a programming
    // error from an I/O failure needs it, and `rules/error-handling.md` § 2 asks for typed errors
    // rather than a generic throw.
    const out = fakeOut();

    expect(() => {
      setTerminalTitle(`bad${BEL}`, out);
    }).toThrow(RangeError);
  });

  it("the_refused_range_is_all_of_C0_and_C1_not_just_BEL_and_ESC", () => {
    // B-086 review (M-D) — narrowing the predicate to only BEL and ESC left all 15 green, because
    // every hostile fixture above happens to use one of those two. The 8-bit forms are the ones
    // that matter: U+009D IS an OSC introducer and U+009B a CSI introducer, so a predicate blind to
    // them is blind to an alternative spelling of the same attack.
    const out = fakeOut();

    for (const code of [0x9d, 0x9b, 0x00, 0x1f, 0x7f, 0x0a]) {
      expect(() => {
        setTerminalTitle(`ok${String.fromCharCode(code)}`, out);
      }).toThrow(/control/i);
    }
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
