import { Box, Text } from "ink";

import { useTheoTheme } from "./theme.js";
import type { TheoTheme } from "./theme.js";

/**
 * Input guard against pathological single payloads (gemini-cli
 * SlicingMaxSizedBox precedent). NOT display truncation: `expanded` does not
 * bypass it (EC-5). Exported for visibility (plan risk register).
 */
export const MAX_RESULT_CHARS = 20000;

export interface TruncationResult {
  visible: string[];
  hidden: number;
}

/**
 * Tail-retention truncation math (ADR D4/D7): keeps the LAST `maxLines - 1`
 * lines, reserving one row for the `… +N lines hidden` indicator. Pure —
 * no ink imports; the M2 critical path.
 */
export function truncateLines(
  lines: string[],
  maxLines: number,
): TruncationResult {
  // EC-1: fail-fast typed error — slice(-(maxLines-1)) silently misbehaves
  // for maxLines <= 1 and non-integers (slice(-0) returns ALL lines).
  if (!Number.isInteger(maxLines) || maxLines < 1) {
    throw new TypeError(
      `truncateLines: maxLines must be an integer >= 1 — got ${String(maxLines)}`,
    );
  }
  if (lines.length <= maxLines) {
    return { visible: lines, hidden: 0 };
  }
  if (maxLines === 1) {
    return { visible: [], hidden: lines.length };
  }
  const keep = maxLines - 1;
  return { visible: lines.slice(-keep), hidden: lines.length - keep };
}

export interface ShellEnvelope {
  stdout: string;
  stderr: string;
  /** Badge renders ONLY when a number and non-zero (EC-3); verbatim (EC-12). */
  exitCode?: number;
}

export interface ToolResultProps {
  /** Plain-string content, split on newlines. Exclusive with lines/shell. */
  children?: string;
  /** Pre-split content lines. Exclusive with children/shell. */
  lines?: string[];
  /** Shell envelope (ADR D5). Exclusive with children/lines. */
  shell?: ShellEnvelope;
  /**
   * Visible-line budget incl. the indicator row when LINE truncation fires
   * (ADR D4). Integer >= 1 — validated even when `expanded` (fail-fast at
   * the boundary). A cap-only indicator (char cap fired, no hidden lines)
   * renders as one extra row outside this budget (SEPA phase-2 F8).
   */
  maxLines?: number;
  /** Render every line (bypasses LINE truncation only — not the char cap). */
  expanded?: boolean;
}

/** Split content on newlines: strip trailing `\r` (EC-6) + trailing "" (EC-7). */
function splitContent(raw: string): string[] {
  const rows = raw.split("\n").map((row) => row.replace(/\r$/, ""));
  if (rows.length > 0 && rows[rows.length - 1] === "") {
    rows.pop();
  }
  return rows;
}

/** Apply the char cap; when it fires, note it for the indicator line. */
function applyCharCap(raw: string): { text: string; capped: boolean } {
  if (raw.length > MAX_RESULT_CHARS) {
    return { text: raw.slice(0, MAX_RESULT_CHARS), capped: true };
  }
  return { text: raw, capped: false };
}

interface ResolvedContent {
  rows: string[];
  /** Absolute row index of the single `stderr:` label (SEPA phase-2 F9). */
  stderrLabelIndex: number | undefined;
  capped: boolean;
  exitCode: number | undefined;
}

function resolveShell(shell: ShellEnvelope): ResolvedContent {
  const stdoutCap = applyCharCap(shell.stdout);
  // The 20k cap is a COMBINED budget (SEPA phase-2 F2 — "total chars" per
  // the plan): stderr gets whatever stdout left over.
  const stderrBudget = MAX_RESULT_CHARS - stdoutCap.text.length;
  const stderrCapped = shell.stderr.length > stderrBudget;
  const stderrText = stderrCapped
    ? shell.stderr.slice(0, Math.max(0, stderrBudget))
    : shell.stderr;
  const rows = shell.stdout === "" ? [] : splitContent(stdoutCap.text);
  let stderrLabelIndex: number | undefined;
  if (shell.stderr !== "") {
    stderrLabelIndex = rows.length;
    rows.push("stderr:", ...splitContent(stderrText));
  }
  return {
    rows,
    stderrLabelIndex,
    capped: stdoutCap.capped || stderrCapped,
    exitCode: shell.exitCode,
  };
}

