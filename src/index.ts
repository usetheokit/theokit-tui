export const VERSION = "0.33.0";

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

// Universal layout margin API — every public component's props extend
// LayoutMarginProps, so any component accepts margin/marginX/marginY and the
// four sides and applies them to its root layout.
export { LAYOUT_MARGIN_KEYS, omitMargin, pickMargin } from "./layout-props.js";
export type { LayoutMarginProps } from "./layout-props.js";

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
export type { ToolCardResult } from "./tool-card-result.js";
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
export { Image } from "./image.js";
export type { ImageProps } from "./image.js";

// M22 — interaction primitives.
export { OverlayProvider, useOverlay } from "./renderer/hooks/use-overlay.js";
export { Pager } from "./pager.js";
export type { PagerProps } from "./pager.js";
export {
  pagerReducer,
  scrollPercent,
  visibleRange,
  maxOffset,
} from "./pager-model.js";
export type { PagerState, PagerAction } from "./pager-model.js";
export { SelectList } from "./select-list.js";
export type { SelectListProps } from "./select-list.js";
export { deriveSelectList, windowFor } from "./select-list-model.js";
export type {
  SelectListItem,
  SelectListView,
  WindowView,
} from "./select-list-model.js";

// M23 — agent-decision surfaces.
export { ChoiceRow } from "./choice-row.js";
export type { ChoiceRowProps } from "./choice-row.js";
export { ApprovalPrompt } from "./approval-prompt.js";
export type { ApprovalPromptProps } from "./approval-prompt.js";
export { QuestionPrompt, OTHER_OPTION_VALUE } from "./question-prompt.js";
export type { QuestionPromptProps } from "./question-prompt.js";
export { PlanApproval } from "./plan-approval.js";
export type { PlanApprovalProps } from "./plan-approval.js";
export { FreeTextInput } from "./free-text-input.js";
export type { FreeTextInputProps } from "./free-text-input.js";
export {
  DEFAULT_APPROVAL_CHOICES,
  resolveChoiceKey,
} from "./agent-decision-model.js";
export type {
  ApprovalChoice,
  ApprovalDecision,
  QuestionAnswer,
  PlanDecision,
  ChoiceKey,
  ChoiceKeyAction,
} from "./agent-decision-model.js";

// M24 — live progress surfaces.
export { TodoList } from "./todo-list.js";
export type { TodoListProps, TodoItem, TodoStatus } from "./todo-list.js";
export { MultiStepProgress } from "./multi-step-progress.js";
export type { MultiStepProgressProps } from "./multi-step-progress.js";
export { CollapsibleBlock, ThinkingBlock } from "./collapsible-block.js";
export type {
  CollapsibleBlockProps,
  ThinkingBlockProps,
} from "./collapsible-block.js";
export { Toast } from "./toast.js";
export type { ToastProps, ToastVariant } from "./toast.js";
export { notify } from "./notify.js";
export type { NotifyProtocol, NotifySink } from "./notify.js";

// M25 — parity polish.
export { ExpandableOutput } from "./expandable-output.js";
export type { ExpandableOutputProps } from "./expandable-output.js";
export {
  setTerminalTitle,
  osc8Link,
  supportsHyperlinks,
} from "./terminal-osc.js";
export type { OscSink } from "./terminal-osc.js";

// Keyboard-shortcut help panel (Claude Code's `?` overlay). Pairs with
// ChatComposer.onHelpToggle (fires when `?` is pressed on an empty buffer).
export { KeyboardHelp, DEFAULT_COMPOSER_SHORTCUTS } from "./keyboard-help.js";
export type { KeyboardHelpProps, KeyboardShortcut } from "./keyboard-help.js";

// M27 — ASCII-art banner header. <Banner> is pure/sync (renders a provided `art`
// string or degrades to the bold name); `renderFigletArt` generates art via an
// OPTIONAL `figlet` peer (degrades to null when absent).
export { Banner } from "./banner.js";
export type { BannerProps, BannerStatusRow } from "./banner.js";
export { renderFigletArt, bannerArtWidth } from "./figlet-art.js";
export type { FigletLike, FigletLoader } from "./figlet-art.js";

// ai-free projection of a client message snapshot (id + role + parts) onto the render shapes. The ai SDK's
// `UIMessage` is structurally assignable to `UIMessageLike`, so `useAgent().thread` passes straight through
// without importing `ai`. (The `@theokit/tui/ai-sdk` subpath re-exports these under `ai`-typed aliases.)
export {
  messagesToAgentEvents,
  messagesToChatThread,
  readTurnUsage,
} from "./messages-to-events.js";
export type {
  TurnUsage,
  UIMessageLike,
  UIMessagePartLike,
} from "./messages-to-events.js";
