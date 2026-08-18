// Public barrel for the metrics domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

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

// Determinate progress: the bar primitive + the compaction-style activity
// (`✳ Compacting conversation… (7m 3s · ↑ 24.6k tokens)` over a bar).
export { ProgressBar } from "./progress-bar.js";

export type { ProgressBarProps } from "./progress-bar.js";

export { ProgressActivity } from "./progress-activity.js";

export type { ProgressActivityProps } from "./progress-activity.js";

export { MultiStepProgress } from "./multi-step-progress.js";

export type { MultiStepProgressProps } from "./multi-step-progress.js";

// B-001 — the composed form of the three meters above. Both ends of the projection it performs
// are this package's (`TurnUsage` and `TokenCategory`), so every consumer of `readTurnUsage` was
// writing the same mapping by hand and a change to either end broke each copy silently.
export { UsagePanel, USAGE_PANEL_SECTIONS } from "./usage-panel.js";

export type { UsagePanelProps, UsagePanelSection } from "./usage-panel.js";
