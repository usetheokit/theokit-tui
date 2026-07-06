import { Box, Text } from "ink";
import Spinner from "ink-spinner";

import { useTheoTheme } from "./theme.js";
import type { TheoTheme } from "./theme.js";

/** Tool-call lifecycle states (M2 — plan ADR D1; M3 may extend additively). */
export type ToolCallStatus = "pending" | "running" | "success" | "failed";

/** Fixed indicator column width aligning card headers (gemini-cli idiom). */
export const STATUS_INDICATOR_WIDTH = 3;

// Module-local glyph constants (documented M6 theming candidates — ADR D1).
const STATUS_GLYPHS: Record<Exclude<ToolCallStatus, "running">, string> = {
  pending: "o",
  success: "✓",
  failed: "x",
};

const VALID_STATUSES: readonly ToolCallStatus[] = [
  "pending",
  "running",
  "success",
  "failed",
];

export interface ToolCallProps {
  /**
   * Tool name rendered bold after the indicator. The header is ONE line by
   * contract — newlines are sanitized to spaces (EC-8). ANSI/control chars
   * pass through unsanitized (caller responsibility at M2 — EC-16).
   */
  name: string;
  /** Lifecycle state — selects glyph/spinner + status color (ADR D1). */
  status: ToolCallStatus;
  /** Optional dim one-line summary after the name (newlines sanitized). */
  summary?: string;
}

/** Collapse any newlines so the header stays a single line (EC-8). */
const singleLine = (value: string): string => value.replace(/\r?\n/g, " ");

function statusIndicator(status: ToolCallStatus, theme: TheoTheme) {
  if (status === "running") {
    // Each mounted running indicator owns one interval timer (ink-spinner);
    // many concurrent running cards = many timers (plan risk register).
    return (
      <Text color={theme.status.warning}>
        <Spinner type="dots" />
      </Text>
    );
  }
  const colors: Record<Exclude<ToolCallStatus, "running">, string> = {
    pending: theme.role.system.prefix,
    success: theme.status.success,
    failed: theme.status.error,
  };
  return (
    <Text color={colors[status]} bold={status === "failed"}>
      {STATUS_GLYPHS[status]}
    </Text>
  );
}

/**
 * Inline tool-call row: 3-cell status indicator + bold name + dim summary.
 * Status arrives via props — transitions are plain rerenders (ADR D3).
 */
export function ToolCall({ name, status, summary }: ToolCallProps) {
  // Boundary validation (rules/error-handling.md § 2): fail fast with a typed
  // error BEFORE any hook — JS consumers get the contract, not a crash.
  if (!VALID_STATUSES.includes(status)) {
    throw new TypeError(
      `ToolCall: invalid status "${String(status)}" — expected "pending" | "running" | "success" | "failed"`,
    );
  }
  const theme = useTheoTheme();
  return (
    <Box>
      <Box minWidth={STATUS_INDICATOR_WIDTH}>
        {statusIndicator(status, theme)}
      </Box>
      <Text bold>{singleLine(name)}</Text>
      {summary !== undefined && <Text dimColor> {singleLine(summary)}</Text>}
    </Box>
  );
}
