// Public barrel for the status domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

// renderFillBar/formatPercent/displayPercent/formatTokens/formatCost stay
// module-internal (M5 ADR D7 — truncateLines/foldDiffLines precedent).
export { AppStatusBar } from "./app-status-bar.js";

export type {
  AppStatusBarProps,
  AppStatusBarTokens,
} from "./app-status-bar.js";

export { useTurnElapsed } from "./use-turn-elapsed.js";

// Claude Code parity surfaces: the permission-mode footer (⏵⏵ auto-accept edits
// on) and the persistent inline Notice banner (!! warning / │ info).
export { ModeIndicator, PERMISSION_MODES } from "./mode-indicator.js";

export type { ModeIndicatorProps, PermissionMode } from "./mode-indicator.js";

export { Notice, NOTICE_VARIANTS } from "./notice.js";

export type { NoticeProps, NoticeVariant } from "./notice.js";

// #45: the two-line footer (justified status row + mode/agents row).
export { StatusFooter } from "./status-footer.js";

export type { StatusFooterProps } from "./status-footer.js";

// M24 — live progress surfaces.
export { TodoList } from "./todo-list.js";

export type { TodoListProps, TodoItem, TodoStatus } from "./todo-list.js";

export { Toast } from "./toast.js";

export type { ToastProps, ToastVariant } from "./toast.js";

export { notify } from "./notify.js";

export type { NotifyProtocol, NotifySink } from "./notify.js";
