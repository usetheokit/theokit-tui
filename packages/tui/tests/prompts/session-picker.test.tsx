import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { SessionPicker } from "../../src/prompts/session-picker.js";
import { render } from "../renderer/itl-adapter.js";

const sessions = [
  { id: "s1", title: "Fix login bug", lastActivity: "2m ago" },
  { id: "s2", title: "Refactor parser", lastActivity: "1h ago" },
  { id: "s3", title: "Write docs", lastActivity: "yesterday" },
];

describe("SessionPicker (#269)", () => {
  it("arrows_move_and_enter_selects_the_id", async () => {
    const chosen: string[] = [];
    const app = render(
      createElement(SessionPicker, { sessions, onSelect: (id) => chosen.push(id) }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("❯ Fix login bug");
    expect(app.lastFrame()).toContain("2m ago");
    app.stdin.write("\x1b[B");
    await app.flush();
    app.stdin.write("\x1b[B");
    await app.flush();
    app.stdin.write("\x1b[A");
    await app.flush();
    app.stdin.write("\r");
    await app.flush();
    expect(chosen).toEqual(["s2"]);
    app.unmount();
  });

  it("typing_narrows_the_list_to_matching_titles", async () => {
    const chosen: string[] = [];
    const app = render(
      createElement(SessionPicker, { sessions, onSelect: (id) => chosen.push(id) }),
    );
    await app.flush();
    for (const ch of "docs") app.stdin.write(ch);
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("Write docs");
    expect(frame).not.toContain("Fix login bug");
    expect(frame).not.toContain("Refactor parser");
    app.stdin.write("\r");
    await app.flush();
    expect(chosen).toEqual(["s3"]);
    app.unmount();
  });

  it("enter_with_no_match_does_not_call_onSelect", async () => {
    const chosen: string[] = [];
    const app = render(
      createElement(SessionPicker, { sessions, onSelect: (id) => chosen.push(id) }),
    );
    await app.flush();
    for (const ch of "zzzz") app.stdin.write(ch);
    await app.flush();
    app.stdin.write("\r");
    await app.flush();
    expect(chosen).toEqual([]);
    app.unmount();
  });
});
