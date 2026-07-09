import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { render } from "../tests/renderer/itl-adapter.js";
import { CollapsibleBlock, ThinkingBlock } from "./collapsible-block.js";
import { TheoTUIProvider, themes } from "./theme.js";

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
    expect(frame).toContain("▶"); // collapsed affordance
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
    expect(app.lastFrame()).toContain("▼");
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
    expect(app.lastFrame()).toContain("▼");
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
      <CollapsibleBlock
        summary={<Text>s</Text>}
        expanded={false}
        onToggle={(e) => toggles.push(e)}
      >
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

  it("affordance_survives_a_monochrome_theme", async () => {
    const app = render(
      <TheoTUIProvider theme={themes["no-color"]}>
        <CollapsibleBlock summary={<Text>s</Text>}>
          <Text>b</Text>
        </CollapsibleBlock>
      </TheoTUIProvider>,
    );
    await app.flush();
    expect(app.lastFrame()).toContain("▶");
    app.unmount();
  });

  it("thinking_block_preset_is_collapsed_and_renders_markdown_body_when_expanded", async () => {
    const app = render(
      <ThinkingBlock>Let me **reason** about it</ThinkingBlock>,
    );
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
