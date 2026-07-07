import { Box, Text } from "ink";

import { displayPercent, renderFillBar } from "./fill-bar.js";
import { formatTokens } from "./format.js";
import { useTheoTheme } from "./theme.js";

// Module-local accent for the sub-warning fill (M6 theming candidate — the
// M2 glyph / M4 palette precedent; do NOT hardcode per-state colors inline).
const ACCENT_COLOR = "cyan";

/** Bar cells below this floor render label-only (EC-4/EC-5 — binary degrade). */
const MIN_BAR_CELLS = 3;

/** Warn when the used ratio reaches this fraction (gemini default). */
const WARNING_RATIO = 0.5;

export interface ContextWindowBarProps {
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

function isNonNegativeFinite(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function assertTokenProps({
  usedTokens,
  limitTokens,
  baselineTokens,
}: ContextWindowBarProps): void {
  if (!isNonNegativeFinite(usedTokens)) {
    throw new TypeError(
      `ContextWindowBar: usedTokens must be a finite number >= 0 — got ${String(usedTokens)}`,
    );
  }
  if (
    limitTokens !== undefined &&
    (!isNonNegativeFinite(limitTokens) || limitTokens === 0)
  ) {
    throw new TypeError(
      `ContextWindowBar: limitTokens must be a finite number > 0 — got ${String(limitTokens)}`,
    );
  }
  if (baselineTokens !== undefined && !isNonNegativeFinite(baselineTokens)) {
    throw new TypeError(
      `ContextWindowBar: baselineTokens must be a finite number >= 0 — got ${String(baselineTokens)}`,
    );
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
    throw new TypeError(
      `ContextWindowBar: baselineTokens must be < limitTokens — got ${String(baselineTokens)} / ${String(limitTokens)}`,
    );
  }
  if (width !== undefined && (!Number.isInteger(width) || width < 0)) {
    throw new TypeError(
      `ContextWindowBar: width must be an integer >= 0 — got ${String(width)}`,
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
  const {
    usedTokens,
    limitTokens,
    convention = "left",
    baselineTokens = 0,
    width = 40,
  } = props;
  const theme = useTheoTheme();

  if (limitTokens === undefined) {
    return <Text dimColor>{formatTokens(usedTokens)} tokens used</Text>;
  }

  const usedRatio =
    Math.max(0, usedTokens - baselineTokens) / (limitTokens - baselineTokens);
  const usedPercent = displayPercent(usedRatio);
  const percent = convention === "left" ? 100 - usedPercent : usedPercent;
  const label = `${String(percent)}% ${convention}`;
  const detail = `(${formatTokens(usedTokens)} used / ${formatTokens(limitTokens)})`;

  const barCells = width - label.length - detail.length - 2;
  if (barCells < MIN_BAR_CELLS) {
    return <Text>{label}</Text>;
  }

  const segments = renderFillBar(usedRatio, barCells);
  const fillColor =
    usedRatio >= 1
      ? theme.status.error
      : usedRatio >= WARNING_RATIO
        ? theme.status.warning
        : ACCENT_COLOR;
  return (
    <Box>
      <Text color={fillColor}>{segments.filled}</Text>
      <Text dimColor>{segments.empty}</Text>
      <Text> {label}</Text>
      <Text dimColor> {detail}</Text>
    </Box>
  );
}
