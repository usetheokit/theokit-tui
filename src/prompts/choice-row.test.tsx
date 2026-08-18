import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { waitFor as waitForCondition } from "../../tests/fixtures/wait-for.js";

import { render } from "../../tests/renderer/itl-adapter.js";
import { ChoiceRow } from "./choice-row.js";
import { DEFAULT_APPROVAL_CHOICES } from "../agent/agent-decision.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";

// M23 T1.1 — the ChoiceRow component over the itl-adapter (OUR renderer/input/
// focus). A horizontal fixed choice bar: ❯ marks the active choice, ←/→ move,
// Enter commits, Esc cancels, digit keys jump. Deterministic keyboard oracle.

const CHOICES = [...DEFAULT_APPROVAL_CHOICES];

describe("ChoiceRow component (M23 T1.1)", () => {
  it("renders_choices_with_the_active_marker", async () => {
    const app = render(
      createElement(ChoiceRow, { choices: CHOICES, onCommit: () => {} }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("❯ Allow once"); // first choice active
    expect(frame).toContain("Allow always");
    expect(frame).toContain("Reject");
    app.unmount();
  });

  it("right_arrow_moves_the_marker", async () => {
    const app = render(
      createElement(ChoiceRow, { choices: CHOICES, onCommit: () => {} }),
    );
    await app.flush();
    app.stdin.write("\x1b[C"); // right arrow → second choice
    await app.flush();
    expect(app.lastFrame()).toContain("❯ Allow always");
    app.unmount();
  });

  it("enter_calls_onCommit_with_the_active_value", async () => {
    const committed: string[] = [];
    const app = render(
      createElement(ChoiceRow, {
        choices: CHOICES,
        onCommit: (v: string) => committed.push(v),
      }),
    );
    await app.flush();
    app.stdin.write("\x1b[C"); // → always
    await app.flush();
    app.stdin.write("\r"); // enter
    expect(committed).toEqual(["always"]);
    app.unmount();
  });

  it("a_digit_key_jumps_to_that_choice", async () => {
    const committed: string[] = [];
    const app = render(
      createElement(ChoiceRow, {
        choices: CHOICES,
        onCommit: (v: string) => committed.push(v),
      }),
    );
    await app.flush();
    app.stdin.write("3"); // jump to third → reject
    await app.flush();
    app.stdin.write("\r");
    expect(committed).toEqual(["reject"]);
    app.unmount();
  });

  it("escape_calls_onCancel", async () => {
    let cancelled = 0;
    const app = render(
      createElement(ChoiceRow, {
        choices: CHOICES,
        onCommit: () => {},
        onCancel: () => cancelled++,
      }),
    );
    await app.flush();
    app.stdin.write("\x1b"); // a lone ESC is held ~20ms (meta-prefix window)…
    // B-033 — was a fixed 40 ms sleep past the meta-prefix window.
    await waitForCondition(() => cancelled === 1, {
      describe: "the lone ESC to cancel once its meta-prefix window closes",
    });
    await app.flush();
    expect(cancelled).toBe(1);
    app.unmount();
  });

  it("an_unbound_key_fires_no_callback", async () => {
    const committed: string[] = [];
    let cancelled = 0;
    const app = render(
      createElement(ChoiceRow, {
        choices: CHOICES,
        onCommit: (v: string) => committed.push(v),
        onCancel: () => cancelled++,
      }),
    );
    await app.flush();
    app.stdin.write("x"); // unbound → nothing
    await app.flush();
    expect(committed).toEqual([]);
    expect(cancelled).toBe(0);
    app.unmount();
  });

  it("keys_are_ignored_when_not_focused", async () => {
    const committed: string[] = [];
    const app = render(
      createElement(ChoiceRow, {
        choices: CHOICES,
        onCommit: (v: string) => committed.push(v),
        autoFocus: false,
      }),
    );
    await app.flush();
    app.stdin.write("\r"); // not focused → ignored
    await app.flush();
    expect(committed).toEqual([]);
    app.unmount();
  });

  it("marker_survives_a_monochrome_theme_degrade_ladder", async () => {
    const app = render(
      createElement(TheoTUIProvider, {
        theme: themes["no-color"],
        children: createElement(ChoiceRow, {
          choices: CHOICES,
          onCommit: () => {},
        }),
      }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("❯ Allow once");
    app.unmount();
  });

  it("re_clamps_the_active_index_when_choices_shrink", async () => {
    // A dynamic/streamed choice set (ADR D3): move to the last of 3, then
    // re-render with only 2. The active index must re-clamp to the new tail so
    // the marker stays visible and a commit never lands on `undefined` (MEDIUM-2).
    const committed: string[] = [];
    const three = [
      { value: "a", label: "AA" },
      { value: "b", label: "BB" },
      { value: "c", label: "CC" },
    ];
    const app = render(
      createElement(ChoiceRow, {
        choices: three,
        onCommit: (v: string) => committed.push(v),
      }),
    );
    await app.flush();
    app.stdin.write("3"); // jump to the 3rd ("CC")
    await app.flush();
    expect(app.lastFrame()).toContain("❯ CC");
    app.rerender(
      createElement(ChoiceRow, {
        choices: three.slice(0, 2), // now only AA, BB
        onCommit: (v: string) => committed.push(v),
      }),
    );
    await app.flush();
    await app.flush();
    expect(app.lastFrame()).toContain("❯ BB"); // clamped to the new tail
    app.stdin.write("\r"); // Enter commits the clamped choice, not undefined
    await app.flush();
    expect(committed).toEqual(["b"]);
    app.unmount();
  });
});

// Vertical + numbered mode (PermissionPrompt parity): same keyboard oracle, a
// column layout with `{n}. ` prefixes. The digit-jump already exists in the
// oracle — this only changes the render.
const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

describe("ChoiceRow vertical + numbered", () => {
  it("numbered_prefixes_each_choice", async () => {
    const app = render(
      createElement(ChoiceRow, {
        choices: YES_NO,
        onCommit: () => {},
        numbered: true,
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("1. Yes");
    expect(frame).toContain("2. No");
    app.unmount();
  });

  it("vertical_renders_each_choice_on_its_own_line", async () => {
    const app = render(
      createElement(ChoiceRow, {
        choices: YES_NO,
        onCommit: () => {},
        orientation: "vertical",
        numbered: true,
      }),
    );
    await app.flush();
    const lines = app
      .lastFrame()
      .split("\n")
      .filter((l: string) => l.trim() !== "");
    // ❯ 1. Yes  on its own line, then  2. No on the next.
    expect(lines[0]).toContain("❯ 1. Yes");
    expect(lines[1]).toContain("2. No");
    expect(lines[1]).not.toContain("❯");
    app.unmount();
  });

  it("down_arrow_moves_the_marker_in_vertical_mode", async () => {
    const app = render(
      createElement(ChoiceRow, {
        choices: YES_NO,
        onCommit: () => {},
        orientation: "vertical",
        numbered: true,
      }),
    );
    await app.flush();
    app.stdin.write("\x1b[B"); // down arrow → second choice
    await app.flush();
    const lines = app
      .lastFrame()
      .split("\n")
      .filter((l: string) => l.trim() !== "");
    expect(lines[1]).toContain("❯ 2. No");
    app.unmount();
  });

  it("digit_jump_then_enter_commits_in_vertical_mode", async () => {
    const committed: string[] = [];
    const app = render(
      createElement(ChoiceRow, {
        choices: YES_NO,
        onCommit: (v: string) => committed.push(v),
        orientation: "vertical",
        numbered: true,
      }),
    );
    await app.flush();
    app.stdin.write("2"); // jump to No
    await app.flush();
    app.stdin.write("\r");
    await app.flush();
    expect(committed).toEqual(["no"]);
    app.unmount();
  });
});
