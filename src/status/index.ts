// Public barrel for the status domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export type {
  AppStatusBarProps,
  AppStatusBarTokens,
} from "./app-status-bar.js";
// renderFillBar/formatPercent/displayPercent/formatTokens/formatCost stay
// module-internal (M5 ADR D7 — truncateLines/foldDiffLines precedent).
export { AppStatusBar } from "./app-status-bar.js";
// B-031 — the containment half. `guard-sink` records that a guard fired; this keeps the failure
// from taking the whole application, the user's session, and the shell's idea of success with it.
export { ComponentBoundary } from "./component-boundary.js";
export type { GuardSink } from "./guard-sink.js";
// B-025 — a fired boundary guard leaves one DURABLE record, then throws. Reporting is additive;
// the throw contract 37 test files rest on is untouched.
//
// This comment claimed the opposite until 2026-08-18, and said "Measured:" while doing so: that no
// error boundary was in play and the result on screen was a blank region. Measured against a real
// `render()` with ink@7.1.0, ink's own ErrorBoundary fires and prints a stack to stdout, then the
// app unmounts and the process exits 0 (B-031). What production lacks is DURABILITY — that panel
// is transient stdout, erased by the next repaint.
//
// It survived the sweep that corrected the other four artifacts because that sweep's criterion was
// a grep for one PHRASING and this file used another. The lesson is in `guard-sink.ts`; the record
// of it is here.
export { lostGuardRecords, reportGuardFailure } from "./guard-sink.js";
export type { ModeIndicatorProps, PermissionMode } from "./mode-indicator.js";
// Claude Code parity surfaces: the permission-mode footer (⏵⏵ auto-accept edits
// on) and the persistent inline Notice banner (!! warning / │ info).
export { ModeIndicator, PERMISSION_MODES } from "./mode-indicator.js";
export type { NoticeProps, NoticeVariant } from "./notice.js";
export { NOTICE_VARIANTS, Notice } from "./notice.js";
export type { NotifyProtocol, NotifySink } from "./notify.js";
export { notify } from "./notify.js";
export type { StatusFooterProps } from "./status-footer.js";
// #45: the two-line footer (justified status row + mode/agents row).
export { StatusFooter } from "./status-footer.js";
export type { ToastProps, ToastVariant } from "./toast.js";
export { Toast } from "./toast.js";
export type { TodoItem, TodoListProps, TodoStatus } from "./todo-list.js";
// M24 — live progress surfaces.
export { TodoList } from "./todo-list.js";
// B-011 — the discipline the channels above ship without: say it when it gets worse, and only
// then. Owns no thresholds, no classifier and no copy — deciding WHICH level you are at is the
// caller's policy, and for the measured consumer it lives in another package entirely.
export { useRisingEdge } from "./use-rising-edge.js";
export { useTurnElapsed } from "./use-turn-elapsed.js";
