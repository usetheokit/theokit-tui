import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { HookReviewPrompt } from "../../src/prompts/hook-review-prompt.js";
import type { ReviewableHook } from "../../src/prompts/workspace-consent.js";
import { waitFor } from "../fixtures/wait-for.js";
import { render } from "../renderer/itl-adapter.js";

const base: ReviewableHook = {
  fingerprint: "fp",
  event: "PreToolUse",
  command: "npm test",
  status: "new",
};

describe("HookReviewPrompt", () => {
  it("renders_new_hooks_with_the_new_marker", async () => {
    const app = render(
      createElement(HookReviewPrompt, { hook: base, remaining: 2, onDecision: () => {} }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("[new]");
    expect(frame).toContain("npm test");
    expect(frame).toContain("2 more to review");
    expect(frame).not.toContain("was:");
    app.unmount();
  });

  it("renders_modified_hooks_with_was_and_now", async () => {
    const app = render(
      createElement(HookReviewPrompt, {
        hook: { ...base, status: "modified", previousCommand: "npm run old" },
        remaining: 0,
        onDecision: () => {},
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("[changed]");
    expect(frame).toContain("was: npm run old");
    expect(frame).toContain("now: npm test");
    app.unmount();
  });

  it("renders_a_was_fallback_when_a_modified_hook_has_no_previous_command", async () => {
    const app = render(
      createElement(HookReviewPrompt, {
        hook: { ...base, status: "modified" },
        remaining: 0,
        onDecision: () => {},
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("was: (unavailable)");
    expect(frame).toContain("now: npm test");
    app.unmount();
  });

  it("escapes_control_characters_and_keeps_the_rest_on_the_same_line", async () => {
    const app = render(
      createElement(HookReviewPrompt, {
        hook: { ...base, command: "npm test\rrm -rf x" },
        remaining: 0,
        onDecision: () => {},
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("npm test\\rrm -rf x");
    expect(frame).not.toContain("\r");
    app.unmount();
  });

  it("a_literal_backslash_r_does_not_look_like_a_carriage_return", async () => {
    const show = async (command: string) => {
      const app = render(
        createElement(HookReviewPrompt, {
          hook: { ...base, command },
          remaining: 0,
          onDecision: () => {},
        }),
      );
      await app.flush();
      const frame = app.lastFrame();
      app.unmount();
      return frame;
    };
    const real = await show("a\rb");
    const literal = await show("a\\rb");
    expect(real).toContain("a\\rb");
    expect(literal).toContain("a\\\\rb");
    expect(real).not.toEqual(literal);
  });

  it("enter_approves_and_esc_refuses", async () => {
    const decided: string[] = [];
    const app = render(
      createElement(HookReviewPrompt, {
        hook: base,
        remaining: 0,
        onDecision: (d: string) => decided.push(d),
      }),
    );
    await app.flush();
    app.stdin.write("\r");
    await app.flush();
    expect(decided).toEqual(["approve"]);
    app.stdin.write("\x1b");
    await waitFor(() => decided.length > 1, { describe: "esc decision" });
    expect(decided).toEqual(["approve", "refuse"]);
    app.unmount();
  });

  it("wording_is_replaceable", async () => {
    const app = render(
      createElement(HookReviewPrompt, {
        hook: base,
        remaining: 0,
        onDecision: () => {},
        newLabel: "[novo]",
        toolType: "Gancho",
      }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("[novo]");
    expect(app.lastFrame()).toContain("Gancho");
    app.unmount();
  });
});
