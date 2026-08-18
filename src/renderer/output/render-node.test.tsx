import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";

import { VirtualTerminal } from "../../../tests/renderer/virtual-terminal.js";
import { colorizeForeground } from "./render-node.js";
import { createRenderer } from "../renderer.js";

const ESC = "\x1b[";

// M18 T3.1 (plan m18-yoga-layout, ADR D2): the yoga-driven paint — scenes
// rendered end-to-end through createRenderer (react-reconciler → yoga
// calculateLayout → renderNodeToOutput → cell grid → OutputEngine) and read
// back from the @xterm/headless screen.

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function screen(
  element: React.ReactElement,
  cols = 40,
  rows = 12,
): Promise<string[]> {
  const term = new VirtualTerminal(cols, rows);
  const r = createRenderer(term);
  r.render(element);
  await tick();
  await term.flush();
  const lines = term.screenLines();
  r.unmount();
  return lines;
}

describe("renderNodeToOutput paint (M18 T3.1)", () => {
  it("renders_flex_column_stacks_children", async () => {
    const lines = await screen(
      <Box flexDirection="column">
        <Text>one</Text>
        <Text>two</Text>
      </Box>,
    );
    expect(lines).toEqual(["one", "two"]);
  });

  it("renders_flex_row_places_children_side_by_side", async () => {
    const lines = await screen(
      <Box flexDirection="row">
        <Text>ab</Text>
        <Text>cd</Text>
      </Box>,
    );
    expect(lines[0]).toBe("abcd");
  });

  it("renders_padding_offsets_content", async () => {
    const lines = await screen(
      <Box paddingLeft={2} paddingTop={1}>
        <Text>x</Text>
      </Box>,
    );
    expect(lines[0]).toBe(""); // paddingTop pushes content down one row
    expect(lines[1]).toBe("  x"); // paddingLeft indents two columns
  });

  it("renders_border_box_with_glyphs", async () => {
    // A row wrapper keeps the bordered box content-sized on its main axis
    // (a bare box in the column root would stretch to full width — as Ink does).
    const lines = await screen(
      <Box flexDirection="row">
        <Box borderStyle="round">
          <Text>hi</Text>
        </Box>
      </Box>,
    );
    // round border: ╭──╮ / │hi│ / ╰──╯
    expect(lines[0]).toBe("╭──╮");
    expect(lines[1]).toBe("│hi│");
    expect(lines[2]).toBe("╰──╯");
  });

  it("renders_flex_grow_distributes_width", async () => {
    const lines = await screen(
      <Box width={10} flexDirection="row">
        <Box flexGrow={1}>
          <Text>a</Text>
        </Box>
        <Box flexGrow={1}>
          <Text>b</Text>
        </Box>
      </Box>,
    );
    // Two grow:1 children split the 10-wide row → "a" at 0, "b" at 5.
    expect(lines[0]).toBe("a    b");
  });

  it("renders_text_wrap_over_width", async () => {
    const lines = await screen(
      <Box width={5}>
        <Text>hello world</Text>
      </Box>,
      5,
    );
    // "hello world" wraps within width 5.
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(5);
    }
  });

  it("border_edge_toggle_omits_that_edge", async () => {
    const lines = await screen(
      <Box flexDirection="row">
        <Box borderStyle="round" borderTop={false}>
          <Text>hi</Text>
        </Box>
      </Box>,
    );
    // borderTop=false → first row is the content, not the top border.
    expect(lines[0]).toBe("│hi│");
  });

  it("empty_text_node_renders_nothing", async () => {
    const lines = await screen(
      <Box flexDirection="column">
        <Text>{""}</Text>
        <Text>after</Text>
      </Box>,
    );
    expect(lines).toEqual(["after"]);
  });

  it("display_none_box_renders_nothing", async () => {
    const lines = await screen(
      <Box flexDirection="column">
        <Box display="none">
          <Text>hidden</Text>
        </Box>
        <Text>shown</Text>
      </Box>,
    );
    expect(lines).toEqual(["shown"]);
  });
});

describe("colorizeForeground (M18 T3.1)", () => {
  it("named_hex_ansi256_rgb_and_passthrough", () => {
    expect(colorizeForeground("x", "red")).toContain(ESC);
    expect(colorizeForeground("x", "#ff8800")).toContain(ESC);
    expect(colorizeForeground("x", "ansi256(200)")).toContain(ESC);
    expect(colorizeForeground("x", "rgb(1, 2, 3)")).toContain(ESC);
    // Unknown color and no color both pass the string through unchanged.
    expect(colorizeForeground("x", "notacolor")).toBe("x");
    expect(colorizeForeground("x", undefined)).toBe("x");
  });
});
