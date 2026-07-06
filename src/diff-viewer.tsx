import { Box, Text } from "ink";
import { foldDiffLines, parseUnifiedDiff } from "./diff-model.js";
import type { DiffFile, DiffLine, DiffRow } from "./diff-model.js";
import { useTheoTheme } from "./theme.js";
import type { TheoTheme } from "./theme.js";

const TAB_WIDTH = 4;

/** Rows the renderer emits — model rows plus viewer-only row kinds. */
type ViewRow =
  | { kind: "header"; file: DiffFile }
  | { kind: "gap" }
  | { kind: "degenerate"; text: string }
  | DiffRow;

export interface DiffViewerProps {
  /** Unified-diff text (the shape agent tools emit — plan ADR D1). */
  patch: string;
  /** Dim right-aligned line-number gutter (default true). */
  showLineNumbers?: boolean;
  /**
   * GLOBAL rendered-row budget across files, headers included (EC-4);
   * HEAD retention — first rows survive, dim `… (+N more lines)` trailer
   * (documents rule — plan D5 addenda). Integer >= 1.
   */
  maxLines?: number;
  /**
   * Fold unchanged runs beyond ±contextLines around changes into dim
   * `--- N lines hidden ---` rows (fold FIRST, then cap). Integer >= 0.
   */
  contextLines?: number;
}

const expandTabs = (value: string): string =>
  value.replaceAll("\t", " ".repeat(TAB_WIDTH));

function fileRows(file: DiffFile, contextLines: number | undefined): ViewRow[] {
  const rows: ViewRow[] = [{ kind: "header", file }];
  if (file.lines.length === 0) {
    rows.push({ kind: "degenerate", text: "binary or metadata change" });
    return rows;
  }
  const body: DiffRow[] =
    contextLines !== undefined
      ? foldDiffLines(file.lines, contextLines)
      : file.lines;
  // Hunk gaps: a jump in line numbers between consecutive VISIBLE model
  // lines renders a dim `⋮` — unless a fold row already marks it (EC-3).
  let previous: DiffLine | undefined;
  for (const row of body) {
    if (row.kind === "fold") {
      rows.push(row);
      previous = undefined;
      continue;
    }
    if (previous !== undefined) {
      const prev = previous.newLine ?? previous.oldLine ?? 0;
      const next = row.newLine ?? row.oldLine ?? 0;
      if (next - prev > 1) {
        rows.push({ kind: "gap" });
      }
    }
    rows.push(row);
    previous = row;
  }
  return rows;
}

function lineNumberFor(line: DiffLine): number | undefined {
  return line.kind === "del" ? line.oldLine : (line.newLine ?? line.oldLine);
}

function gutterWidth(files: DiffFile[]): number {
  let max = 1;
  for (const file of files) {
    for (const line of file.lines) {
      const n = lineNumberFor(line);
      if (n !== undefined && n > max) {
        max = n;
      }
    }
  }
  return String(max).length;
}

function headerRow(file: DiffFile, theme: TheoTheme, key: string) {
  const name =
    file.oldName !== undefined &&
    file.newName !== undefined &&
    file.oldName !== file.newName
      ? `${file.oldName} → ${file.newName}`
      : (file.newName ?? file.oldName ?? "(unnamed)");
  return (
    <Box key={key}>
      <Text bold wrap="truncate-end">
        {name}
      </Text>
      <Text color={theme.status.success}> +{file.additions}</Text>
      <Text color={theme.status.error}> -{file.deletions}</Text>
    </Box>
  );
}

function lineRow(
  line: DiffLine,
  theme: TheoTheme,
  showLineNumbers: boolean,
  width: number,
  key: string,
) {
  const sign = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
  const color =
    line.kind === "add"
      ? { color: theme.status.success }
      : line.kind === "del"
        ? { color: theme.status.error }
        : {};
  const number = lineNumberFor(line);
  return (
    <Box key={key}>
      <Box flexShrink={0}>
        {showLineNumbers && (
          <Text dimColor>{String(number ?? "").padStart(width)} </Text>
        )}
        <Text {...color}>{sign} </Text>
      </Box>
      <Text {...color} wrap="wrap">
        {line.text === "" ? " " : expandTabs(line.text)}
      </Text>
    </Box>
  );
}

function viewRowElement(
  row: ViewRow,
  index: number,
  theme: TheoTheme,
  showLineNumbers: boolean,
  width: number,
) {
  const key = `r${index}`;
  switch (row.kind) {
    case "header":
      return headerRow(row.file, theme, key);
    case "degenerate":
      return (
        <Text key={key} dimColor>
          {row.text}
        </Text>
      );
    case "gap":
      return (
        <Text key={key} dimColor>
          {"  ⋮"}
        </Text>
      );
    case "fold":
      return (
        <Text key={key} dimColor>
          --- {row.hidden} lines hidden ---
        </Text>
      );
    default:
      return lineRow(row, theme, showLineNumbers, width, key);
  }
}

/**
 * Unified diff renderer (plan ADR D3/D4 — split view deferred: verified
 * absence in every terminal analog). Signs are rendered UNCONDITIONALLY —
 * the color-independent NO_COLOR mechanism. Code lines WRAP, never truncate.
 */
export function DiffViewer({
  patch,
  showLineNumbers = true,
  maxLines,
  contextLines,
}: DiffViewerProps) {
  // Boundary guards FIRST, before hooks (F10 idiom).
  if (maxLines !== undefined && (!Number.isInteger(maxLines) || maxLines < 1)) {
    throw new TypeError(
      `DiffViewer: maxLines must be an integer >= 1 — got ${String(maxLines)}`,
    );
  }
  if (
    contextLines !== undefined &&
    (!Number.isInteger(contextLines) || contextLines < 0)
  ) {
    throw new TypeError(
      `DiffViewer: contextLines must be an integer >= 0 — got ${String(contextLines)}`,
    );
  }
  // Parse BEFORE hooks (DV-2 vs plan EC-12): the typed malformed error must
  // fire ahead of any hook so the direct-invocation contract tests (F10 —
  // Ink swallows render throws) can pin it. Same-string reparse per render
  // is accepted and measured by the bench; memoize only when profiling
  // demands it.
  const files = parseUnifiedDiff(patch);
  const rows: ViewRow[] = [];
  for (const file of files) {
    rows.push(...fileRows(file, contextLines));
  }
  const theme = useTheoTheme();

  if (files.length === 0) {
    return <Text dimColor>(no changes)</Text>;
  }
  // Cap AFTER folding (EC-3), GLOBAL across files incl. headers (EC-4),
  // HEAD retention (EC-5 — documents rule).
  const capped = maxLines !== undefined && rows.length > maxLines;
  const visible = capped ? rows.slice(0, maxLines) : rows;
  const width = gutterWidth(files);

  return (
    <Box flexDirection="column">
      {visible.map((row, index) =>
        viewRowElement(row, index, theme, showLineNumbers, width),
      )}
      {capped && (
        <Text dimColor>
          … (+{rows.length - (maxLines as number)} more lines)
        </Text>
      )}
    </Box>
  );
}
