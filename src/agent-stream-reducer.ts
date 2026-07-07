import type { AgentEvent, AgentToolEvent } from "./agent-event.js";
import type { AgentStreamEvent } from "./agent-stream-event.js";
import { extractAssistantText, isShellEnvelope } from "./agent-stream-event.js";
import type { ToolCallStatus } from "./tool-call.js";

// Pure mapping fold (plan m7-stream-adapter ADR D2): AgentStreamEvent →
// AgentStreamState whose `events` IS AgentTimeline's exact input. Every
// divergence from the theo-ui mirror is FORCED by the M3 boundary contracts
// (duplicate-id throw, output⊕shell exclusivity, tail-replace-by-identity,
// <Static> graduation immutability) — see the blueprint's D2 table.
// No ink/react import — the fold is testable and reusable without a renderer.

export type AgentStreamStatus = "idle" | "streaming" | "done" | "error";

export interface AgentStreamState {
  /** AgentTimeline's exact input — folded, boundary-safe. */
  events: AgentEvent[];
  /** AgentStreaming props source (thought = unGRADUATED reasoning buffer). */
  streaming: { active: boolean; thought?: string };
  status: AgentStreamStatus;
  error?: Error;
  /** Monotonic id counter (in-state purity — mirror precedent). */
  seq: number;
  /** The tail-replace anchor currently open (EC-5 lifecycle). */
  liveMessageId?: string;
}

export const initialAgentStreamState: AgentStreamState = {
  events: [],
  streaming: { active: false },
  status: "idle",
  seq: 0,
};

/** D9: the thought buffer graduates to a timeline event at the first
 * EFFECTFUL non-thinking fold — never on ignored/unknown events (EC-10).
 * Graduation APPENDS, so it CLOSES any open live message first (review F-1
 * — close-on-effectful-fold extends to graduation): otherwise the anchor
 * would be buried behind the thinking event and the next delta would
 * tail-replace a NON-tail message, violating the M3 only-the-tail contract
 * (frozen in <Static> scrollback). */
function graduateThought(state: AgentStreamState): AgentStreamState {
  const thought = state.streaming.thought;
  if (thought === undefined) {
    return state;
  }
  const closed = withoutLiveMessage(state);
  const seq = closed.seq + 1;
  return {
    ...closed,
    seq,
    events: [
      ...closed.events,
      { id: `think-${seq}`, kind: "thinking", text: thought },
    ],
    streaming: { active: closed.streaming.active },
  };
}

/** EC-5: the live-message anchor closes by REMOVING the property
 * (exactOptionalPropertyTypes — an explicit undefined is not assignable). */
function withoutLiveMessage(state: AgentStreamState): AgentStreamState {
  if (state.liveMessageId === undefined) {
    return state;
  }
  const rest = { ...state };
  delete rest.liveMessageId;
  return rest;
}

function foldThinkingText(
  state: AgentStreamState,
  event: AgentStreamEvent,
): AgentStreamState {
  const thought = (state.streaming.thought ?? "") + (event.text ?? "");
  return {
    ...state,
    status: "streaming",
    streaming: { active: true, thought },
  };
}

function foldTextDelta(
  state: AgentStreamState,
  event: AgentStreamEvent,
): AgentStreamState {
  const next = graduateThought(state);
  const chunk = event.text ?? "";
  if (next.liveMessageId !== undefined) {
    // Tail-replace by identity (M3 streaming anchor): same id, NEW object.
    const events = next.events.map((item) =>
      item.id === next.liveMessageId && item.kind === "message"
        ? { ...item, text: item.text + chunk }
        : item,
    );
    return {
      ...next,
      events,
      status: "streaming",
      streaming: { active: true },
    };
  }
  const seq = next.seq + 1;
  const id = `msg-${seq}`;
  return {
    ...next,
    seq,
    liveMessageId: id,
    events: [
      ...next.events,
      { id, kind: "message", role: "assistant", text: chunk },
    ],
    status: "streaming",
    streaming: { active: true },
  };
}

function foldAssistant(
  state: AgentStreamState,
  event: AgentStreamEvent,
): AgentStreamState {
  const next = graduateThought(state);
  const text = extractAssistantText(event.message);
  if (next.liveMessageId !== undefined) {
    // Finalize IN PLACE: authoritative text, or the buffer when the
    // assistant payload extracts empty; the anchor closes either way (EC-5).
    const events = next.events.map((item) =>
      item.id === next.liveMessageId && item.kind === "message"
        ? { ...item, text: text === "" ? item.text : text }
        : item,
    );
    return { ...withoutLiveMessage(next), events, status: "streaming" };
  }
  if (text === "") {
    // Mint-empty rule: tool_use-only / empty assistants create no event
    // (EC-11 — tool lifecycle arrives via tool_call events).
    return next;
  }
  const seq = next.seq + 1;
  return {
    ...next,
    seq,
    events: [
      ...next.events,
      { id: `msg-${seq}`, kind: "message", role: "assistant", text },
    ],
    status: "streaming",
  };
}

const TOOL_STATUS_MAP: Record<string, ToolCallStatus> = {
  pending: "pending",
  running: "running",
  completed: "success",
  // Declared SDK member honored even if unconstructed today (D2).
  error: "failed",
};

