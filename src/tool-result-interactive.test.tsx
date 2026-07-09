import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "../tests/renderer/itl-adapter.js";
import { MAX_RESULT_CHARS, ToolResult } from "./tool-result.js";

// M25 T3.1 — ToolResult interactive mode: a line-capped result expands on ctrl+o
// via ExpandableOutput. The 20k char guard is never bypassed (the expanded body
// is the already-char-capped content).

const MANY = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");

describe("ToolResult interactive (M25 T3.1)", () => {
  it("collapsed_when_line_capped_shows_a_ctrl_o_affordance", async () => {
    const app = render(
      createElement(ToolResult, {
        children: MANY,
        maxLines: 5,
        interactive: true,
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("ctrl+o"); // interactive affordance replaces the static indicator
    expect(frame).toContain("line 19"); // tail-retained visible lines
    expect(frame).not.toContain("line 0"); // an early line is hidden
    app.unmount();
  });

  it("ctrl_o_expands_to_reveal_the_hidden_lines", async () => {
    const app = render(
      createElement(ToolResult, {
        children: MANY,
        maxLines: 5,
        interactive: true,
      }),
    );
    await app.flush();
    app.stdin.write("\x0f"); // Ctrl+O
    await app.flush();
    expect(app.lastFrame()).toContain("line 0"); // the hidden head is now visible
    app.unmount();
  });

  it("the_char_cap_notice_stays_visible_in_interactive_mode", async () => {
    // review M2: interactive mode replaces the LINE-cap indicator with the
    // affordance, but a CHAR cap must remain observable (no silent data loss).
    // Many short lines totalling > 20k chars → BOTH line-capped AND char-capped.
    const huge = Array.from(
      { length: 400 },
      (_, i) => `row ${i} ${"x".repeat(60)}`,
    ).join("\n");
    const app = render(
      createElement(ToolResult, {
        children: huge,
        maxLines: 2,
        interactive: true,
      }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("output capped"); // char-cap still surfaced
    expect(app.lastFrame()).toContain("ctrl+o"); // + the line-cap affordance
    app.unmount();
  });

  it("the_char_guard_is_not_bypassed_when_expanded", async () => {
    // A body far over the char cap: even expanded, the rendered content is the
    // char-capped slice (never the full oversized input).
    const huge = "x".repeat(MAX_RESULT_CHARS + 5000);
    const app = render(
      createElement(ToolResult, {
        children: huge,
        maxLines: 3,
        interactive: true,
      }),
    );
    await app.flush();
    app.stdin.write("\x0f"); // expand
    await app.flush();
    // The visible x-run cannot exceed the char cap (single line here).
    const xs = (app.lastFrame().match(/x/g) ?? []).length;
    expect(xs).toBeLessThanOrEqual(MAX_RESULT_CHARS);
    app.unmount();
  });
});
