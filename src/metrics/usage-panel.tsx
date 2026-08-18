import { Box } from "ink";
import type { ReactElement } from "react";

import type { TurnUsage } from "../agent/messages-to-events.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { ContextWindowBar } from "./context-window-bar.js";
import { CostMeter } from "./cost-meter.js";
import type { TokenCategory } from "./token-usage-chart.js";
import { TokenUsageChart } from "./token-usage-chart.js";

/** The sections this panel can draw, in their default order. */
export const USAGE_PANEL_SECTIONS = ["context", "tokens", "cost"] as const;

export type UsagePanelSection = (typeof USAGE_PANEL_SECTIONS)[number];

export interface UsagePanelProps extends LayoutMarginProps {
  /** One turn's usage, as `readTurnUsage` reports it. */
  usage: TurnUsage;
  /**
   * Context window size. OMITTED = unknown, and that is a supported state rather than an
   * oversight: `TurnUsage` does not carry the window, so a model that declares none has nothing
   * honest to pass. The bar then renders the absolute count with no percentage — the degradation
   * `ContextWindowBar` already documents. An explicit non-positive number still throws, because
   * that is a programming error and not a missing measurement (plan ADR D3).
   */
  contextWindow?: number;
  /**
   * Which sections to draw, in order. Default `["context", "tokens", "cost"]`.
   *
   * A prop rather than a fixed layout because the ordering is the ONE part of this composition
   * that is a product decision — everything else follows from `TurnUsage`'s shape (plan ADR D1).
   * Not validated: a repeated name draws twice, and an empty list draws nothing. Both are the
   * caller stating something deliberately.
   */
  order?: readonly UsagePanelSection[];
}

/**
 * `TurnUsage` field names to `TokenCategory` keys.
 *
 * The conditional spreads are required, not stylistic: `TokenUsageChartProps.usage` documents
 * that only PRESENT keys render and that a present `0` draws a row. Sending `cached: 0` for a
 * turn that reported no cache read would claim a measurement the agent never made.
 */
function tokenCategories(
  usage: TurnUsage,
): Partial<Record<TokenCategory, number>> {
  return {
    input: usage.inputTokens,
    output: usage.outputTokens,
    ...(usage.cacheReadTokens === undefined
      ? {}
      : { cached: usage.cacheReadTokens }),
    ...(usage.reasoningTokens === undefined
      ? {}
      : { reasoning: usage.reasoningTokens }),
  };
}

/**
 * One renderer per section, keyed by name.
 *
 * A lookup rather than a switch so that `order` is a plain list the caller controls, and so a
 * future section is a new entry here instead of another branch in the component body.
 */
const SECTION_RENDERERS: Record<
  UsagePanelSection,
  (usage: TurnUsage, contextWindow: number | undefined) => ReactElement | null
> = {
  context: (usage, contextWindow) => (
    <ContextWindowBar
      usedTokens={usage.inputTokens}
      {...(contextWindow === undefined ? {} : { limitTokens: contextWindow })}
    />
  ),
  tokens: (usage) => <TokenUsageChart usage={tokenCategories(usage)} />,
  cost: (usage) =>
    usage.cost === undefined ? null : <CostMeter costUsd={usage.cost} />,
};

/**
 * A turn's usage as one block: context bar, token chart, cost meter.
 *
 * Exists because both ends of the projection are this package's — `TurnUsage` and
 * `TokenCategory` are both ours — so every consumer of `readTurnUsage` was writing the same
 * mapping by hand, and a change to either end broke each copy silently.
 */
export function UsagePanel({
  usage,
  contextWindow,
  order = USAGE_PANEL_SECTIONS,
  ...margin
}: UsagePanelProps) {
  // Boundary guard FIRST (the F10 idiom `CostMeter` and `ContextWindowBar` already use), and the
  // component names ITSELF: without this the same input still fails, but from inside
  // `ContextWindowBar`, so the message points at a component the caller never wrote. Absent is a
  // supported state (ADR D3); a non-positive number is a programming error and says so.
  if (
    contextWindow !== undefined &&
    (typeof contextWindow !== "number" ||
      !Number.isFinite(contextWindow) ||
      contextWindow <= 0)
  ) {
    throw new TypeError(
      `UsagePanel: contextWindow must be a finite number > 0 when given — got ${String(contextWindow)}`,
    );
  }
  return (
    <Box flexDirection="column" {...pickMargin(margin)}>
      {order.map((section, index) => (
        <Box key={`${section}:${String(index)}`}>
          {SECTION_RENDERERS[section](usage, contextWindow)}
        </Box>
      ))}
    </Box>
  );
}
