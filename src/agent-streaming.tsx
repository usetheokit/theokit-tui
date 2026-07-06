import { Box, Text } from "ink";
import Spinner from "ink-spinner";

import { useTheoTheme } from "./theme.js";

/**
 * Human elapsed-time formatting (plan ADR D4): `0s`…`59s`, `1m 5s`,
 * `1h 2m 3s` — NO days unit (`86400` → `24h 0m 0s`, EC-11). Fractional input
 * is FLOORED first (EC-4 — `Date.now()` diffs produce 59.9). Exported for
 * unit tests; NOT re-exported from the package entry (EC-10, D7 precedent).
 */
export function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new TypeError(
      `formatElapsed: seconds must be a finite number >= 0 — got ${String(seconds)}`,
    );
  }
  const total = Math.floor(seconds);
  if (total < 60) {
    return `${total}s`;
  }
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) {
    return `${minutes}m ${rest}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${rest}s`;
}

export interface AgentStreamingProps {
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
  /** Renders the dim `(esc to cancel[, {elapsed}])` suffix. */
  showCancelHint?: boolean;
}

const singleLine = (value: string): string => value.replace(/\r?\n/g, " ");

/**
 * Live agent-turn indicator: spinner + thought + optional cancel hint
 * (plan ADR D4 — one line, no internal timers).
 */
export function AgentStreaming({
  thought,
  elapsedSeconds,
  showCancelHint = false,
}: AgentStreamingProps) {
  // Boundary validation before hooks (F10 idiom): elapsed is validated even
  // when the hint is hidden — prop validity must not depend on another prop.
  const elapsed =
    elapsedSeconds !== undefined ? formatElapsed(elapsedSeconds) : undefined;
  const theme = useTheoTheme();
  const primary = singleLine(thought || "Thinking…");
  const suffix =
    elapsed !== undefined ? `(esc to cancel, ${elapsed})` : "(esc to cancel)";
  return (
    <Box>
      <Box minWidth={3}>
        <Text color={theme.status.warning}>
          <Spinner type="dots" />
        </Text>
      </Box>
      <Text italic wrap="truncate-end">
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
