import { describe, expect, it } from "vitest";

import { VirtualTerminal } from "../../../tests/renderer/virtual-terminal.js";
import { OutputEngine } from "./output-engine.js";

// M17 T1.1 (plan m17-renderer-skeleton, ADR D2): the differential output
// engine — pi's strategy ladder ported (references/pi/.../src/tui.ts:
// 1335-1475), CSI-2026 synchronized output, reasoned fullRender fallbacks.
// Asserts read the REAL emulator screen (VirtualTerminal) except the
// diff-scope oracles, which spy on the raw write stream.

const CSI_2026_BEGIN = "\x1b[?2026h";
const CSI_2026_END = "\x1b[?2026l";
const CLEAR_LINE = "\x1b[2K";
const CLEAR_SCREEN = "\x1b[2J";

async function renderAndRead(
  eng: OutputEngine,
  term: VirtualTerminal,
  lines: string[],
): Promise<string[]> {
  eng.render(lines);
  await term.flush();
  return term.screenLines();
}

describe("OutputEngine (M17 T1.1)", () => {
  it("first_render_writes_all_lines_wrapped_in_csi2026", async () => {
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    const screen = await renderAndRead(eng, term, ["alpha", "beta", "gamma"]);
    const stream = term.writeStream();
    expect(stream).toContain(CSI_2026_BEGIN);
    expect(stream).toContain(CSI_2026_END);
    expect(screen).toEqual(["alpha", "beta", "gamma"]);
  });

  it("update_rewrites_only_changed_lines", async () => {
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    await renderAndRead(eng, term, ["alpha", "beta", "gamma"]);
    term.writes.length = 0; // isolate the second render's stream
    const screen = await renderAndRead(eng, term, ["alpha", "BETA", "gamma"]);
    const second = term.writeStream();
    expect(second).toContain("BETA");
    // The line-diff strategy must NOT re-emit the unchanged rows.
    expect(second).not.toContain("alpha");
    expect(second).not.toContain("gamma");
    expect(screen).toEqual(["alpha", "BETA", "gamma"]);
  });

  it("append_fast_path_writes_only_new_tail", async () => {
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    await renderAndRead(eng, term, ["alpha", "beta"]);
    term.writes.length = 0;
    const screen = await renderAndRead(eng, term, [
      "alpha",
      "beta",
      "gamma",
      "delta",
    ]);
    const second = term.writeStream();
    expect(second).toContain("gamma");
    expect(second).toContain("delta");
    expect(second).not.toContain("alpha");
    expect(second).not.toContain("beta");
    expect(screen).toEqual(["alpha", "beta", "gamma", "delta"]);
  });

  it("deleted_tail_clears_rows", async () => {
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    await renderAndRead(eng, term, ["alpha", "beta", "gamma"]);
    term.writes.length = 0;
    const screen = await renderAndRead(eng, term, ["alpha"]);
    const second = term.writeStream();
    expect(second).toContain(CLEAR_LINE);
    expect(screen).toEqual(["alpha"]);
  });

  it("width_change_triggers_full_render_with_reason", async () => {
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    await renderAndRead(eng, term, ["hello world"]);
    term.resize(20, 10);
    term.writes.length = 0;
    eng.render(["hello world"]);
    await term.flush();
    expect(eng.lastRedrawReason).toMatch(/width/i);
    expect(term.writeStream()).toContain(CLEAR_SCREEN);
  });

  it("height_change_triggers_full_render_with_reason", async () => {
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    await renderAndRead(eng, term, ["hello"]);
    term.resize(40, 6);
    term.writes.length = 0;
    eng.render(["hello"]);
    await term.flush();
    expect(eng.lastRedrawReason).toMatch(/height/i);
    expect(term.writeStream()).toContain(CLEAR_SCREEN);
  });

  it("teardown_restores_cursor_and_closes_sync", async () => {
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    await renderAndRead(eng, term, ["alpha"]);
    term.writes.length = 0;
    eng.teardown();
    const stream = term.writeStream();
    expect(stream).toContain(CSI_2026_END); // close any open synchronized-output
    expect(stream).toContain("\x1b[?25h"); // show cursor
  });

  it("shrink_with_changed_visible_line_clears_and_rewrites", async () => {
    // Edge case: content shrinks AND a still-visible row changes, so the
    // first change is above the new length (not a pure deleted-tail). The
    // rewrite-span must clear the trailing removed row too.
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    await renderAndRead(eng, term, ["alpha", "beta", "gamma"]);
    term.writes.length = 0;
    const screen = await renderAndRead(eng, term, ["ALPHA", "beta"]);
    expect(term.writeStream()).toContain(CLEAR_LINE);
    expect(screen).toEqual(["ALPHA", "beta"]);
  });

  it("no_change_writes_nothing", async () => {
    // Negative/idempotence case (testing.md § 4.1): re-rendering identical
    // content must not touch the terminal.
    const term = new VirtualTerminal(40, 10);
    const eng = new OutputEngine(term);
    await renderAndRead(eng, term, ["alpha", "beta"]);
    term.writes.length = 0;
    eng.render(["alpha", "beta"]);
    expect(term.writes).toHaveLength(0);
  });

  it("virtual_terminal_reads_screen_state", async () => {
    // Harness self-test: the emulator renders CR/LF movement correctly.
    const term = new VirtualTerminal(40, 10);
    term.write("x\r\ny");
    await term.flush();
    expect(term.screenLines().slice(0, 2)).toEqual(["x", "y"]);
  });
});
