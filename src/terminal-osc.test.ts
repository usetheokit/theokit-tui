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
