import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { render } from "../tests/renderer/itl-adapter.js";
import { ExpandableOutput } from "./expandable-output.js";

// M25 T3.1 — ExpandableOutput over the itl-adapter. A capped view + a ctrl+o /
// Space / Enter toggle (per-component state, no global registry) revealing the
// full body. Composes the M24 CollapsibleBlock (▶/▼ affordance).

describe("ExpandableOutput (M25 T3.1)", () => {
  it("collapsed_shows_the_capped_view_and_a_ctrl_o_affordance", async () => {
    const app = render(
      <ExpandableOutput
        collapsed={<Text>first 3 lines</Text>}
        expanded={<Text>all 42 lines</Text>}
        hiddenCount={39}
      />,
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("first 3 lines");
    expect(frame).toContain("39 more");
    expect(frame).toContain("ctrl+o");
    expect(frame).toContain("▶"); // collapsed affordance
    expect(frame).not.toContain("all 42 lines");
    app.unmount();
  });

  it("ctrl_o_expands_the_full_body", async () => {
    const app = render(
      <ExpandableOutput
        collapsed={<Text>capped</Text>}
        expanded={<Text>the full body here</Text>}
        hiddenCount={10}
      />,
    );
    await app.flush();
    app.stdin.write("\x0f"); // Ctrl+O
    await app.flush();
    expect(app.lastFrame()).toContain("the full body here");
    expect(app.lastFrame()).toContain("▼"); // expanded affordance
    app.unmount();
  });

  it("space_also_toggles", async () => {
    const app = render(
      <ExpandableOutput
        collapsed={<Text>capped</Text>}
        expanded={<Text>full-space-body</Text>}
        hiddenCount={5}
      />,
    );
    await app.flush();
    app.stdin.write(" ");
    await app.flush();
    expect(app.lastFrame()).toContain("full-space-body");
    app.unmount();
  });

  it("two_instances_toggle_independently", async () => {
    const app = render(
      <>
        <ExpandableOutput
          collapsed={<Text>a-capped</Text>}
          expanded={<Text>a-full</Text>}
          hiddenCount={1}
          autoFocus={false}
        />
        <ExpandableOutput
          collapsed={<Text>b-capped</Text>}
          expanded={<Text>b-full</Text>}
          hiddenCount={1}
          autoFocus
        />
      </>,
    );
    await app.flush();
    app.stdin.write("\x0f"); // Ctrl+O → only the focused (b) expands
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("b-full");
    expect(frame).toContain("a-capped"); // a stays collapsed (independent)
    expect(frame).not.toContain("a-full");
    app.unmount();
  });

  it("ctrl_o_when_unfocused_is_a_noop", async () => {
    const app = render(
      <ExpandableOutput
        collapsed={<Text>nf-capped</Text>}
        expanded={<Text>nf-full</Text>}
        hiddenCount={2}
        autoFocus={false}
      />,
    );
    await app.flush();
    app.stdin.write("\x0f");
    await app.flush();
    expect(app.lastFrame()).not.toContain("nf-full");
    app.unmount();
  });
});
