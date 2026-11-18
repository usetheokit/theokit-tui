import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { WorkspaceTrustPrompt } from "../../src/prompts/workspace-trust-prompt.js";
import { waitFor } from "../fixtures/wait-for.js";
import { render } from "../renderer/itl-adapter.js";

describe("WorkspaceTrustPrompt", () => {
  it("renders_the_dir_and_description", async () => {
    const app = render(
      createElement(WorkspaceTrustPrompt, {
        dir: "/work/repo",
        description: "Contains project hooks",
        onDecision: () => {},
      }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("/work/repo");
    expect(app.lastFrame()).toContain("Contains project hooks");
    app.unmount();
  });

  it("escapes_control_characters_in_the_dir", async () => {
    const app = render(createElement(WorkspaceTrustPrompt, { dir: "/a\rb", onDecision: () => {} }));
    await app.flush();
    expect(app.lastFrame()).toContain("/a\\rb");
    app.unmount();
  });

  it("enter_trusts_and_esc_quits", async () => {
    const decided: string[] = [];
    const app = render(
      createElement(WorkspaceTrustPrompt, {
        dir: "/r",
        onDecision: (d: string) => decided.push(d),
      }),
    );
    await app.flush();
    app.stdin.write("\r");
    await app.flush();
    expect(decided).toEqual(["trust"]);
    app.stdin.write("\x1b");
    await waitFor(() => decided.length > 1, { describe: "esc decision" });
    expect(decided).toEqual(["trust", "quit"]);
    app.unmount();
  });
});
