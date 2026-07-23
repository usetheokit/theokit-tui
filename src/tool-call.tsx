import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ReactNode } from "react";

import { useTheoTheme } from "./theme.js";
import type { TheoTheme } from "./theme.js";
import { CodeBlock } from "./code-block.js";
import { parseUnifiedDiff } from "./diff-model.js";
import { DiffViewer } from "./diff-viewer.js";
import { assertToolCardResult } from "./tool-card-result.js";
import type { ToolCardResult } from "./tool-card-result.js";
import { ToolResult } from "./tool-result.js";
import { unionMessage } from "./union-message.js";
import { omitMargin, pickMargin } from "./layout-props.js";
import type { LayoutMarginProps } from "./layout-props.js";

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

export interface ToolCallProps extends LayoutMarginProps {
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
   * RENDER NOTE (updated M10): ink7 closes the name's bold BEFORE opening
   * dim (`[1m…[22m[2m…[22m`) — the summary renders dim-only on
   * bold-capable terminals. The former ink5 bold+faint overlap (SEPA
   * phase-1 F9, `[1m…[2m…[22m`) is extinct; snapshots re-recorded at M10
   * pin the new sequencing. Attributes stay component-level, never tokens
   * (M6 plan D1) — still gemini-parity in shape.
   */
  summary?: string;
}

/** Collapse any newlines so the header stays a single line (EC-8). */
const singleLine = (value: string): string => value.replace(/\r?\n/g, " ");

/** M26: the `(args)` suffix of a `name(args)` header — empty when there is no
 * summary, so a bare name never renders empty parens. Exported for unit tests. */
export function formatArgs(summary: string | undefined): string {
  return summary === undefined || summary === "" ? "" : `(${summary})`;
}

/**
 * PascalCase display standard for tool names (Claude Code parity): raw
 * snake_case/kebab-case/camelCase identifiers render as `GitDiff`, `ReadFile`,
 * `WebSearch`. Display-only — matching (explored grouping, formatToolHeader)
 * stays on the RAW name. Names containing whitespace are app-supplied human
 * headers ("Ran node --test") and pass through untouched. Exported for unit
 * tests.
 */
export function formatToolName(name: string): string {
  if (name === "" || /\s/.test(name)) {
    return name;
  }
  return name
    .split(/[_-]+/)
    .filter((part) => part !== "")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

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
export function ToolCall({ name, status, summary, ...margin }: ToolCallProps) {
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
  // M26: `name(args)` — the summary becomes a parenthesized, dim arg suffix
  // glued to the name (Claude Code header shape), single-lined + truncated.
  const args = formatArgs(
    summary === undefined ? undefined : singleLine(summary),
  );
  // wrap="truncate-end" keeps the header genuinely one line at ANY terminal
  // width (review dom-frontend-3 — gemini-cli ToolGroupDisplay idiom); a
  // wrapping row of sibling Texts misrenders as parallel columns.
  return (
    <Box {...pickMargin(margin)}>
      <Box minWidth={STATUS_INDICATOR_WIDTH}>
        {statusIndicator(status, theme)}
      </Box>
      <Text bold wrap="truncate-end">
        {formatToolName(singleLine(name))}
      </Text>
      {args !== "" && (
        <Text dimColor wrap="truncate-end">
          {args}
        </Text>
      )}
    </Box>
  );
}

export interface ToolCallCardProps extends ToolCallProps {
  /** M16: per-kind result body — `{kind:"diff"}` renders the patch via
   * DiffViewer (its malformed-patch TypeError PROPAGATES — fail-fast),
   * `{kind:"output"}` the shell envelope via ToolResult, `{kind:"preview"}`
   * a capped CodeBlock (with `language`) or plain lines. Renders in the
   * SAME indented slot as children; when both are present the result body
   * comes FIRST, children below (EC-3). */
  result?: ToolCardResult;
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
/** Drops undefined entries so optional props are OMITTED, never passed as
 * explicit undefined (exactOptionalPropertyTypes — SEPA iteration-4). */
function defined<T extends Record<string, unknown>>(entries: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as Partial<T>;
}

/** M16 per-kind result body (ADR D1 explicit union — no shape sniffing). */
function ResultBody({ result }: { result: ToolCardResult }) {
  switch (result.kind) {
    case "diff":
      return (
        <DiffViewer
          patch={result.patch}
          {...defined({
            maxLines: result.maxLines,
            contextLines: result.contextLines,
          })}
        />
      );
    case "output":
      return (
        <ToolResult
          shell={result.shell}
          {...defined({
            maxLines: result.maxLines,
            expanded: result.expanded,
          })}
        />
      );
    case "preview":
      if (result.language !== undefined) {
        return (
          <CodeBlock
            code={result.text}
            language={result.language}
            {...defined({ maxLines: result.maxLines })}
          />
        );
      }
      return (
        <ToolResult {...defined({ maxLines: result.maxLines })}>
          {result.text}
        </ToolResult>
      );
  }
}

/**
 * M16 boundary: validate the result union and eagerly parse a diff patch so a
 * malformed patch throws a TYPED error at the card boundary (EC-1) — testable
 * via a plain call with a stack, before any hook. Only the diff kind carries
 * runtime DATA; output/preview payload shapes are compile-time programmer errors.
 */
function assertResultBoundary(result: ToolCardResult | undefined): void {
  if (result === undefined) {
    return;
  }
  assertToolCardResult(result);
  if (result.kind === "diff") {
    parseUnifiedDiff(result.patch);
  }
}

/** True when `children` is renderable content (not undefined/null/""/boolean —
 * the `{cond && <X/>}` idiom's residue). SEPA phase-1 F5. */
function hasRenderableBody(children: ReactNode): boolean {
  return (
    children !== undefined &&
    children !== null &&
    children !== "" &&
    typeof children !== "boolean"
  );
}

export function ToolCallCard({ children, result, ...row }: ToolCallCardProps) {
  assertResultBoundary(result);
  // SEPA phase-1 F5: numbers crash Ink like strings do (auto-wrap both).
  const body =
    typeof children === "string" || typeof children === "number" ? (
      <Text>{children}</Text>
    ) : (
      children
    );
  const hasBody = hasRenderableBody(children);
  return (
    // Margin lands on the card's outer Box; the inner ToolCall gets the row
    // WITHOUT margin so the gap is not applied twice (composition, F-arch).
    <Box flexDirection="column" {...pickMargin(row)}>
      <ToolCall {...omitMargin(row)} />
      {(result !== undefined || hasBody) && (
        <ToolTree>
          {result !== undefined && <ResultBody result={result} />}
          {hasBody && body}
        </ToolTree>
      )}
    </Box>
  );
}

/**
 * M26: renders the result/children body under a `⎿` (U+23BF) corner connector —
 * the Claude Code tool-tree idiom. The connector shows once at the top-left; the
 * body flows to its right so multi-line continuation aligns under the body, not
 * the connector (codex `"  └ "` first-line / `"    "` continuation shape).
 */
function ToolTree({ children }: { children: ReactNode }) {
  return (
    <Box paddingLeft={2}>
      <Box flexShrink={0}>
        <Text dimColor>⎿ </Text>
      </Box>
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}
