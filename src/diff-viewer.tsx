import { Box, Text } from "ink";
import { foldDiffLines, parseUnifiedDiff } from "./diff-model.js";
import type { DiffFile, DiffLine, DiffRow } from "./diff-model.js";
import { pairIntraLines, type WordSegment } from "./diff-word.js";
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
  /**
   * M25 opt-in: within paired del/add line replacements, highlight the changed
   * WORDS (rendered `inverse`). Default `false` → the render is byte-identical to
   * the whole-line coloring and the jsdiff word-diff is never CALLED (the segment
   * computation is gated on this flag; `diff` is a regular dependency of the diff
   * feature — Rule 9 don't-reinvent — so it is in the bundle but inert when off).
   */
  intraLineHighlight?: boolean;
}

const expandTabs = (value: string): string =>
  value.replaceAll("\t", " ".repeat(TAB_WIDTH));

/**
 * Per-side hunk-gap tracker (SEPA F1): comparing mixed old/new numbers
 * renders spurious `⋮` inside contiguous hunks with net insertions. A gap
 * exists only when a SIDE's number jumps past its own last-seen value.
 */
interface SideCounters {
  lastOld: number | undefined;
  lastNew: number | undefined;
}

function isGapBetween(counters: SideCounters, row: DiffLine): boolean {
  const oldJump =
    row.oldLine !== undefined &&
    counters.lastOld !== undefined &&
    row.oldLine > counters.lastOld + 1;
  const newJump =
    row.newLine !== undefined &&
    counters.lastNew !== undefined &&
    row.newLine > counters.lastNew + 1;
  return oldJump || newJump;
}

function advance(counters: SideCounters, row: DiffLine): void {
  if (row.oldLine !== undefined) {
    counters.lastOld = row.oldLine;
  }
  if (row.newLine !== undefined) {
    counters.lastNew = row.newLine;
  }
}

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
  // A fold row already marks the jump — the `⋮` gap fires only without one.
  const counters: SideCounters = { lastOld: undefined, lastNew: undefined };
  for (const row of body) {
    if (row.kind === "fold") {
      rows.push(row);
      counters.lastOld = undefined;
      counters.lastNew = undefined;
      continue;
    }
    if (isGapBetween(counters, row)) {
      rows.push({ kind: "gap" });
    }
    rows.push(row);
    advance(counters, row);
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

/** The line body: word-segmented `inverse` spans when intra-line highlight has
 * segments for this line, else the current single tab-expanded text (byte-
 * identical for the default path). */
function lineBody(
  line: DiffLine,
  color: { color?: string },
  segments: WordSegment[] | undefined,
) {
  if (segments === undefined || segments.length === 0) {
    return line.text === "" ? " " : expandTabs(line.text);
  }
  return segments.map((segment, index) => (
    <Text
      key={`w${index}`}
      {...color}
      {...(segment.changed ? { inverse: true } : {})}
    >
      {expandTabs(segment.text)}
    </Text>
  ));
}

function lineRow(
  line: DiffLine,
  theme: TheoTheme,
  showLineNumbers: boolean,
  width: number,
  key: string,
  segments?: WordSegment[],
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
        {lineBody(line, color, segments)}
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
  intraMap: Map<DiffLine, WordSegment[]> | undefined,
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
      // Indent under the gutter (codex spacer parity — dom-frontend-4).
      return (
        <Text key={key} dimColor>
          {" ".repeat(showLineNumbers ? width + 1 : 0)}⋮
        </Text>
      );
    case "fold":
      return (
        <Text key={key} dimColor>
          --- {row.hidden} lines hidden ---
        </Text>
      );
    default:
      return lineRow(
        row,
        theme,
        showLineNumbers,
        width,
        key,
        intraMap?.get(row),
      );
  }
}

function assertValidBounds(
  maxLines: number | undefined,
  contextLines: number | undefined,
): void {
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
}

/**
 * Unified diff renderer (plan ADR D3/D4 — split view deferred: verified
 * absence in every terminal analog). Signs are rendered UNCONDITIONALLY —
 * the color-independent NO_COLOR mechanism. Code lines WRAP, never truncate.
 */
/** Build the reference-keyed intra-line segment map across all files (opt-in). */
function buildIntraMap(files: DiffFile[]): Map<DiffLine, WordSegment[]> {
  const map = new Map<DiffLine, WordSegment[]>();
  for (const file of files) {
    for (const [line, segments] of pairIntraLines(file.lines)) {
      map.set(line, segments);
    }
  }
  return map;
}

export function DiffViewer({
  patch,
  showLineNumbers = true,
  maxLines,
  contextLines,
  intraLineHighlight = false,
}: DiffViewerProps) {
  // Boundary guards FIRST, before hooks (F10 idiom).
  assertValidBounds(maxLines, contextLines);
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
  const intraMap = intraLineHighlight ? buildIntraMap(files) : undefined;
  const theme = useTheoTheme();

  if (files.length === 0) {
    return <Text dimColor>(no changes)</Text>;
  }
  // Cap AFTER folding (EC-3), GLOBAL across files incl. headers (EC-4),
  // HEAD retention (EC-5 — documents rule). The trailer counts SOURCE lines
  // (fold rows expand to their hidden count; headers/gaps count 0) — a row
  // count misleads when a dropped "row" hides a whole fold (dom-frontend-2).
  const capped = maxLines !== undefined && rows.length > maxLines;
  const visible = capped ? rows.slice(0, maxLines) : rows;
  const hiddenSourceLines = capped
    ? rows.slice(maxLines as number).reduce((total, row) => {
        if (row.kind === "fold") {
          return total + row.hidden;
        }
        return row.kind === "add" ||
          row.kind === "del" ||
          row.kind === "context"
          ? total + 1
          : total;
      }, 0)
    : 0;
  const width = gutterWidth(files);

  return (
    <Box flexDirection="column">
      {visible.map((row, index) =>
        viewRowElement(row, index, theme, showLineNumbers, width, intraMap),
      )}
      {capped && <Text dimColor>… (+{hiddenSourceLines} more lines)</Text>}
    </Box>
  );
}
