import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "../tests/renderer/itl-adapter.js";
import { PermissionPrompt } from "./permission-prompt.js";

// The Claude Code tool-approval card: a top-ruled frame with a tool-type header,
// the command + description, an optional permission-rule note, the "Do you want
// to proceed?" question, and a VERTICAL NUMBERED Yes/No choice list. Enter
// commits the active choice; Esc is the safe default (the last choice — reject).

const base = {
  toolType: "Bash command",
  command: "npm install 2>&1 | tail -8",
  onDecision: () => {},
};

describe("PermissionPrompt (Claude Code tool approval)", () => {
  it("renders_the_tool_header_command_and_question", async () => {
    const app = render(
      createElement(PermissionPrompt, {
        ...base,
        description: "Install SDK dev deps",
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("Bash command");
    expect(frame).toContain("npm install 2>&1 | tail -8");
    expect(frame).toContain("Install SDK dev deps");
    expect(frame).toContain("Do you want to proceed?");
    app.unmount();
  });

  it("renders_a_top_rule_frame", async () => {
    const app = render(createElement(PermissionPrompt, base));
    await app.flush();
    expect(app.lastFrame()).toContain("─"); // the framing rule
    app.unmount();
  });

  it("renders_the_permission_rule_note_and_hint", async () => {
    const app = render(
      createElement(PermissionPrompt, {
        ...base,
        ruleNote:
          "Permission rule Bash(npm *) requires confirmation for this command.",
        hint: "/permissions to update rules",
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("Permission rule Bash(npm *)");
    expect(frame).toContain("/permissions to update rules");
    app.unmount();
  });

  it("renders_vertical_numbered_yes_no_by_default", async () => {
    const app = render(createElement(PermissionPrompt, base));
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("❯ 1. Yes");
    expect(frame).toContain("2. No");
    app.unmount();
  });

  it("enter_commits_the_active_choice_yes", async () => {
    const decided: string[] = [];
    const app = render(
      createElement(PermissionPrompt, {
        ...base,
        onDecision: (v: string) => decided.push(v),
      }),
    );
    await app.flush();
    app.stdin.write("\r");
    await app.flush();
    expect(decided).toEqual(["yes"]);
    app.unmount();
  });

  it("esc_yields_the_safe_default_no", async () => {
    const decided: string[] = [];
    const app = render(
      createElement(PermissionPrompt, {
        ...base,
        onDecision: (v: string) => decided.push(v),
      }),
    );
    await app.flush();
    app.stdin.write("\x1b"); // a lone ESC is held ~20ms (meta-prefix window)…
    await new Promise((resolve) => setTimeout(resolve, 40));
    await app.flush();
    expect(decided).toEqual(["no"]);
    app.unmount();
  });

  it("digit_two_then_enter_commits_no", async () => {
    const decided: string[] = [];
    const app = render(
      createElement(PermissionPrompt, {
        ...base,
        onDecision: (v: string) => decided.push(v),
      }),
    );
    await app.flush();
    app.stdin.write("2");
    await app.flush();
    app.stdin.write("\r");
    await app.flush();
    expect(decided).toEqual(["no"]);
    app.unmount();
  });

  it("throws_on_empty_tool_type", () => {
    expect(() =>
      PermissionPrompt({ toolType: "", command: "x", onDecision: () => {} }),
    ).toThrow(TypeError);
  });
});
