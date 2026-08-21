import { Box, Text } from "ink";
import { type ReactNode, useEffect, useState } from "react";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { ensureHighlighter, highlightLine } from "../markdown/code-block.js";
import { reportGuardFailure } from "../status/guard-sink.js";
import type { TheoTheme } from "../theme/theme.js";
import { useTheoTheme } from "../theme/theme.js";
import type { DiffFile, DiffLine, DiffRow } from "./diff.js";
import { foldDiffLines, parseUnifiedDiff } from "./diff.js";
import { pairIntraLines, type WordSegment } from "./diff-word.js";

const TAB_WIDTH = 4;

/** Rows the renderer emits — model rows plus viewer-only row kinds. */
type ViewRow =
  | { kind: "header"; file: DiffFile }
  | { kind: "gap" }
  | { kind: "degenerate"; text: string }
  | DiffRow;

export interface DiffViewerProps extends LayoutMarginProps {
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
  /**
   * Claude-Code-style render (opt-in; default false is byte-identical to the
   * classic look): full-width row backgrounds (theme `diff.addedBg/removedBg`)
   * replace the whole-line fg coloring, the per-file header becomes a prose
   * "Added N lines, removed M lines" summary (path prefixed only on multi-file
   * patches — a tool card already names the file), and line text picks up
   * syntax highlight automatically when the optional `lowlight` peer is
   * installed (language inferred from the file extension; CodeBlock precedent).
   * Monochrome themes have empty bg tokens, so the row background disappears
   * and the +/- signs remain the color-independent mechanism. 16-color
   * terminals render the tints at reduced fidelity.
   */
  background?: boolean;
}

/** Highlighter instance shape (loaded lazily from the optional lowlight peer). */
type LoadedHighlighter = Awaited<ReturnType<typeof ensureHighlighter>>;

/** Per-render context for the background (Claude-Code-style) variant. */
interface BgContext {
  multiFile: boolean;
  highlighter: LoadedHighlighter;
  /** lowlight language id for the row at this index (per-file). */
  langAt: (index: number) => string | undefined;
}

/** File extension → lowlight language id (background-variant highlight). */
const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  json: "json",
  css: "css",
  html: "xml",
  xml: "xml",
  md: "markdown",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
};

function languageForFile(file: DiffFile): string | undefined {
  const name = file.newName ?? file.oldName;
  const ext = name === undefined ? undefined : /\.([a-z0-9]+)$/i.exec(name)?.[1];
  return ext === undefined ? undefined : EXT_TO_LANG[ext.toLowerCase()];
}

const expandTabs = (value: string): string => value.replaceAll("\t", " ".repeat(TAB_WIDTH));

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
    contextLines !== undefined ? foldDiffLines(file.lines, contextLines) : file.lines;
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
    file.oldName !== undefined && file.newName !== undefined && file.oldName !== file.newName
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

const plural = (n: number): string => (n === 1 ? "" : "s");

/** Background-variant per-file header: the Claude Code card idiom — prose
 * stats; the path only when the patch carries several files (a tool card
 * header already names the single file). */
function backgroundHeaderRow(file: DiffFile, multiFile: boolean, key: string) {
  const name = file.newName ?? file.oldName ?? "(unnamed)";
  const stats = `Added ${file.additions} line${plural(
    file.additions,
  )}, removed ${file.deletions} line${plural(file.deletions)}`;
  return (
    <Box key={key}>
      <Text dimColor wrap="truncate-end">
        {multiFile ? `${name} — ${stats}` : stats}
      </Text>
    </Box>
  );
}

/** The line body: word-segmented `inverse` spans when intra-line highlight has
 * segments for this line, else the current single tab-expanded text (byte-
 * identical for the default path). */