function resolveContent(props: ToolResultProps): ResolvedContent {
  const sources = [props.children, props.lines, props.shell].filter(
    (source) => source !== undefined,
  );
  // EC-2: silent precedence would swallow content — fail fast instead.
  if (sources.length > 1) {
    throw new TypeError(
      "ToolResult: provide exactly one of children | lines | shell",
    );
  }
  if (props.shell !== undefined) {
    return resolveShell(props.shell);
  }
  const raw =
    props.lines !== undefined ? props.lines.join("\n") : (props.children ?? "");
  const { text, capped } = applyCharCap(raw);
  return {
    rows: raw === "" ? [] : splitContent(text),
    stderrLabelIndex: undefined,
    capped,
    exitCode: undefined,
  };
}

function indicatorText(hidden: number, capped: boolean): string | undefined {
  const parts: string[] = [];
  if (hidden > 0) {
    parts.push(`… +${hidden} lines hidden`);
  }
  if (capped) {
    parts.push(`… output capped at ${MAX_RESULT_CHARS} chars`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function contentRows(
  content: ResolvedContent,
  visibleCount: number,
  theme: TheoTheme,
) {
  // Positive start index — slice(-0) would resurrect EVERY row when the
  // visible budget is zero (EC-1's hazard at the render layer).
  const start = content.rows.length - visibleCount;
  return content.rows.slice(start).map((row, index) => {
    const absoluteIndex = start + index;
    const isLabel = absoluteIndex === content.stderrLabelIndex;
    const afterLabel =
      content.stderrLabelIndex !== undefined &&
      absoluteIndex > content.stderrLabelIndex;
    if (isLabel) {
      return (
        <Text key={absoluteIndex} dimColor>
          {row}
        </Text>
      );
    }
    return (
      <Text
        key={absoluteIndex}
        {...(afterLabel ? { color: theme.status.error } : {})}
      >
        {row === "" ? " " : row}
      </Text>
    );
  });
}

interface ResultView {
  indicator: string | undefined;
  showExit: boolean;
  showPlaceholder: boolean;
  hasAnything: boolean;
}

function resultView(
  isShell: boolean,
  content: ResolvedContent,
  hidden: number,
): ResultView {
  const indicator = indicatorText(hidden, content.capped);
  const showExit =
    typeof content.exitCode === "number" && content.exitCode !== 0;
  const showPlaceholder = isShell && content.rows.length === 0;
  const hasAnything =
    content.rows.length > 0 ||
    showExit ||
    showPlaceholder ||
    indicator !== undefined;
  return { indicator, showExit, showPlaceholder, hasAnything };
}

/**
 * Tool output block (ADR D4/D5): tail-retention truncation with a dim
 * `… +N lines hidden` indicator, optional shell envelope (labeled stderr,
 * non-zero-only exit badge, `(no output)` placeholder).
 */
export function ToolResult(props: ToolResultProps) {
  const { maxLines = 10, expanded = false } = props;
  // Boundary guards precede the hook (ChatMessage EC-1 idiom): source
  // exclusivity (EC-2) and maxLines validity — the latter UNCONDITIONALLY,
  // prop validity must not depend on `expanded` (SEPA phase-2 F3).
  const content = resolveContent(props);
  const lineTruncation = truncateLines(content.rows, maxLines);
  const theme = useTheoTheme();

  const truncation = expanded
    ? { visible: content.rows, hidden: 0 }
    : lineTruncation;
  const view = resultView(
    props.shell !== undefined,
    content,
    truncation.hidden,
  );
  if (!view.hasAnything) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {view.indicator !== undefined && <Text dimColor>{view.indicator}</Text>}
      {contentRows(content, truncation.visible.length, theme)}
      {view.showPlaceholder && <Text dimColor>(no output)</Text>}
      {view.showExit && (
        <Text color={theme.status.error} bold>
          exited {content.exitCode}
        </Text>
      )}
    </Box>
  );
}
