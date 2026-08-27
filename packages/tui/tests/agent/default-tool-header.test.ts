/**
 * usetheokit/theokit-tui#53 — the batteries-included tool-label table behind `formatToolHeader`.
 *
 * The seam was already right; what was missing was a default, so every Codex-clone re-derived the
 * same verb table. These cases pin the three properties an app depends on when composing with it.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOOL_HEADERS,
  defaultToolHeader,
  messagesToAgentEvents,
} from "../../src/agent/index.js";
import type { AgentToolEvent } from "../../src/agent/index.js";

const toolEvent = (name: string): AgentToolEvent => ({
  id: "t1",
  kind: "tool",
  name,
  status: "success",
});

describe("#53 — defaultToolHeader humanises the conventional tool names", () => {
  it("maps a known tool to its verb", () => {
    expect(defaultToolHeader(toolEvent("run_shell"))).toEqual({ name: "Ran" });
    expect(defaultToolHeader(toolEvent("apply_patch"))).toEqual({ name: "Edited" });
    expect(defaultToolHeader(toolEvent("write_stdin"))).toEqual({ name: "Wrote to session" });
  });

  it("returns undefined for a tool it does not know, so composition works", () => {
    // The contract the caller relies on: `undefined` leaves the event untouched, which is what
    // lets an app chain this with its own table in either order.
    expect(defaultToolHeader(toolEvent("deploy_to_prod"))).toBeUndefined();

    const composed = (event: AgentToolEvent) => defaultToolHeader(event) ?? { name: "Deployed" };
    expect(composed(toolEvent("deploy_to_prod"))).toEqual({ name: "Deployed" });
    expect(composed(toolEvent("run_shell"))).toEqual({ name: "Ran" });
  });

  it("is opt-in: an app that passes no formatter sees the raw tool name", () => {
    // The property that makes this a non-event on upgrade. A default applied automatically would
    // rewrite every existing timeline, which is a render change wearing a patch's clothes.
    const events = messagesToAgentEvents([
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-run_shell",
            toolCallId: "c1",
            state: "output-available",
            input: { cmd: "ls" },
            output: "a\nb",
          },
        ],
      },
    ] as never);

    const tool = events.find((e) => e.kind === "tool") as AgentToolEvent | undefined;
    expect(tool?.name).toBe("run_shell");
  });

  it("every verb in the table is a non-empty string", () => {
    for (const [tool, verb] of Object.entries(DEFAULT_TOOL_HEADERS)) {
      expect(verb, tool).toMatch(/\S/u);
    }
  });
});
