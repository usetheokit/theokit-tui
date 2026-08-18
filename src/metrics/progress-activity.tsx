import { Box, Text, useStdout } from "ink";

import {
  assertFiniteNonNegative,
  formatElapsed,
  formatTokens,
} from "../format/format.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { isMotionEnabled } from "../branding/motion.js";
import { ProgressBar } from "./progress-bar.js";
import { useSparkle } from "../branding/sparkle.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";

// ProgressActivity — a determinate task with the Claude Code compaction look:
//
//   ✳ Compacting conversation… (7m 3s · ↑ 24.6k tokens)
//   ██░░…░░ 10%
//
// A sparkle header (label + optional elapsed / directional token count) over a
// ProgressBar. Distinct from AgentStreaming (the INDETERMINATE stream with an
// interrupt hint): this is a DETERMINATE task with a percentage. Display-only —
// the app drives `percent`, `elapsedSeconds`, `tokens`.

export interface ProgressActivityProps extends LayoutMarginProps {
  /** The task label, e.g. `Compacting conversation…`. Single line. */
  label: string;
  /** Progress in [0,100]. */
  percent: number;
  /** Elapsed seconds → `7m 3s` in the meta suffix. */
  elapsedSeconds?: number;
  /** Token count → `24.6k tokens` in the meta suffix. Finite, >= 0. */
  tokens?: number;
  /** `↑` (context growing) / `↓` (shrinking) before the token count. */
  tokenDirection?: "up" | "down";
  /** Bar width in cells (default 40). */
  barWidth?: number;
  /** Bar glyphs, forwarded to ProgressBar. */
  fullChar?: string;
  emptyChar?: string;
}

/** The dim meta suffix ` ({elapsed} · {arrow}{tokens} tokens)`, or `` when both absent. */
function metaSuffix(
  elapsed: string | undefined,
  tokens: number | undefined,
  direction: "up" | "down" | undefined,
): string {
  const parts: string[] = [];
  if (elapsed !== undefined) parts.push(elapsed);
  if (tokens !== undefined) {
    const arrow = direction === "up" ? "↑ " : direction === "down" ? "↓ " : "";
    parts.push(`${arrow}${formatTokens(tokens)} tokens`);
  }
  return parts.length > 0 ? ` (${parts.join(" · ")})` : "";
}

export function ProgressActivity({
  label,
  percent,
  elapsedSeconds,
  tokens,
  tokenDirection,
  barWidth = 40,
  fullChar,
  emptyChar,
  ...margin
}: ProgressActivityProps) {
  // Boundary validation FIRST (F10 idiom).
  const elapsed =
    elapsedSeconds !== undefined ? formatElapsed(elapsedSeconds) : undefined;
  if (tokens !== undefined) {
    assertFiniteNonNegative(tokens, "ProgressActivity: tokens must be >= 0");
  }
  const theme = useTheoTheme();
  const { stdout } = useStdout();
  const motion = isMotionEnabled(process.env, stdout, isMonochrome(theme));
  const sparkle = useSparkle(motion);
  const mono = isMonochrome(theme);
  return (
    <Box flexDirection="column" {...pickMargin(margin)}>
      <Box>
        <Box minWidth={2} flexShrink={0}>
          <Text {...(mono ? {} : { color: theme.toolStatus.running.color })}>
            {sparkle}
          </Text>
        </Box>
        <Text wrap="truncate-end">{label.replace(/\r?\n/g, " ")}</Text>
        <Text dimColor wrap="truncate-end">
          {metaSuffix(elapsed, tokens, tokenDirection)}
        </Text>
      </Box>
      <ProgressBar
        percent={percent}
        width={barWidth}
        marginLeft={2}
        {...(fullChar !== undefined ? { fullChar } : {})}
        {...(emptyChar !== undefined ? { emptyChar } : {})}
      />
    </Box>
  );
}