/** Result mapping ladder: shell passthrough XOR output — NEVER both. */
function toolContent(
  result: unknown,
): Pick<AgentToolEvent, "output" | "shell"> {
  if (result === undefined) {
    return {};
  }
  if (isShellEnvelope(result)) {
    return {
      shell: {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        ...(typeof result.exitCode === "number"
          ? { exitCode: result.exitCode }
          : {}),
      },
    };
  }
  if (typeof result === "string") {
    return { output: result };
  }
  const text = (result as { text?: unknown }).text;
  if (typeof text === "string") {
    return { output: text };
  }
  return { output: JSON.stringify(result) };
}

/** A resultless late update (e.g. a status-only error after completed)
 * inherits the already-folded content (review F-6) — never discards it. */
function resolveToolContent(
  result: unknown,
  existing: AgentToolEvent | undefined,
): Pick<AgentToolEvent, "output" | "shell"> {
  if (result !== undefined) {
    return toolContent(result);
  }
  return {
    ...(existing?.output === undefined ? {} : { output: existing.output }),
    ...(existing?.shell === undefined ? {} : { shell: existing.shell }),
  };
}

function foldToolCall(
  state: AgentStreamState,
  event: AgentStreamEvent,
): AgentStreamState {
  // Close-on-effectful-fold (EC-1): the live message is finalized at its
  // buffer so it is ALWAYS the tail while open — the M3 only-the-tail
  // replaceability rule holds literally.
  const next = withoutLiveMessage(graduateThought(state));
  let seq = next.seq;
  let id: string;
  if (event.call_id !== undefined && event.call_id !== "") {
    id = `tool-${event.call_id}`;
  } else {
    // The `#` prefix cannot collide with any producer call_id literal (EC-9).
    seq += 1;
    id = `tool-#${seq}`;
  }
  // Single lookup, FULL predicate (review F-5): a producer call_id that
  // collides with a non-tool id appends instead of overwriting — the M3
  // duplicate-id throw then fails loud at the boundary, never silently.
  const index = next.events.findIndex(
    (item) => item.kind === "tool" && item.id === id,
  );
  const existing =
    index === -1 ? undefined : (next.events[index] as AgentToolEvent);
  const content = resolveToolContent(event.result, existing);
  const toolEvent: AgentToolEvent = {
    id,
    kind: "tool",
    name: event.name ?? existing?.name ?? "tool",
    status: TOOL_STATUS_MAP[event.status ?? ""] ?? "running",
    ...content,
  };
  const events =
    index === -1
      ? [...next.events, toolEvent]
      : next.events.map((item, at) => (at === index ? toolEvent : item));
  return {
    ...next,
    seq,
    events,
    status: "streaming",
    streaming: { active: true },
  };
}

/** EC-2/EC-6: terminal folds fail every non-terminal tool (new objects,
 * same ids). KNOWN LIMIT (review F-3, plan Drawback "graduation-stale tool
 * upsert — accepted v0"): a tool already graduated into <Static> scrollback
 * (windowSize+overscan events behind) was printed once and will NOT repaint
 * — the failed status is visible only within the live window. Status-aware
 * windowing is a future ADR, not a hotfix. */
function failNonTerminalTools(events: AgentEvent[]): AgentEvent[] {
  return events.map((item) =>
    item.kind === "tool" &&
    (item.status === "pending" || item.status === "running")
      ? { ...item, status: "failed" as const }
      : item,
  );
}

function toError(payload: AgentStreamEvent["error"]): Error {
  if (typeof payload === "string" && payload !== "") {
    return new Error(payload);
  }
  if (typeof payload === "object" && payload !== null && payload.message) {
    return new Error(payload.message);
  }
  return new Error("agent stream reported an error without a message");
}

function foldTerminal(
  state: AgentStreamState,
  status: "done" | "error",
  error?: Error,
): AgentStreamState {
  const next = withoutLiveMessage(graduateThought(state));
  return {
    ...next,
    events: failNonTerminalTools(next.events),
    status,
    streaming: { active: false },
    ...(error === undefined ? {} : { error }),
  };
}

const HANDLERS: Record<
  string,
  (state: AgentStreamState, event: AgentStreamEvent) => AgentStreamState
> = {
  "text-delta": foldTextDelta,
  "thinking-delta": foldThinkingText,
  thinking: foldThinkingText,
  assistant: foldAssistant,
  tool_call: foldToolCall,
  error: (state, event) => foldTerminal(state, "error", toError(event.error)),
  done: (state) => foldTerminal(state, "done"),
};

/**
 * The pure stream fold. Terminal means terminal: every event after
 * `done`/`error` is DROPPED (EC-3 — the mirror's accidental resurrection
 * rejected). `system`/`user`/`status` (cloud)/`task`/unknown → no-op: the
 * cloud-status vocabulary NEVER folds as tool status (EC-10).
 */
export function agentStreamReducer(
  state: AgentStreamState,
  event: AgentStreamEvent,
): AgentStreamState {
  if (state.status === "done" || state.status === "error") {
    return state;
  }
  const handler = HANDLERS[event.type];
  return handler === undefined ? state : handler(state, event);
}
