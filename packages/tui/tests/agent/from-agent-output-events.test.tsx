import type { AgentOutputEvent } from "@theokit/presenter";
import { describe, expect, it } from "vitest";

import { AgentTimeline } from "../../src/agent/agent-timeline.js";
import type { AgentStreamEvent } from "../../src/agent/agent-stream-event.js";
import {
  agentStreamReducer,
  initialAgentStreamState,
} from "../../src/agent/agent-stream-reducer.js";
import { fromAgentOutputEvents } from "../../src/agent/from-agent-output-events.js";
import { stripAnsi } from "../../src/format/ansi.js";
import { renderFrame } from "../fixtures/helpers.js";

async function collect(source: AsyncIterable<AgentStreamEvent>): Promise<AgentStreamEvent[]> {
  const out: AgentStreamEvent[] = [];
  for await (const event of source) out.push(event);
  return out;
}

const fold = (events: readonly AgentStreamEvent[]) =>
  events.reduce(agentStreamReducer, initialAgentStreamState);

const canonical: AgentOutputEvent[] = [
  { type: "text", text: "Let me " },
  { type: "text", text: "look." },
  { type: "tool-call", callId: "c1", name: "shell", input: { command: "ls" } },
  {
    type: "tool-result",
    callId: "c1",
    name: "shell",
    result: { stdout: "a.ts\n", stderr: "", exitCode: 0 },
  },
  { type: "text", text: "Done." },
  { type: "finish", reason: "stop" },
];

const equivalent: AgentStreamEvent[] = [
  { type: "text-delta", text: "Let me " },
  { type: "text-delta", text: "look." },
  { type: "tool_call", call_id: "c1", name: "shell", status: "running", args: { command: "ls" } },
  {
    type: "tool_call",
    call_id: "c1",
    name: "shell",
    status: "completed",
    result: { stdout: "a.ts\n", stderr: "", exitCode: 0 },
  },
  { type: "text-delta", text: "Done." },
  { type: "done" },
];

describe("fromAgentOutputEvents", () => {
  it("maps_each_canonical_event_to_its_stream_event", async () => {
    expect(await collect(fromAgentOutputEvents(canonical))).toEqual(equivalent);
  });

  it("renders_the_same_timeline_as_the_equivalent_stream", async () => {
    const adapted = fold(await collect(fromAgentOutputEvents(canonical)));
    const direct = fold(equivalent);
    expect(adapted.events).toEqual(direct.events);
    expect(adapted.status).toBe("done");
    const frame = async (events: typeof direct.events) =>
      stripAnsi(await renderFrame(<AgentTimeline events={[...events]} />));
    expect(await frame(adapted.events)).toBe(await frame(direct.events));
  });

  it("accepts_an_async_source", async () => {
    async function* gen(): AsyncGenerator<AgentOutputEvent> {
      yield { type: "text", text: "hi" };
    }
    expect(await collect(fromAgentOutputEvents(gen()))).toEqual([
      { type: "text-delta", text: "hi" },
    ]);
  });

  it("maps_reasoning_partial_calls_errors_and_failed_results", async () => {
    const events = await collect(
      fromAgentOutputEvents([
        { type: "reasoning", text: "hmm" },
        { type: "partial-tool-call", callId: "c", name: "read", input: { p: "a" } },
        { type: "tool-result", callId: "c", name: "read", result: "boom", isError: true },
        { type: "error", message: "bad" },
      ]),
    );
    expect(events).toEqual([
      { type: "thinking-delta", text: "hmm" },
      { type: "tool_call", call_id: "c", name: "read", status: "running", args: { p: "a" } },
      { type: "tool_call", call_id: "c", name: "read", status: "error", result: "boom" },
      { type: "error", error: { message: "bad" } },
    ]);
    const state = fold(events);
    expect(state.status).toBe("error");
    expect(state.error?.message).toBe("bad");
  });

  it("drops_status_events", async () => {
    expect(await collect(fromAgentOutputEvents([{ type: "status", status: "active" }]))).toEqual(
      [],
    );
  });
});
