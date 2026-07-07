export const VERSION = "0.2.0";

export { TheoTUIProvider, defaultTheme, useTheoTheme } from "./theme.js";
export type { RoleTokens, TheoTheme, TheoThemeOverride } from "./theme.js";

export { CHAT_ROLES, ChatMessage } from "./chat-message.js";
export type { ChatMessageProps, ChatRole } from "./chat-message.js";

export { ChatThread } from "./chat-thread.js";
export type { ChatThreadMessage, ChatThreadProps } from "./chat-thread.js";

export { TOOL_CALL_STATUSES, ToolCall, ToolCallCard } from "./tool-call.js";
export type {
  ToolCallCardProps,
  ToolCallProps,
  ToolCallStatus,
} from "./tool-call.js";

// truncateLines stays module-internal (ADR D7 — SEPA phase-2 F1).
export { MAX_RESULT_CHARS, ToolResult } from "./tool-result.js";
export type { ShellEnvelope, ToolResultProps } from "./tool-result.js";

// ensureHighlighter stays module-internal (EC-10 — D7 precedent).
export { CodeBlock } from "./code-block.js";
export type { CodeBlockProps } from "./code-block.js";
export { DiffViewer } from "./diff-viewer.js";
export type { DiffViewerProps } from "./diff-viewer.js";
export { parseUnifiedDiff } from "./diff-model.js";
export type {
  DiffFile,
  DiffFold,
  DiffLine,
  DiffLineKind,
  DiffRow,
} from "./diff-model.js";

export { AGENT_EVENT_KINDS } from "./agent-event.js";
export type {
  AgentEvent,
  AgentEventKind,
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolEvent,
} from "./agent-event.js";
export { AgentTimeline } from "./agent-timeline.js";
export type { AgentTimelineProps } from "./agent-timeline.js";
// formatElapsed stays module-internal (EC-10 — D7 precedent).
export { AgentStreaming } from "./agent-streaming.js";
export type { AgentStreamingProps } from "./agent-streaming.js";

export { ChatComposer } from "./chat-composer.js";
export type { ChatComposerProps } from "./chat-composer.js";
export { initialTextBuffer, textBufferReducer } from "./text-buffer.js";
export type { TextBufferAction, TextBufferState } from "./text-buffer.js";
