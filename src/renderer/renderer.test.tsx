import { Box, Text } from "ink";
import { render as inkRender } from "ink-testing-library";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { VirtualTerminal } from "../../tests/renderer/virtual-terminal.js";
import { createRenderer } from "./renderer.js";

// M17 T2.1 (plan m17-renderer-skeleton, ADR D1 / 0003): the react-reconciler
// host mounting a React <Text> tree THROUGH the engine, proven against the
// @xterm/headless screen oracle, with the parity gate vs Ink. The host-config
// subset is Ink 7's exact map (references/... node_modules/ink/reconciler.js).

/** Flush React's sync commit + the engine's coalescing microtask. */
async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const SHOW_CURSOR = "\x1b[?25h";

describe("createRenderer (M17 T2.1)", () => {
  it("mount_renders_react_text_tree_to_screen", async () => {
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(<Text>hello</Text>);
    await tick();
    await term.flush();
    expect(term.screenLines()[0]).toContain("hello");
    r.unmount();
  });

  it("update_rerenders_changed_text", async () => {
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(<Text>hello</Text>);
    await tick();
    r.render(<Text>world</Text>);
    await tick();
    await term.flush();
    expect(term.screenLines()[0]).toContain("world");
    expect(term.screenLines()[0]).not.toContain("hello");
    r.unmount();
  });

  it("coalesced_commits_paint_once", async () => {
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(<Text>first</Text>);
    await tick(); // mount paint
    term.writes.length = 0;
    // Two commits inside the same tick must coalesce to ONE engine paint.
    r.render(<Text>second</Text>);
    r.render(<Text>third</Text>);
    await tick();
    await term.flush();
    expect(term.writes).toHaveLength(1);
    expect(term.screenLines()[0]).toContain("third");
    r.unmount();
  });

  it("unmount_restores_cursor_and_screen", async () => {
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(<Text>bye</Text>);
    await tick();
    term.writes.length = 0;
    r.unmount();
    expect(term.writeStream()).toContain(SHOW_CURSOR);
  });

  it("react19_commit_behavior_pinned_empirically", async () => {
    // The M10 StrictMode lesson (EC-4): assert the OBSERVED render count,
    // whatever it is. Under updateContainerSync (legacy root, no StrictMode)
    // one render() commits the tree exactly once.
    let renderCount = 0;
    function Canary(): React.ReactElement {
      renderCount += 1;
      return <Text>canary</Text>;
    }
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(<Canary />);
    await tick();
    expect(renderCount).toBe(1); // pinned empirically — legacy sync commit
    r.unmount();
  });

  it("parity_with_ink_on_text_scene", async () => {
    const scene = (
      <Box flexDirection="column">
        <Text>alpha</Text>
        <Text>beta</Text>
        <Text>gamma</Text>
      </Box>
    );
    const ink = inkRender(scene);
    const inkLines = (ink.lastFrame() ?? "").split("\n");
    ink.unmount();

    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(scene);
    await tick();
    await term.flush();
    const ourLines = term.screenLines();
    expect(ourLines).toEqual(inkLines);
    r.unmount();
  });

  it("insert_before_reorders_keyed_children", async () => {
    // Exercises the host-config insert path: a keyed list gains a row at the
    // front, so React calls insertBefore rather than append.
    function List({ items }: { items: string[] }): React.ReactElement {
      return (
        <Box flexDirection="column">
          {items.map((i) => (
            <Text key={i}>{i}</Text>
          ))}
        </Box>
      );
    }
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(<List items={["b", "c"]} />);
    await tick();
    r.render(<List items={["a", "b", "c"]} />);
    await tick();
    await term.flush();
    expect(term.screenLines()).toEqual(["a", "b", "c"]);
    r.unmount();
  });

  it("row_direction_concatenates_inline", async () => {
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(
      <Box flexDirection="row">
        <Text>foo</Text>
        <Text>bar</Text>
      </Box>,
    );
    await tick();
    await term.flush();
    expect(term.screenLines()[0]).toBe("foobar");
    r.unmount();
  });

  it("render_and_unmount_after_dispose_are_noops", async () => {
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(<Text>live</Text>);
    await tick();
    r.unmount();
    term.writes.length = 0;
    // Both guards must no-op: no throw, no writes.
    r.render(<Text>zombie</Text>);
    r.unmount();
    await tick();
    expect(term.writes).toHaveLength(0);
  });

  it("dynamic_state_update_repaints", async () => {
    // A stateful component flips text on interaction-free state — proves the
    // reconciler drives repaints, not just top-level render() calls.
    function Toggle({ label }: { label: string }): React.ReactElement {
      const [n] = useState(label);
      return <Text>{n}</Text>;
    }
    const term = new VirtualTerminal(40, 10);
    const r = createRenderer(term);
    r.render(<Toggle label="stateful" />);
    await tick();
    await term.flush();
    expect(term.screenLines()[0]).toContain("stateful");
    r.unmount();
  });
});
