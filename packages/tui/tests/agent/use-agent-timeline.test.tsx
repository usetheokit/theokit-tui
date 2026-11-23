import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";

import type { UIMessageLike } from "../../src/agent/messages-to-events.js";
import {
  type UseAgentTimelineOptions,
  type UseAgentTimelineResult,
  useAgentTimeline,
} from "../../src/agent/use-agent-timeline.js";
import { waitFor } from "../fixtures/wait-for.js";

afterEach(cleanup);

const msg = (
  id: string,
  role: UIMessageLike["role"],
  text: string,
  metadata?: unknown,
): UIMessageLike => ({
  id,
  role,
  parts: [{ type: "text", text }],
  ...(metadata === undefined ? {} : { metadata }),
});

interface Captured {
  current?: UseAgentTimelineResult;
}

function Probe({
  thread,
  options,
  captured,
}: {
  thread: readonly UIMessageLike[];
  options?: UseAgentTimelineOptions;
  captured: Captured;
}) {
  const result = useAgentTimeline({ thread }, options);
  captured.current = result;
  return <Text>{result.events.length}</Text>;
}

const usage = { inputTokens: 1, outputTokens: 2, totalTokens: 3 };

describe("useAgentTimeline", () => {
  it("projects_thread_after_prefix", () => {
    const captured: Captured = {};
    const prefix = [msg("g", "assistant", "hello")];
    render(<Probe thread={[msg("u1", "user", "hi")]} options={{ prefix }} captured={captured} />);
    expect(captured.current?.events.map((e) => e.kind === "message" && e.text)).toEqual([
      "hello",
      "hi",
    ]);
  });

  it("reports_the_last_usage_in_the_thread", () => {
    const captured: Captured = {};
    const thread = [
      msg("a1", "assistant", "one", { usage }),
      msg("a2", "assistant", "two", { usage: { ...usage, totalTokens: 9 } }),
      msg("u", "user", "three"),
    ];
    render(<Probe thread={thread} captured={captured} />);
    expect(captured.current?.usage?.totalTokens).toBe(9);
  });

  it("has_no_usage_when_no_turn_reported_any", () => {
    const captured: Captured = {};
    render(<Probe thread={[msg("u", "user", "x")]} captured={captured} />);
    expect(captured.current?.usage).toBeUndefined();
  });

  it("applies_formatToolHeader", () => {
    const captured: Captured = {};
    const thread: UIMessageLike[] = [
      {
        id: "a",
        role: "assistant",
        parts: [
          {
            type: "tool-shell",
            toolCallId: "t1",
            state: "output-available",
            input: { command: "ls" },
            output: "x",
          },
        ],
      },
    ];
    render(
      <Probe
        thread={thread}
        options={{ formatToolHeader: () => ({ name: "Custom" }) }}
        captured={captured}
      />,
    );
    const tool = captured.current?.events.find((e) => e.kind === "tool");
    expect(tool?.kind === "tool" && tool.name).toBe("Custom");
  });

  it("shows_the_trailing_update_after_a_thread_change_inside_the_window", async () => {
    const captured: Captured = {};
    const options = { windowMs: 20 };
    const { rerender } = render(
      <Probe thread={[msg("u", "user", "a")]} options={options} captured={captured} />,
    );
    rerender(
      <Probe
        thread={[msg("u", "user", "a"), msg("a", "assistant", "b")]}
        options={options}
        captured={captured}
      />,
    );
    await waitFor(() => captured.current?.events.length === 2, {
      describe: "the trailing update to be shown",
    });
  });
});