function lineBody(line: DiffLine, color: { color?: string }, segments: WordSegment[] | undefined) {
  if (segments === undefined || segments.length === 0) {
    return line.text === "" ? " " : expandTabs(line.text);
  }
  return segments.map((segment, index) => (
    <Text key={`w${index}`} {...color} {...(segment.changed ? { inverse: true } : {})}>
      {expandTabs(segment.text)}
    </Text>
  ));
}

/** Classic whole-line fg color for a diff line; empty in the background
 * variant — the row TINT carries the add/del semantics there. */
function lineColor(line: DiffLine, theme: TheoTheme, background: boolean): { color?: string } {
  if (background) {
    return {};
  }
  if (line.kind === "add") {
    return { color: theme.status.success };
  }
  return line.kind === "del" ? { color: theme.status.error } : {};
}

/** Row background prop (background variant only; empty token → none). */
function rowBackground(bgBody: { bgColor: string } | undefined) {
  return bgBody !== undefined && bgBody.bgColor !== "" ? { backgroundColor: bgBody.bgColor } : {};
}

function lineRow(
  line: DiffLine,
  theme: TheoTheme,
  showLineNumbers: boolean,
  width: number,
  key: string,
  segments?: WordSegment[],
  bgBody?: { bgColor: string; body: ReactNode } | undefined,
) {
  const sign = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
  const color = lineColor(line, theme, bgBody !== undefined);
  const number = lineNumberFor(line);
  const hasSegments = segments !== undefined && segments.length > 0;
  return (
    <Box key={key} {...rowBackground(bgBody)}>
      <Box flexShrink={0}>
        {showLineNumbers && <Text dimColor>{String(number ?? "").padStart(width)} </Text>}
        <Text {...color}>{sign} </Text>
      </Box>
      <Text {...color} wrap="wrap">
        {bgBody !== undefined && !hasSegments ? bgBody.body : lineBody(line, color, segments)}
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
  bgCtx: BgContext | undefined,
) {
  const key = `r${index}`;
  switch (row.kind) {
    case "header":
      return bgCtx !== undefined
        ? backgroundHeaderRow(row.file, bgCtx.multiFile, key)
        : headerRow(row.file, theme, key);
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
        bgCtx === undefined ? undefined : bgLineProps(row, index, theme, bgCtx),
      );
  }
}

/** Background-variant per-row props: the kind→tint mapping + the (possibly
 * syntax-highlighted) body. */
function bgLineProps(
  line: DiffLine,
  index: number,
  theme: TheoTheme,
  bgCtx: BgContext,
): { bgColor: string; body: ReactNode } {
  const bgColor =
    line.kind === "add" ? theme.diff.addedBg : line.kind === "del" ? theme.diff.removedBg : "";
  const text = line.text === "" ? " " : expandTabs(line.text);
  const body = highlightLine(text, bgCtx.langAt(index), bgCtx.highlighter, `r${index}`, theme.code);
  return { bgColor, body };
}

function assertValidBounds(maxLines: number | undefined, contextLines: number | undefined): void {
  if (maxLines !== undefined && (!Number.isInteger(maxLines) || maxLines < 1)) {
    reportGuardFailure(
      "DiffViewer",
      new TypeError(`DiffViewer: maxLines must be an integer >= 1 — got ${String(maxLines)}`),
    );
  }
  if (contextLines !== undefined && (!Number.isInteger(contextLines) || contextLines < 0)) {
    reportGuardFailure(
      "DiffViewer",
      new TypeError(
        `DiffViewer: contextLines must be an integer >= 0 — got ${String(contextLines)}`,
      ),
    );
  }
}

/**
 * Unified diff renderer (plan ADR D3/D4 — split view deferred: verified
 * absence in every terminal analog). Signs are rendered UNCONDITIONALLY —
 * the color-independent NO_COLOR mechanism. Code lines WRAP, never truncate.
 */
/** Cap AFTER folding (EC-3), GLOBAL across files incl. headers (EC-4),
 * HEAD retention (EC-5 — documents rule). The trailer counts SOURCE lines
 * (fold rows expand to their hidden count; headers/gaps count 0) — a row
 * count misleads when a dropped "row" hides a whole fold (dom-frontend-2). */
