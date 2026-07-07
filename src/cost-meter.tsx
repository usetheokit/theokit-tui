import { Box, Text } from "ink";

import { formatCost } from "./format.js";

export interface CostMeterProps {
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
export function CostMeter({ costUsd, approx = true }: CostMeterProps) {
  // Boundary guard FIRST (F10 idiom); formatCost validates once — the
  // component names itself in the error.
  if (typeof costUsd !== "number" || !Number.isFinite(costUsd) || costUsd < 0) {
    throw new TypeError(
      `CostMeter: costUsd must be a finite number >= 0 — got ${String(costUsd)}`,
    );
  }
  return (
    <Box>
      <Text dimColor>cost </Text>
      <Text>{formatCost(costUsd, { approx })}</Text>
    </Box>
  );
}
