import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import type { AgentStreamEvent } from "../../src/agent/agent-stream-event.js";
import { AgentTimeline } from "../../src/agent/agent-timeline.js";
import type { UIMessageLike } from "../../src/agent/messages-to-events.js";
import type {
  AgentStreamSource,
  UseAgentStreamOptions,
  UseAgentStreamResult,
} from "../../src/agent/use-agent-stream.js";
import { useAgentStream } from "../../src/agent/use-agent-stream.js";

// Issue #179 — a surface that repoints its session renders empty because the
// fold only ever grows from the live stream. `initialMessages` is the seam:
// the projected history is a PREFIX of what the hook returns, so it survives a
// reconnect (which resets the fold) and can arrive after mount.

const delta = (text: string): AgentStreamEvent => ({ type: "text-delta", text });

async function ticks(count = 20): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

async function* finiteStream(events: AgentStreamEvent[]): AsyncGenerator<AgentStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

const HISTORY: readonly UIMessageLike[] = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "fix the failing test" }] },
  { id: "a1", role: "assistant", parts: [{ type: "text", text: "resumed from disk" }] },
];

interface Captured {
  current?: UseAgentStreamResult;
}

function Probe({
  source,
  options,
  captured,
}: {
  source?: AgentStreamSource;
  options?: UseAgentStreamOptions;
  captured: Captured;
}) {
  const result = useAgentStream(source, options);
  captured.current = result;
  return <Text>{result.status}</Text>;
}

function requireState(captured: Captured): UseAgentStreamResult {
  if (captured.current === undefined) {
    throw new Error("probe captured no state");
  }
  return captured.current;
}

function texts(state: UseAgentStreamResult): string[] {
  return state.events.map((event) => (event.kind === "message" ? event.text : `<${event.kind}>`));
}

describe("useAgentStream seeded thread (#179)", () => {
  it("seeded_history_renders_before_live_events", async () => {
    const captured: Captured = {};
    const { unmount } = render(
      <Probe
        source={finiteStream([delta("live")])}
        options={{ initialMessages: HISTORY }}
        captured={captured}
      />,
    );
    await ticks();
    const state = requireState(captured);
    expect(state.status).toBe("done");
    expect(texts(state)).toEqual(["fix the failing test", "resumed from disk", "live"]);
    // The M3 boundary oracle: seeded + folded ids stay unique and renderable.
    const boundary = render(createElement(AgentTimeline, { events: state.events }));
    boundary.unmount();
    unmount();
  });

  it("seeded_history_is_idle_until_the_stream_starts", async () => {
    const captured: Captured = {};
    const { unmount } = render(
      <Probe options={{ initialMessages: HISTORY }} captured={captured} />,
    );
    await ticks(3);
    const state = requireState(captured);
    // The seed is history, not a fold: nothing has streamed yet.
    expect(state.status).toBe("idle");
    expect(state.streaming.active).toBe(false);
    expect(texts(state)).toEqual(["fix the failing test", "resumed from disk"]);
    unmount();
  });

  it("seeded_history_survives_a_source_change", async () => {
    // A new source identity resets the FOLD (D5 reconnect-by-refold). History
    // is not a fold, so it must still be there afterwards.
    const captured: Captured = {};
    const options: UseAgentStreamOptions = { initialMessages: HISTORY };
    const first: AgentStreamSource = () => finiteStream([delta("first")]);
    const { rerender, unmount } = render(
      <Probe source={first} options={options} captured={captured} />,
    );
    await ticks();
    expect(texts(requireState(captured))).toEqual([
      "fix the failing test",
      "resumed from disk",
      "first",
    ]);

    const second: AgentStreamSource = () => finiteStream([delta("second")]);
    rerender(<Probe source={second} options={options} captured={captured} />);
    await ticks();
    expect(texts(requireState(captured))).toEqual([
      "fix the failing test",
      "resumed from disk",
      "second",
    ]);
    unmount();
  });

  it("history_arriving_after_mount_is_seeded", async () => {
    // The transcript is usually read asynchronously: the surface mounts first
    // and the messages land a tick later.
    const captured: Captured = {};
    const source: AgentStreamSource = () => finiteStream([delta("live")]);
    const { rerender, unmount } = render(<Probe source={source} captured={captured} />);
    await ticks();
    expect(texts(requireState(captured))).toEqual(["live"]);

    rerender(<Probe source={source} options={{ initialMessages: HISTORY }} captured={captured} />);
    await ticks(3);
    expect(texts(requireState(captured))).toEqual([
      "fix the failing test",
      "resumed from disk",
      "live",
    ]);
    unmount();
  });

  it("no_seed_leaves_the_folded_events_untouched", async () => {
    const captured: Captured = {};
    const source: AgentStreamSource = () => finiteStream([delta("a")]);
    const { rerender, unmount } = render(
      <Probe source={source} options={{ initialMessages: [] }} captured={captured} />,
    );
    await ticks();
    const state = requireState(captured);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ id: "msg-1", text: "a" });
    // An empty seed must not re-allocate the returned array on a render that
    // changed nothing — AgentTimeline's incremental validation reads identity.
    const before = state.events;
    rerender(<Probe source={source} options={{ initialMessages: [] }} captured={captured} />);
    await ticks();
    expect(requireState(captured).events).toBe(before);
    unmount();
  });

  it("seed_projection_options_reach_the_projection", async () => {
    const captured: Captured = {};
    const history: readonly UIMessageLike[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-read_file",
            toolCallId: "call-1",
            state: "output-available",
            input: { path: "a.ts" },
            output: "ok",
          },
        ],
      },
    ];
    const { unmount } = render(
      <Probe
        options={{
          initialMessages: history,
          exploreTools: [],
          formatToolHeader: () => ({ name: "Read", summary: "a.ts" }),
        }}
        captured={captured}
      />,
    );
    await ticks(3);
    expect(requireState(captured).events[0]).toMatchObject({
      kind: "tool",
      name: "Read",
      summary: "a.ts",
    });
    unmount();
  });
});