function capRows(
  rows: ViewRow[],
  maxLines: number | undefined,
): { visible: ViewRow[]; capped: boolean; hiddenSourceLines: number } {
  const capped = maxLines !== undefined && rows.length > maxLines;
  if (!capped) {
    return { visible: rows, capped, hiddenSourceLines: 0 };
  }
  const hiddenSourceLines = rows.slice(maxLines as number).reduce((total, row) => {
    if (row.kind === "fold") {
      return total + row.hidden;
    }
    return row.kind === "add" || row.kind === "del" || row.kind === "context" ? total + 1 : total;
  }, 0);
  return { visible: rows.slice(0, maxLines), capped, hiddenSourceLines };
}

/** Flatten files into view rows + a parallel per-row language track (the
 * background variant highlights per file; classic render ignores it). */
function buildViewRows(
  files: DiffFile[],
  contextLines: number | undefined,
): { rows: ViewRow[]; rowLang: (string | undefined)[] } {
  const rows: ViewRow[] = [];
  const rowLang: (string | undefined)[] = [];
  for (const file of files) {
    const fr = fileRows(file, contextLines);
    const lang = languageForFile(file);
    rows.push(...fr);
    for (let i = 0; i < fr.length; i += 1) {
      rowLang.push(lang);
    }
  }
  return { rows, rowLang };
}

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

/** Background variant: lazy-load the optional lowlight highlighter (the
 * CodeBlock idiom — plain render first, highlighted once loaded; absent
 * peer stays plain forever). No-op while `background` is off. */
function useDiffHighlighter(background: boolean): LoadedHighlighter {
  const [highlighter, setHighlighter] = useState<LoadedHighlighter>(undefined);
  useEffect(() => {
    if (!background) {
      return undefined;
    }
    let mounted = true;
    void ensureHighlighter().then((loaded) => {
      if (mounted && loaded !== undefined) {
        setHighlighter(loaded);
      }
    });
    return () => {
      mounted = false;
    };
  }, [background]);
  return highlighter;
}

export function DiffViewer({
  patch,
  showLineNumbers = true,
  maxLines,
  contextLines,
  intraLineHighlight = false,
  background = false,
  ...marginProps
}: DiffViewerProps) {
  // Boundary guards FIRST, before hooks (F10 idiom).
  assertValidBounds(maxLines, contextLines);
  const m = pickMargin(marginProps);
  // Parse BEFORE hooks (DV-2 vs plan EC-12): the typed malformed error must
  // fire ahead of any hook so the direct-invocation contract tests (F10 —
  // Ink swallows render throws) can pin it. Same-string reparse per render
  // is accepted and measured by the bench; memoize only when profiling
  // demands it.
  const files = parseUnifiedDiff(patch);
  const { rows, rowLang } = buildViewRows(files, contextLines);
  const intraMap = intraLineHighlight ? buildIntraMap(files) : undefined;
  const theme = useTheoTheme();
  const highlighter = useDiffHighlighter(background);
  const bgCtx: BgContext | undefined = background
    ? {
        multiFile: files.length > 1,
        highlighter,
        langAt: (index) => rowLang[index],
      }
    : undefined;

  if (files.length === 0) {
    return (
      <Box {...m}>
        <Text dimColor>(no changes)</Text>
      </Box>
    );
  }
  const { visible, capped, hiddenSourceLines } = capRows(rows, maxLines);
  const width = gutterWidth(files);

  return (
    <Box flexDirection="column" {...m}>
      {visible.map((row, index) =>
        viewRowElement(row, index, theme, showLineNumbers, width, intraMap, bgCtx),
      )}
      {capped && <Text dimColor>… (+{hiddenSourceLines} more lines)</Text>}
    </Box>
  );
}
