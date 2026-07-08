export const VERSION = "0.15.0";

export {
  TheoTUIProvider,
  defaultTheme,
  themes,
  useTheoTheme,
} from "./theme.js";
export type {
  CodeTokens,
  GlyphToken,
  RoleTokens,
  TheoBuiltinThemeName,
  TheoTheme,
  TheoThemeOverride,
  TheoThemeProp,
  ToolStatusTokens,
} from "./theme.js";

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

// ensureHighlighter stays module-internal (EC-10 — D7 precedent);
// preloadHighlighter is the PUBLIC readiness seam (DV-5, review batch).
export { CodeBlock, preloadHighlighter } from "./code-block.js";
export { MarkdownText } from "./markdown-text.js";
export type { MarkdownTextProps } from "./markdown-text.js";
export type { CodeBlockProps } from "./code-block.js";
export { DiffViewer } from "./diff-viewer.js";
export type { DiffViewerProps } from "./diff-viewer.js";
export { parseUnifiedDiff } from "./diff-model.js";
// DiffFold/DiffRow stay module-internal (D10 — no public producer/consumer).
export type { DiffFile, DiffLine, DiffLineKind } from "./diff-model.js";

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

// renderFillBar/formatPercent/displayPercent/formatTokens/formatCost stay
// module-internal (M5 ADR D7 — truncateLines/foldDiffLines precedent).
export { AppStatusBar } from "./app-status-bar.js";
export type {
  AppStatusBarProps,
  AppStatusBarTokens,
} from "./app-status-bar.js";
export { useTurnElapsed } from "./use-turn-elapsed.js";
export { ContextWindowBar } from "./context-window-bar.js";
export type { ContextWindowBarProps } from "./context-window-bar.js";
export { TokenUsageChart } from "./token-usage-chart.js";
// TokenCategory ships as a props-construction accessory (it is the key type
// embedded in TokenUsageChartProps.usage) — review arch-5 rationale.
export type {
  TokenCategory,
  TokenUsageChartProps,
} from "./token-usage-chart.js";
export { CostMeter } from "./cost-meter.js";
export type { CostMeterProps } from "./cost-meter.js";

export { ChatComposer } from "./chat-composer.js";
export type {
  ChatComposerCommand,
  ChatComposerProps,
} from "./chat-composer.js";
export { initialTextBuffer, textBufferReducer } from "./text-buffer.js";
export type { TextBufferAction, TextBufferState } from "./text-buffer.js";

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

// M9 — welcome banner (plan ADR D1): the startup-banner primitive.
export { WelcomeBanner } from "./welcome-banner.js";
export type { WelcomeBannerProps } from "./welcome-banner.js";
