// Public barrel for the agent domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export { AGENT_EVENT_KINDS } from "./agent-event.js";

export type {
  AgentEvent,
  AgentEventKind,
  AgentExploredEvent,
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolEvent,
} from "./agent-event.js";

export { AgentTimeline } from "./agent-timeline.js";

export type { AgentTimelineProps } from "./agent-timeline.js";

// formatElapsed stays module-internal (EC-10 — D7 precedent).
export { AgentStreaming } from "./agent-streaming.js";

export type { AgentStreamingProps } from "./agent-streaming.js";

// M7 — stream adapter (plan ADR D8): the hook + the pure fold + its zero
// state; the structural event union ships as the source-param type.
// isShellEnvelope/extractAssistantText stay module-internal (reducer detail).
export { useAgentStream } from "./use-agent-stream.js";

// UseAgentStreamResult and AssistantContentBlock ship as props-construction
// accessories (hook return type / block embedded in AgentStreamEvent.message)
// — the TokenCategory arch-5 precedent (review F-7 rationale).
export type {
  AgentStreamSource,
  UseAgentStreamResult,
} from "./use-agent-stream.js";

export {
  agentStreamReducer,
  initialAgentStreamState,
} from "./agent-stream-reducer.js";

export type {
  AgentStreamState,
  AgentStreamStatus,
} from "./agent-stream-reducer.js";

export type {
  AgentStreamEvent,
  AssistantContentBlock,
} from "./agent-stream-event.js";

export {
  DEFAULT_APPROVAL_CHOICES,
  resolveChoiceKey,
} from "./agent-decision.js";

export type {
  ApprovalChoice,
  ApprovalDecision,
  QuestionAnswer,
  PlanDecision,
  ChoiceKey,
  ChoiceKeyAction,
} from "./agent-decision.js";

// ai-free projection of a client message snapshot (id + role + parts) onto the render shapes. The ai SDK's
// `UIMessage` is structurally assignable to `UIMessageLike`, so `useAgent().thread` passes straight through
// without importing `ai`.
export {
  DEFAULT_EXPLORE_TOOLS,
  findPendingApproval,
  messagesToAgentEvents,
  messagesToChatThread,
  readTurnUsage,
} from "./messages-to-events.js";

export type {
  MessagesToEventsOptions,
  PendingApproval,
  ToolHeaderFormatter,
  ToolResultFormatter,
  TurnUsage,
  UIMessageLike,
  UIMessagePartLike,
} from "./messages-to-events.js";

// B-009 — recompute a derivation at most once per window, with a trailing update so the last
// change is never dropped. Built on `createFrameBudget` (`@theokit/tui/renderer`), which was
// complete and tested and reachable by nobody until this slice exported it.
export { useCoalesced } from "./use-coalesced.js";

export type { UseCoalescedOptions } from "./use-coalesced.js";
