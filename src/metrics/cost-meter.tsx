import { Box, Text } from "ink";

import { assertFiniteNonNegative, formatCost } from "../format/format.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";

export interface CostMeterProps extends LayoutMarginProps {
  /**
   * Precomputed session cost in USD (M5 renders, M7 adapters compute — no
   * pricing tables in this package). Finite, >= 0.
   */
  costUsd: number;
  /**
   * Show the "~" estimate marker (the number derives from token counts ×
   * price sheets). Default true; exact zero and sub-cent renders never carry
   * the marker (plan ADR D3).
   */
  approx?: boolean;
}

/**
 * Honest cost display: `cost ~$1.23`; a nonzero sub-cent cost renders
 * `<$0.01`, never `$0.00`. No bar, no thresholds (no budget semantics at M5).
 */
export function CostMeter({
  costUsd,
  approx = true,
  ...margin
}: CostMeterProps) {
  // Boundary guard FIRST (F10 idiom) — the component names itself in the
  // error; formatCost re-validates at its own boundary (single shared guard).
  assertFiniteNonNegative(
    costUsd,
    "CostMeter: costUsd must be a finite number >= 0",
  );
  return (
    <Box {...margin}>
      <Text dimColor>cost </Text>
      <Text>{formatCost(costUsd, { approx })}</Text>
    </Box>
  );
}
