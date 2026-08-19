import { Box, Text } from "ink";

import { renderFillBar } from "./fill-bar.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";
import { reportGuardFailure } from "../status/guard-sink.js";

// ProgressBar — a determinate progress bar: a filled run + an empty run + an
// optional `N%` label (`█████░░░░░ 50%`). The fill segment is the theme accent;
// the empty segment is dim. `percent` clamps to [0,100] (degrade, never throw on
// an out-of-range value); a non-number is a boundary error. Built on the shared
// `renderFillBar` so bar-and-label agree by construction.

export interface ProgressBarProps extends LayoutMarginProps {
  /** Progress in [0,100]. Out-of-range values clamp; non-numbers throw. */
  percent: number;
  /** Bar width in cells (default 24). */
  width?: number;
  /** Append ` {N}%` after the bar (default true). */
  showPercent?: boolean;
  /** Filled-cell glyph (default `█`). */
  fullChar?: string;
  /** Empty-cell glyph (default `░`). */
  emptyChar?: string;
}

export function ProgressBar({
  percent,
  width = 24,
  showPercent = true,
  fullChar,
  emptyChar,
  ...margin
}: ProgressBarProps) {
  // Boundary validation FIRST (F10 idiom).
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    reportGuardFailure(
      "ProgressBar",
      new TypeError(
        `ProgressBar: percent must be a finite number — got ${String(percent)}`,
      ),
    );
  }
  const clamped = Math.max(0, Math.min(100, percent));
  const theme = useTheoTheme();
  const seg = renderFillBar(clamped / 100, width, {
    ...(fullChar !== undefined ? { fullChar } : {}),
    ...(emptyChar !== undefined ? { emptyChar } : {}),
  });
  return (
    <Box {...pickMargin(margin)}>
      <Text {...(isMonochrome(theme) ? {} : { color: theme.accent })}>
        {seg.filled}
      </Text>
      <Text dimColor>{seg.empty}</Text>
      {showPercent && <Text dimColor> {Math.round(clamped)}%</Text>}
    </Box>
  );
}
