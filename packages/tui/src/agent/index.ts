// Public barrel for the agent domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export type {
  ApprovalChoice,
  ApprovalDecision,
  ChoiceKey,
  ChoiceKeyAction,
  PlanDecision,
  QuestionAnswer,
} from "./agent-decision.js";
export {
  DEFAULT_APPROVAL_CHOICES,
  resolveChoiceKey,
} from "./agent-decision.js";
export type {
  AgentEvent,
  AgentEventKind,
  AgentExploredEvent,
  AgentMessageEvent,
  AgentNoticeEvent,
  AgentThinkingEvent,
  AgentToolEvent,
  ToolRefusal,
} from "./agent-event.js";
export { AGENT_EVENT_KINDS } from "./agent-event.js";
export type {
  AgentStreamEvent,
  AssistantContentBlock,
} from "./agent-stream-event.js";
export type {
  AgentStreamState,
  AgentStreamStatus,
} from "./agent-stream-reducer.js";
export {
  agentStreamReducer,
  initialAgentStreamState,
} from "./agent-stream-reducer.js";
export type {
  AgentSessionCommand,
  AgentSessionControls,
  AgentSessionFooterInfo,
  AgentSessionProps,
} from "./agent-session.js";
export { AgentSession } from "./agent-session.js";
export type { AgentStreamingProps } from "./agent-streaming.js";
// formatElapsed is public, exported from the format barrel (#199).
export { AgentStreaming } from "./agent-streaming.js";
export type { AgentTimelineProps } from "./agent-timeline.js";
export { AgentTimeline } from "./agent-timeline.js";
// Conversation export: Markdown of the messages (and optionally tool lines) + the last assistant reply.
export type { AgentEventsToMarkdownOptions } from "./events-to-markdown.js";
export { agentEventsToMarkdown, lastAssistantText } from "./events-to-markdown.js";
// Adapter: the presenter's canonical `AgentOutputEvent` → `AgentStreamEvent` (type-only presenter dependency).
export type { AgentOutputEventSource } from "./from-agent-output-events.js";
export { fromAgentOutputEvents } from "./from-agent-output-events.js";
export type {
  MessagesToEventsOptions,
  PendingApproval,
  RefusalHeaderFormatter,
  ToolHeaderFormatter,
  ToolResultFormatter,
  TurnUsage,
  UIMessageLike,
  UIMessagePartLike,
} from "./messages-to-events.js";
// ai-free projection of a client message snapshot (id + role + parts) onto the render shapes. The ai SDK's
// `UIMessage` is structurally assignable to `UIMessageLike`, so `useAgent().thread` passes straight through
// without importing `ai`.
export {
  DEFAULT_EXPLORE_TOOLS,
  DEFAULT_TOOL_HEADERS,
  defaultToolHeader,
  findPendingApproval,
  messagesToAgentEvents,
  messagesToChatThread,
  partToPendingApproval,
  readTurnUsage,
  resolveApprovalId,
} from "./messages-to-events.js";
// Stored session (Claude-style tool_use/tool_result parts) → UIMessageLike[] for `initialMessages`.
export type { StoredMessage, StoredMessagePart } from "./session-messages-to-thread.js";
export { sessionMessagesToThread } from "./session-messages-to-thread.js";
export type { TurnDoneProps } from "./turn-done.js";
export { TurnDone, WHIMSY_VERBS, whimsyVerb } from "./turn-done.js";
// UseAgentStreamResult and AssistantContentBlock ship as props-construction
// accessories (hook return type / block embedded in AgentStreamEvent.message)
// — the TokenCategory arch-5 precedent (review F-7 rationale).
export type {
  AgentStreamSource,
  UseAgentStreamOptions,
  UseAgentStreamResult,
} from "./use-agent-stream.js";
// M7 — stream adapter (plan ADR D8): the hook + the pure fold + its zero
// state; the structural event union ships as the source-param type.
// isShellEnvelope/extractAssistantText stay module-internal (reducer detail).
export { useAgentStream } from "./use-agent-stream.js";
// A framework `useAgent()` client → the timeline events + last usage, coalesced.
export type {
  AgentTimelineSource,
  UseAgentTimelineOptions,
  UseAgentTimelineResult,
} from "./use-agent-timeline.js";
export { useAgentTimeline } from "./use-agent-timeline.js";
export type { UseCoalescedOptions } from "./use-coalesced.js";
// B-009 — recompute a derivation at most once per window, with a trailing update so the last
// change is never dropped. Built on `createFrameBudget` (`@theokit/tui/renderer`), which was
// complete and tested and reachable by nobody until this slice exported it.
export { useCoalesced } from "./use-coalesced.js";
