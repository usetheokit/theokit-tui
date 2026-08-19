import { Box, Text } from "ink";

import {
  MIN_BAR_CELLS,
  displayPercent,
  formatPercent,
  renderFillBar,
} from "./fill-bar.js";
import { assertFiniteNonNegative, formatTokens } from "../format/format.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { useTheoTheme } from "../theme/theme.js";
import { reportGuardFailure } from "../status/guard-sink.js";

/** Warn when the used ratio reaches this fraction (gemini default). */
const WARNING_RATIO = 0.5;

export interface ContextWindowBarProps extends LayoutMarginProps {
  /** Absolute tokens currently in the context window. Finite, >= 0. */
  usedTokens: number;
  /**
   * Context window size. OMITTED = unknown — renders the absolute count only,
   * never a fabricated percentage (the codex Some(100) anti-pattern).
   */
  limitTokens?: number;
  /**
   * Label wording: "left" (default — codex, carries the detail clause) or
   * "used" (gemini). The BAR always fills with usage in both conventions;
   * the 'left' percent derives from the same display authority
   * (100 − displayPercent), so label and bar can never disagree.
   */
  convention?: "left" | "used";
  /**
   * Tokens subtracted from BOTH used and limit before the ratio (codex
   * effective-window parity — opt-in, default 0). Ignored when the limit is
   * unknown (the baseline is a ratio concept).
   */
  baselineTokens?: number;
  /** Total column budget (bar + label + detail). Integer >= 0. Default 40. */
  width?: number;
}

function assertTokenProps({
  usedTokens,
  limitTokens,
  baselineTokens,
}: ContextWindowBarProps): void {
  try {
    assertFiniteNonNegative(
      usedTokens,
      "ContextWindowBar: usedTokens must be a finite number >= 0",
    );
  } catch (err) {
    reportGuardFailure("ContextWindowBar", err as Error);
  }
  if (
    limitTokens !== undefined &&
    (typeof limitTokens !== "number" ||
      !Number.isFinite(limitTokens) ||
      limitTokens <= 0)
  ) {
    reportGuardFailure(
      "ContextWindowBar",
      new TypeError(
        `ContextWindowBar: limitTokens must be a finite number > 0 — got ${String(limitTokens)}`,
      ),
    );
  }
  if (baselineTokens !== undefined) {
    try {
      assertFiniteNonNegative(
        baselineTokens,
        "ContextWindowBar: baselineTokens must be a finite number >= 0",
      );
    } catch (err) {
      reportGuardFailure("ContextWindowBar", err as Error);
    }
  }
}

function assertProps(props: ContextWindowBarProps): void {
  assertTokenProps(props);
  const { limitTokens, baselineTokens, width } = props;
  if (
    limitTokens !== undefined &&
    baselineTokens !== undefined &&
    baselineTokens >= limitTokens
  ) {
    reportGuardFailure(
      "ContextWindowBar",
      new TypeError(
        `ContextWindowBar: baselineTokens must be < limitTokens — got ${String(baselineTokens)} / ${String(limitTokens)}`,
      ),
    );
  }
  if (width !== undefined && (!Number.isInteger(width) || width < 0)) {
    reportGuardFailure(
      "ContextWindowBar",
      new TypeError(
        `ContextWindowBar: width must be an integer >= 0 — got ${String(width)}`,
      ),
    );
  }
}

/**
 * Context-window fill gauge. Endpoint-honest: "100%"/"0%" are reserved for the
 * truly-full/truly-empty states (99.6% used reads "1% left" with a visibly
 * non-full bar). Props carry the LAST-TURN context size, not a session total —
 * the distinction is the caller's (codex separates the two).
 */
export function ContextWindowBar(props: ContextWindowBarProps) {
  // Boundary guards FIRST, before hooks (F10 idiom).
  assertProps(props);
  const m = pickMargin(props);
  const {
    usedTokens,
    limitTokens,
    convention = "left",
    baselineTokens = 0,
    width = 40,
  } = props;
  const theme = useTheoTheme();

  if (limitTokens === undefined) {
    return (
      <Box {...m}>
        <Text dimColor>{formatTokens(usedTokens)} tokens used</Text>
      </Box>
    );
  }

  const usedRatio =
    Math.max(0, usedTokens - baselineTokens) / (limitTokens - baselineTokens);
  // 'used' consumes the authority's label form directly; 'left' DERIVES from
  // the same displayPercent — NEVER a second formatPercent(1 − usedRatio)
  // call (the EC-1 float trap: 1 − 5e-17 === 1 → "100% left" overclaim).
  const label =
    convention === "used"
      ? `${formatPercent(usedRatio)} used`
      : `${String(100 - displayPercent(usedRatio))}% left`;
  const detail = `(${formatTokens(usedTokens)} used / ${formatTokens(limitTokens)})`;

  const barCells = width - label.length - detail.length - 2;
  if (barCells < MIN_BAR_CELLS) {
    return (
      <Box {...m}>
        <Text>{label}</Text>
      </Box>
    );
  }

  const segments = renderFillBar(usedRatio, barCells);
  const fillColor =
    usedRatio >= 1
      ? theme.status.error
      : usedRatio >= WARNING_RATIO
        ? theme.status.warning
        : theme.accent;
  return (
    <Box {...m}>
      <Text color={fillColor}>{segments.filled}</Text>
      <Text dimColor>{segments.empty}</Text>
      <Text> {label}</Text>
      <Text dimColor> {detail}</Text>
    </Box>
  );
}
