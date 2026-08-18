import { Box, Static, Text } from "ink";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { createRenderer } from "../../src/renderer/index.js";
import { useStdout } from "../../src/renderer/hooks/use-stdout.js";
import { OutputEngine } from "../../src/renderer/output/output-engine.js";
import { VirtualTerminal } from "./virtual-terminal.js";

// M20 T1.1 (plan m20-scrollback-cutover, ADR D1): the scrollback oracle. Ink's
// dual-pass Static contract ported onto the differential engine — graduated
// history is written ONCE above the live frame (never re-rendered/erased), the
// live pass skips the static subtree (`skipStaticElements`), and `writeStatic`
// emits the delta without tracking it in `previousLines`. Ink's `<Static>` is
// reused (it emits host primitives, so it works through OUR reconciler); the
// ENGINE and `useStdout` are ours (Ink's stdout context is un-importable).

/** Drain the microtask paint + any layout-effect re-commit, then flush xterm. */
async function settle(term: VirtualTerminal): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await term.flush();
}

describe("output engine — writeStatic (M20 T1.1)", () => {
  it("writes_static_lines_once_above_the_live_frame", async () => {
    const term = new VirtualTerminal(20, 8);
    const engine = new OutputEngine(term);
    engine.writeStatic(["AAA", "BBB"]);
    engine.render(["live"]);
    await term.flush();
    expect(term.screenLines()).toEqual(["AAA", "BBB", "live"]);
  });

  it("a_later_live_render_does_not_erase_or_rewrite_static", async () => {
    const term = new VirtualTerminal(20, 8);
    const engine = new OutputEngine(term);
    engine.writeStatic(["AAA", "BBB"]);
    engine.render(["live"]);
    engine.render(["live2"]);
    await term.flush();
    expect(term.screenLines()).toEqual(["AAA", "BBB", "live2"]);
    // "AAA" hit the wire exactly once — never rewritten by a live diff.
    expect(term.writeStream().split("AAA").length - 1).toBe(1);
  });

  it("writeStatic_with_no_lines_is_a_no_op", () => {
    const term = new VirtualTerminal(20, 8);
    const engine = new OutputEngine(term);
    engine.writeStatic([]);
    expect(term.writeStream()).toBe("");
  });

  it("accumulates_successive_static_deltas_above_the_live_tail", async () => {
    const term = new VirtualTerminal(20, 8);
    const engine = new OutputEngine(term);
    engine.writeStatic(["one"]);
    engine.render(["L1"]);
    engine.writeStatic(["two"]);
    engine.render(["L2"]);
    await term.flush();
    expect(term.screenLines()).toEqual(["one", "two", "L2"]);
  });

  it("patches_the_live_frame_correctly_after_static_overflows_the_screen", async () => {
    // Review B1 regression: once static + live exceeds the terminal height, the
    // terminal scrolls. A differential patch must still land on the RIGHT live
    // row — relative positioning (not stale absolute rows) guarantees it.
    const term = new VirtualTerminal(10, 5); // only 5 rows
    const engine = new OutputEngine(term);
    engine.writeStatic(["S1", "S2", "S3"]);
    engine.render(["A", "B", "C", "D"]); // 3 static + 4 live = 8 > 5 → scrolls
    await term.flush();
    expect(term.screenLines()).toEqual(["S3", "A", "B", "C", "D"]);
    engine.render(["A", "Bx", "C", "D"]); // patch the 2nd live row
    await term.flush();
    // "Bx" replaces "B" in place — NOT painted on the wrong (bottom) row.
    expect(term.screenLines()).toEqual(["S3", "A", "Bx", "C", "D"]);
  });
});

describe("Static scrollback through the renderer (M20 T1.1)", () => {
  function App({ items }: { items: string[] }) {
    return createElement(
      Box,
      { flexDirection: "column" },
      createElement(Static, {
        items,
        children: (item: unknown) =>
          createElement(Text, { key: String(item) }, String(item)),
      }),
      createElement(Text, {}, `LIVE:${items.length}`),
    );
  }

  it("graduated_items_appear_once_above_the_live_line", async () => {
    const term = new VirtualTerminal(40, 12);
    const renderer = createRenderer(term);
    renderer.render(createElement(App, { items: ["one", "two"] }));
    await settle(term);
    const lines = term.screenLines();
    expect(lines).toContain("one");
    expect(lines).toContain("two");
    expect(lines[lines.length - 1]).toBe("LIVE:2");
    // each graduated item hit the wire exactly once (Static's print-once).
    expect(term.writeStream().split("one").length - 1).toBe(1);
    renderer.unmount();
  });

  it("appending_an_item_graduates_only_the_new_one", async () => {
    const term = new VirtualTerminal(40, 12);
    const renderer = createRenderer(term);
    renderer.render(createElement(App, { items: ["one", "two"] }));
    await settle(term);
    renderer.render(createElement(App, { items: ["one", "two", "three"] }));
    await settle(term);
    const lines = term.screenLines();
    expect(
      lines.filter((l) => l === "one" || l === "two" || l === "three"),
    ).toEqual(["one", "two", "three"]);
    expect(lines[lines.length - 1]).toBe("LIVE:3");
    // "one" was graduated in the first render and NEVER rewritten afterwards.
    expect(term.writeStream().split("one").length - 1).toBe(1);
    renderer.unmount();
  });
});

describe("useStdout on the new renderer (M20 T1.1)", () => {
  function Probe() {
    const { stdout } = useStdout();
    return createElement(Text, {}, `W${stdout?.columns}`);
  }

  it("returns_the_terminal_dimensions_provided_by_the_renderer", async () => {
    const term = new VirtualTerminal(37, 10);
    const renderer = createRenderer(term);
    renderer.render(createElement(Probe));
    await settle(term);
    expect(term.screenLines().join("")).toContain("W37");
    renderer.unmount();
  });
});
