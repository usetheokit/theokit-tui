import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ReactNode } from "react";

import { useTheoTheme } from "./theme.js";
import type { TheoTheme } from "./theme.js";
import { unionMessage } from "./union-message.js";

// Single source for the status union (SEPA phase-1 F6): the type, the runtime
// guard, and the error message all derive from this array — an M3 additive
// status touches it (plus a glyph/spinner branch) exactly once.
export const TOOL_CALL_STATUSES = [
  "pending",
  "running",
  "success",
  "failed",
] as const;
const VALID_STATUSES = TOOL_CALL_STATUSES;

/** Tool-call lifecycle states (M2 — plan ADR D1; M3 may extend additively). */
export type ToolCallStatus = (typeof VALID_STATUSES)[number];

const STATUS_UNION_MESSAGE = unionMessage(VALID_STATUSES);

/** Fixed indicator column width aligning card headers (gemini-cli idiom). */
export const STATUS_INDICATOR_WIDTH = 3;

// Status visuals live in theme.toolStatus since M6 (glyph + color tokens);
// `failed` bold stays a component attribute (attributes are never tokens —
// they are the channel that survives color loss). NOTE: pending's color is a
// token literal — it no longer follows role.system.prefix overrides.

export interface ToolCallProps {
  /**
   * Tool name rendered bold after the indicator. The header is ONE line by
   * contract — newlines are sanitized to spaces (EC-8). ANSI/control chars
   * pass through unsanitized (caller responsibility at M2 — EC-16).
   */
  name: string;
  /** Lifecycle state — selects glyph/spinner + status color (ADR D1). */
  status: ToolCallStatus;
  /**
   * Optional dim one-line summary after the name (newlines sanitized).
   * KNOWN RENDER TRADE-OFF (SEPA phase-1 F9): Ink's SGR merger does not close
   * the name's bold before opening dim (`[1m…[2m…[22m`), so bold-capable
   * terminals render the summary bold+faint — faint dominates visually; same
   * output shape as the gemini-cli header. Revisit with the M6 theme system.
   */
  summary?: string;
}

/** Collapse any newlines so the header stays a single line (EC-8). */
const singleLine = (value: string): string => value.replace(/\r?\n/g, " ");

function statusIndicator(status: ToolCallStatus, theme: TheoTheme) {
  if (status === "running") {
    // Each mounted running indicator owns one interval timer (ink-spinner);
    // many concurrent running cards = many timers (plan risk register).
    return (
      <Text color={theme.toolStatus.running.color}>
        <Spinner type="dots" />
      </Text>
    );
  }
  const token = theme.toolStatus[status];
  return (
    <Text color={token.color} bold={status === "failed"}>
      {token.glyph}
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
  // Guards MUST stay above the first hook: tests invoke this component as a
  // plain function (Ink's error boundary swallows render throws — F10).
  if (!VALID_STATUSES.includes(status)) {
    throw new TypeError(
      `ToolCall: invalid status "${String(status)}" — expected ${STATUS_UNION_MESSAGE}`,
    );
  }
  const theme = useTheoTheme();
  // wrap="truncate-end" keeps the header genuinely one line at ANY terminal
  // width (review dom-frontend-3 — gemini-cli ToolGroupDisplay idiom); a
  // wrapping row of sibling Texts misrenders as parallel columns.
  return (
    <Box>
      <Box minWidth={STATUS_INDICATOR_WIDTH}>
        {statusIndicator(status, theme)}
      </Box>
      <Text bold wrap="truncate-end">
        {singleLine(name)}
      </Text>
      {summary !== undefined && (
        <Text dimColor wrap="truncate-end">
          {" "}
          {singleLine(summary)}
        </Text>
      )}
    </Box>
  );
}

export interface ToolCallCardProps extends ToolCallProps {
  /**
   * Card body, indented under the name (no borders at M2 — ADR D3).
   * Plain STRING children are auto-wrapped in `<Text>` (a raw string inside
   * Ink's `<Box>` throws — EC-4); an empty string collapses to the bare row.
   */
  children?: ReactNode;
}

/**
 * Tool-call card: `ToolCall` header + body indented by the indicator width.
 * Without children (or with an empty string) it renders exactly the row.
 */
export function ToolCallCard({ children, ...row }: ToolCallCardProps) {
  // SEPA phase-1 F5: numbers crash Ink like strings do (auto-wrap both);
  // booleans are the `{cond && <X/>}` idiom's residue — no body.
  const body =
    typeof children === "string" || typeof children === "number" ? (
      <Text>{children}</Text>
    ) : (
      children
    );
  const hasBody =
    children !== undefined &&
    children !== null &&
    children !== "" &&
    typeof children !== "boolean";
  return (
    <Box flexDirection="column">
      <ToolCall {...row} />
      {hasBody && <Box paddingLeft={STATUS_INDICATOR_WIDTH}>{body}</Box>}
    </Box>
  );
}
