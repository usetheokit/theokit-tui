import { describe, expect, it } from "vitest";

import type { AgentToolEvent } from "../../src/agent/agent-event.js";
import type { ToolResultFormatter } from "../../src/agent/messages-to-events.js";
import { messagesToAgentEvents } from "../../src/agent/messages-to-events.js";

/**
 * usetheokit/theokit-tui#59 item 2 — a formatter returning two exclusive bodies is a TYPE error.
 *
 * `ToolResultFormatter` used to return `Pick<AgentToolEvent, "output" | "shell" | "diff">`, which
 * statically admits all three at once. A formatter that returned two got through the compiler and
 * failed at the timeline's exclusivity guard — which names the TIMELINE, not the formatter that
 * produced the value, and only when the event happens to render.
 *
 * The `@ts-expect-error` lines below are the assertion, and they are load-bearing in both
 * directions: if the union were widened back, the error would stop occurring and `tsc` would fail
 * on the unused suppression. There is no way to write this test so that it silently rots.
 */

const toolMessage = (result: unknown) => [
  {
    id: "m1",
    role: "assistant" as const,
    parts: [
      {
        type: "tool-run_shell",
        toolCallId: "t1",
        state: "output-available",
        input: { command: "ls" },
        output: result,
      },
    ],
  },
];

describe("ToolResultFormatter — the three bodies are exclusive by type", () => {
  it("test_a_single_body_is_accepted", () => {
    const formatter: ToolResultFormatter = () => ({ output: "just the text" });
    const events = messagesToAgentEvents(toolMessage("raw"), { formatToolResult: formatter });
    const tool = events.find((e): e is AgentToolEvent => e.kind === "tool");
    expect(tool?.output).toBe("just the text");
    expect(tool?.diff).toBeUndefined();
    expect(tool?.shell).toBeUndefined();
  });

  it("test_two_bodies_at_once_do_not_typecheck", () => {
    // @ts-expect-error — output and diff are exclusive; this is the defect the union closes.
    const both: ToolResultFormatter = () => ({ output: "text", diff: "--- a\n+++ b" });
    const alsoBoth: ToolResultFormatter = () => ({
      output: "text",
      // @ts-expect-error — shell and output likewise. The directive sits on the PROPERTY, not on
      // the statement: the formatter's shape spans several lines once formatted, and a directive
      // on the opening line points at a line the error is not reported on.
      shell: { stdout: "", stderr: "" },
    });
    // Referenced so the bindings are not dead code; the assertion is the compiler's, above.
    expect(typeof both).toBe("function");
    expect(typeof alsoBoth).toBe("function");
  });

  it("test_undefined_still_means_keep_the_default_routing", () => {
    // The escape hatch an app uses for the tools it does not map. Narrowing the return type must
    // not have narrowed this away.
    const formatter: ToolResultFormatter = () => undefined;
    const events = messagesToAgentEvents(toolMessage("plain output"), {
      formatToolResult: formatter,
    });
    const tool = events.find((e): e is AgentToolEvent => e.kind === "tool");
    expect(tool?.output).toBe("plain output");
  });
});
