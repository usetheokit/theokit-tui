import { describe, expect, it } from "vitest";

import { detectNotifyProtocol, notify } from "../../src/status/notify.js";

// M24 T4.1 — the desktop-notify helper (blueprint ADR D5). `detectNotifyProtocol`
// is a pure, injectable-env conservative matrix: OSC-9 only where known-supported
// (iTerm2/ConEmu), suppress under a multiplexer, BEL otherwise. `notify` writes
// the exact bytes, and only to a TTY.

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

describe("detectNotifyProtocol (M24 T4.1)", () => {
  it("osc9_for_iterm2", () => {
    expect(detectNotifyProtocol({ TERM_PROGRAM: "iTerm.app" })).toBe("osc9");
    expect(detectNotifyProtocol({ ITERM_SESSION_ID: "w0t0p0" })).toBe("osc9");
  });

  it("bel_for_alacritty_and_unknown", () => {
    expect(detectNotifyProtocol({ ALACRITTY_WINDOW_ID: "1" })).toBe("bel");
    expect(detectNotifyProtocol({})).toBe("bel");
    expect(detectNotifyProtocol({ TERM_PROGRAM: "vscode" })).toBe("bel");
  });

  it("null_under_tmux_screen_and_zellij", () => {
    expect(detectNotifyProtocol({ TMUX: "/tmp/tmux-1000/default,1,0" })).toBe(null);
    expect(detectNotifyProtocol({ STY: "1234.pts-0.host" })).toBe(null);
    expect(detectNotifyProtocol({ ZELLIJ: "0" })).toBe(null);
    // A multiplexer wins even over an iTerm2 signal (suppress is conservative).
    expect(detectNotifyProtocol({ TMUX: "x", TERM_PROGRAM: "iTerm.app" })).toBe(null);
  });
});

describe("notify (M24 T4.1)", () => {
  it("emits_exact_osc9_bytes_on_iterm2", () => {
    const out = fakeOut();
    notify("build done", out, { TERM_PROGRAM: "iTerm.app" });
    expect(out.writes).toEqual(["\x1b]9;build done\x07"]);
  });

  it("emits_bel_bytes_on_an_unknown_terminal", () => {
    const out = fakeOut();
    notify("build done", out, {});
    expect(out.writes).toEqual(["\x07"]);
  });

  it("is_a_noop_on_a_non_tty", () => {
    const out = fakeOut();
    out.isTTY = false;
    notify("build done", out, { TERM_PROGRAM: "iTerm.app" });
    expect(out.writes).toEqual([]);
  });

  it("is_suppressed_under_a_multiplexer", () => {
    const out = fakeOut();
    notify("build done", out, { TMUX: "x" });
    expect(out.writes).toEqual([]);
  });
});
