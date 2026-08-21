import { Box, Text, useStdout } from "ink";
import { useEffect, useState } from "react";
import { isMotionEnabled } from "../branding/motion.js";
import { useSparkle } from "../branding/sparkle.js";
import { assertFiniteNonNegative, formatElapsed, formatTokens } from "../format/format.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";

// M24 (plan m24-live-progress-surfaces T5.1, ADR D7): the phrase-cycler is a
// module-internal BOUNDED driver — a deterministic round-robin (NOT gemini's
// Math.random, which fake timers can't test) advanced on a ~2s interval, torn
// down on unmount, and scheduling ZERO timers when motion is disabled or there is
// nothing to cycle. Not per-frame (2s cadence), so no OWN bench is required.
const PHRASE_INTERVAL_MS = 2000;

function usePhraseCycler(count: number, active: boolean): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || count <= 1) return;
    const id = setInterval(() => setIndex((current) => (current + 1) % count), PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, count]);
  return count > 0 ? index % count : 0;
}

/** Resolve the primary line, cycling `phrases` (round-robin) while motion is on
 * and there is more than one; byte-identical to `thought || "Thinking…"` when no
 * `phrases` are given. Encapsulates the cycler so the component stays flat. */
function usePhraseLine(
  phrases: readonly string[] | undefined,
  thought: string | undefined,
  motion: boolean,
): string {
  const count = phrases?.length ?? 0;
  const active = phrases !== undefined && motion && count > 1;
  const index = usePhraseCycler(count, active);
  const cycled = count > 0 ? phrases![index] : undefined;
  return resolvePrimaryLine(active, cycled, thought, phrases);
}

export interface AgentStreamingProps extends LayoutMarginProps {
  /**
   * Thought subject shown as the primary line (italic, truncate-end). Empty
   * or absent falls back to `Thinking…` (EC-3 — `||`). Newlines sanitized to
   * spaces (single-line contract).
   */
  thought?: string;
  /**
   * Elapsed seconds shown inside the cancel hint. The indicator is DUMB — it
   * holds NO timer; ticking is the caller's/M7's concern (gemini
   * LoadingIndicator idiom, ADR D4). Not rendered when `showCancelHint` is
   * false — but STILL validated (fail-fast; prop validity must not depend on
   * another prop).
   */
  elapsedSeconds?: number;
  /**
   * Live token count shown in the interrupt hint as `· {formatTokens(tokens)}
   * tokens` (Claude Code shape). Finite, >= 0. Only rendered when
   * `showCancelHint` is set, but validated regardless (fail-fast).
   */
  tokens?: number;
  /**
   * #44: prefixes the token count with a direction arrow — `↓` (context
   * shrinking) or `↑` (growing): `↓ 30.6k tokens`. Absent → the bare count.
   */
  tokenDirection?: "up" | "down";
  /**
   * Renders the dim interrupt hint — the Claude-Code-shaped
   * `({elapsed} · {N} tokens · esc to interrupt)`, with the elapsed and tokens
   * segments present only when their props are supplied.
   */
  showCancelHint?: boolean;
  /**
   * M24 opt-in: a set of witty status phrases cycled (round-robin, ~2s) while
   * motion is enabled. Inert (static first phrase) under reduced-motion / non-TTY
   * / monochrome; absent → the current `thought || "Thinking…"` behavior is
   * byte-identical.
   */
  phrases?: readonly string[];
  /** M24 opt-in: pulse the primary line (dim ↔ normal, ~600ms) while motion is
   * enabled. Inert under reduced-motion. */
  shimmer?: boolean;
}

const SHIMMER_PULSE_MS = 600;

function useShimmerPulse(active: boolean): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setOn((v) => !v), SHIMMER_PULSE_MS);
    return () => clearInterval(id);
  }, [active]);
  return active && on;
}

const singleLine = (value: string): string => value.replace(/\r?\n/g, " ");

/** The Claude-Code interrupt hint: `({elapsed} · {N} tokens · esc to interrupt)`,
 * with each leading segment present only when supplied. */
function buildInterruptHint(
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
  parts.push("esc to interrupt");
  return `(${parts.join(" · ")})`;
}

/** The primary line: the cycled phrase while cycling, else the static fallback
 * (`thought || first phrase || "Thinking…"` — byte-identical for no-opt-in callers). */
function resolvePrimaryLine(
  phraseActive: boolean,
  cycled: string | undefined,
  thought: string | undefined,
  phrases: readonly string[] | undefined,
): string {
  const raw =
    phraseActive && cycled !== undefined ? cycled : thought || phrases?.[0] || "Thinking…";
  return singleLine(raw);
}

/**
 * Live agent-turn indicator: spinner + thought + optional cancel hint
 * (plan ADR D4 — one line, no internal timers).
 */
export function AgentStreaming({
  thought,
  elapsedSeconds,
  tokens,
  tokenDirection,
  showCancelHint = false,
  phrases,
  shimmer = false,
  ...margin
}: AgentStreamingProps) {
  // Boundary validation before hooks (F10 idiom): elapsed + tokens are validated
  // even when the hint is hidden — prop validity must not depend on another prop.
  const elapsed = elapsedSeconds !== undefined ? formatElapsed(elapsedSeconds) : undefined;
  if (tokens !== undefined) {
    assertFiniteNonNegative(tokens, "AgentStreaming: tokens must be >= 0");
  }
  const theme = useTheoTheme();
  const { stdout } = useStdout();
  const motion = isMotionEnabled(process.env, stdout, isMonochrome(theme));

  const primary = usePhraseLine(phrases, thought, motion);
  const dimPulse = useShimmerPulse(shimmer && motion);
  const sparkle = useSparkle(motion);
  const suffix = buildInterruptHint(elapsed, tokens, tokenDirection);
  return (
    <Box {...margin}>
      <Box minWidth={3}>
        <Text color={theme.toolStatus.running.color}>{sparkle}</Text>
      </Box>
      <Text italic wrap="truncate-end" {...(dimPulse ? { dimColor: true } : {})}>
        {primary}
      </Text>
      {showCancelHint && (
        <Text dimColor wrap="truncate-end">
          {" "}
          {suffix}
        </Text>
      )}
    </Box>
  );
}
