import { Box, Text } from "ink";
import { render as inkRender } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "../../tests/renderer/itl-adapter.js";
import { stripAnsi } from "../format/ansi.js";
import { WindowedList } from "../prompts/windowed-list.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";
import { CollapsibleBlock } from "./collapsible-block.js";
import { ThinkingBlock } from "./thinking-block.js";

// M24 T3.1 — CollapsibleBlock over the itl-adapter. A collapsed summary +
// expandable body, controlled OR key-toggled (Space/Enter when focused); ▶/▼
// affordance survives monochrome. ThinkingBlock is a collapsed-default preset.

describe("CollapsibleBlock (M24 T3.1)", () => {
  it("uncontrolled_defaults_to_collapsed", async () => {
    const app = render(
      <CollapsibleBlock summary={<Text>summary line</Text>}>
        <Text>the hidden body</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("▸"); // collapsed affordance (B-053: disclosure pair)
    expect(frame).toContain("summary line");
    expect(frame).not.toContain("the hidden body");
    app.unmount();
  });

  it("defaultExpanded_starts_open", async () => {
    const app = render(
      <CollapsibleBlock summary={<Text>s</Text>} defaultExpanded>
        <Text>the body</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    expect(app.lastFrame()).toContain("▾");
    expect(app.lastFrame()).toContain("the body");
    app.unmount();
  });

  it("space_toggles_when_focused", async () => {
    const app = render(
      <CollapsibleBlock summary={<Text>s</Text>}>
        <Text>body-xyz</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    app.stdin.write(" "); // space → expand
    await app.flush();
    expect(app.lastFrame()).toContain("body-xyz");
    expect(app.lastFrame()).toContain("▾");
    app.unmount();
  });

  it("enter_toggles_when_focused", async () => {
    const app = render(
      <CollapsibleBlock summary={<Text>s</Text>}>
        <Text>body-abc</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    app.stdin.write("\r"); // enter → expand
    await app.flush();
    expect(app.lastFrame()).toContain("body-abc");
    app.unmount();
  });

  it("controlled_expanded_prop_wins_and_calls_onToggle_not_internal_state", async () => {
    const toggles: boolean[] = [];
    const app = render(
      <CollapsibleBlock summary={<Text>s</Text>} expanded={false} onToggle={(e) => toggles.push(e)}>
        <Text>controlled-body</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    expect(app.lastFrame()).not.toContain("controlled-body"); // controlled = false
    app.stdin.write(" "); // space → onToggle(true), but the prop stays false
    await app.flush();
    expect(toggles).toEqual([true]);
    expect(app.lastFrame()).not.toContain("controlled-body"); // no internal state
    app.unmount();
  });

  it("an_unbound_key_does_not_toggle", async () => {
    const app = render(
      <CollapsibleBlock summary={<Text>s</Text>}>
        <Text>body-q</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    app.stdin.write("x"); // unbound → stays collapsed
    await app.flush();
    expect(app.lastFrame()).not.toContain("body-q");
    app.unmount();
  });

  it("keys_ignored_when_not_focused", async () => {
    const app = render(
      <CollapsibleBlock summary={<Text>s</Text>} autoFocus={false}>
        <Text>body-nf</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    app.stdin.write(" "); // not focused → ignored
    await app.flush();
    expect(app.lastFrame()).not.toContain("body-nf");
    app.unmount();
  });

  it("the_affordance_renders_BYTE_IDENTICALLY_under_every_theme", () => {
    // B-087 — and this one did not end where its three siblings did, which is the honest part.
    //
    // It was `affordance_survives_a_monochrome_theme`, rendered through the itl-adapter, asserting
    // `toContain("▸")`. MEASURED: with `TheoTUIProvider` mutated to ignore its `theme` prop
    // entirely, it stayed GREEN — as did the other three, because the adapter reads xterm's
    // `translateToString` and colour never reaches that frame.
    //
    // The other three were fixed by rendering through ink, where the colour exists. HERE THAT DOES
    // NOT WORK, and the reason is the finding: measured through ink, `CollapsibleBlock` emits
    //
    //     dark      "▸ s"
    //     no-color  "▸ s"
    //
    // BYTE-IDENTICAL. The component colours nothing, so no theme can change its output and NO TEST
    // OF THIS COMPONENT CAN DETECT A BROKEN THEME SYSTEM. A test named "survives a monochrome
    // theme" was unfalsifiable by construction — not because of the renderer, but because there was
    // never anything to survive.
    //
    // So it asserts what is actually true and IS falsifiable: the output does not vary with the
    // theme. If someone later colours the affordance, this fails and they have to decide
    // deliberately rather than by accident.
    //
    // STATED PLAINLY: this does NOT die under the theme-ignoring mutant, and it cannot. Claiming
    // otherwise would be the manufactured detector this whole item exists to remove.
    const frameFor = (theme: unknown): string => {
      const app = inkRender(
        <TheoTUIProvider theme={theme as never}>
          <CollapsibleBlock summary={<Text>s</Text>}>
            <Text>b</Text>
          </CollapsibleBlock>
        </TheoTUIProvider>,
      );
      const frame = app.lastFrame() ?? "";
      app.unmount();
      return frame;
    };

    expect(frameFor(themes["no-color"])).toBe(frameFor(themes.dark));
    expect(frameFor(themes["no-color"])).toContain("▸");
  });

  it("thinking_block_preset_shows_the_sparkle_glyph_and_summary", async () => {
    // M26.1 Claude Code parity: the thinking marker `✻` precedes the summary.
    const app = render(<ThinkingBlock>reasoning</ThinkingBlock>);
    await app.flush();
    expect(app.lastFrame()).toContain("✻ Thinking…");
    app.unmount();
  });

  it("thinking_block_preset_is_collapsed_and_renders_markdown_body_when_expanded", async () => {
    const app = render(<ThinkingBlock>Let me **reason** about it</ThinkingBlock>);
    await app.flush();
    expect(app.lastFrame()).toContain("Thinking"); // default summary
    expect(app.lastFrame()).not.toContain("reason"); // collapsed
    app.stdin.write(" "); // expand
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("reason"); // markdown body content
    expect(frame).not.toContain("**"); // rendered as shape, not marker
    app.unmount();
  });

  it("streaming_body_updates_while_collapsed", async () => {
    const app = render(
      <CollapsibleBlock summary={<Text>s</Text>}>
        <Text>v1</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    app.rerender(
      <CollapsibleBlock summary={<Text>s</Text>}>
        <Text>v2</Text>
      </CollapsibleBlock>,
    );
    await app.flush();
    // Still collapsed; a later expand shows the updated body.
    app.stdin.write(" ");
    await app.flush();
    expect(app.lastFrame()).toContain("v2");
    app.unmount();
  });
});

const rows = (n: number): string[] => Array.from({ length: n }, (_, i) => `row-${String(i)}`);

describe("B-053 — the disclosure pair is distinguishable from window overflow", () => {
  it("a_numeric_summary_no_longer_looks_like_a_hidden_row_count", async () => {
    // The item's DoD asks for a DEMONSTRATED frame, not an assertion. This renders the exact
    // collision it describes: a CollapsibleBlock whose summary happens to be a number, beside a
    // windowed list reporting hidden rows. Before B-053 both printed `▼ <number>`.
    const app = render(
      createElement(
        Box,
        { flexDirection: "column" },
        createElement(CollapsibleBlock, {
          summary: "8",
          expanded: true,
          autoFocus: false,
          children: createElement(Text, null, "body"),
        }),
        createElement(WindowedList, {
          rows: rows(20),
          selected: 10,
          window: 5,
        }),
      ),
    );
    await app.flush();
    const frame = stripAnsi(app.lastFrame() ?? "");
    app.unmount();

    // Both are present in ONE frame — that is the collision, reproduced.
    expect(frame).toContain("▾ 8"); // disclosure, small triangle
    expect(frame).toMatch(/▲ \d+/); // overflow, large triangles
    expect(frame).toMatch(/▼ \d+/);

    // And the disclosure glyph is not the overflow glyph, which is the whole point.
    expect(frame).not.toContain("▼ 8");
  });
});
