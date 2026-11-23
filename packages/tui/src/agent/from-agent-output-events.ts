import type { AgentOutputEvent } from "@theokit/presenter";

import type { AgentStreamEvent } from "./agent-stream-event.js";

// Type-only: `@theokit/presenter` is never loaded at runtime, so a consumer that does not use the
// presenter pays nothing and does not need it installed to run (only to type-check the adapter).

/** What {@link fromAgentOutputEvents} accepts: a sync or async sequence of canonical events. */
export type AgentOutputEventSource = AsyncIterable<AgentOutputEvent> | Iterable<AgentOutputEvent>;

/** Translate ONE canonical event, or `undefined` when the stream vocabulary has no equivalent. */
function toStreamEvent(event: AgentOutputEvent): AgentStreamEvent | undefined {
  switch (event.type) {
    case "text":
      return { type: "text-delta", text: event.text };
    case "reasoning":
      return { type: "thinking-delta", text: event.text };
    case "tool-call":
    case "partial-tool-call":
      return {
        type: "tool_call",
        call_id: event.callId,
        name: event.name,
        status: "running",
        args: event.input,
      };
    case "tool-result":
      return {
        type: "tool_call",
        call_id: event.callId,
        name: event.name,
        status: event.isError === true ? "error" : "completed",
        result: event.result,
      };
    case "error":
      return { type: "error", error: { message: event.message } };
    case "finish":
      return { type: "done" };
    default:
      // `status` has no stream counterpart (the reducer folds unknown types to a no-op anyway).
      return undefined;
  }
}

/**
 * Adapt the presenter's canonical `AgentOutputEvent` sequence to the `AgentStreamEvent` sequence
 * `useAgentStream` consumes, so one canonical event renders in the terminal through the existing fold.
 *
 * - `text` → `text-delta`; `reasoning` → `thinking-delta`.
 * - `tool-call` / `partial-tool-call` → a running `tool_call` carrying the input as `args`.
 * - `tool-result` → a completed (or, with `isError`, errored) `tool_call` for the same `callId`.
 * - `error` → `error`; `finish` → `done`.
 * - `status` is dropped, and so are `finish.usage` and a tool result's `refusal`: the stream
 *   vocabulary has no field for them.
 */
export async function* fromAgentOutputEvents(
  events: AgentOutputEventSource,
): AsyncGenerator<AgentStreamEvent> {
  for await (const event of events) {
    const mapped = toStreamEvent(event);
    if (mapped !== undefined) yield mapped;
  }
}
