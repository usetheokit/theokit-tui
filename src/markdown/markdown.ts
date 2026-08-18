// M13 markdown model (ADR D1): PURE AI-chat markdown subset parser —
// gemini-cli's production-proven hand-rolled grammar (blueprint Corner 4),
// zero deps, zero ink. Malformed input NEVER throws: unmatched markers
// fall through as literal (fail-soft — a crash mid-turn is worse).

export interface InlineStyles {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  /** Target URL when the segment is a link (or the bare URL itself). */
  link?: string;
}

export interface InlineSegment {
  text: string;
  styles: InlineStyles;
}

export type MarkdownNode =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; segments: InlineSegment[] }
  | {
      kind: "list-item";
      ordered: boolean;
      marker: string;
      indent: number;
      segments: InlineSegment[];
    }
  | { kind: "paragraph"; segments: InlineSegment[] }
  | { kind: "code"; language: string | undefined; lines: string[] }
  | {
      kind: "table";
      header: string[];
      align: TableAlign[];
      rows: string[][];
    }
  | { kind: "hr" }
  | { kind: "spacer" };

export type TableAlign = "left" | "center" | "right";

// Block grammar — gemini MarkdownDisplay.tsx:62-69 (tables/LaTeX out of
// subset per blueprint).
const HEADING_RE = /^ *(#{1,4}) +(.*)$/;
const FENCE_RE = /^ *(`{3,}|~{3,}) *(\w*) *$/;
const UL_ITEM_RE = /^([ \t]*)([-*+]) +(.*)$/;
const OL_ITEM_RE = /^([ \t]*)(\d+)\. +(.*)$/;
const HR_RE = /^ *([-*_] *){3,}$/;
// A GFM table delimiter row: cells of `---`, `:--`, `--:`, `:-:` between pipes.
const TABLE_DELIM_RE = /^ *\|? *:?-{1,} *:? *(\| *:?-{1,} *:? *)* *\|?\s*$/;
// A candidate table row contains at least one pipe (fail-soft — only a table
// when the NEXT line is a delimiter).
const TABLE_ROW_RE = /\|/;

/** Split a `| a | b |` row into trimmed cells, honoring `\|` escapes and
 * optional outer pipes. */
function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\\" && line[i + 1] === "|") {
      current += "|";
      i += 1;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  // Drop the empty cells produced by leading/trailing pipes.
  if (cells[0] === "") cells.shift();
  if (cells.length > 0 && cells.at(-1) === "") cells.pop();
  return cells;
}

/** Parse one delimiter cell into its alignment. */
function cellAlign(cell: string): TableAlign {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

/** Build a `table` node from a header line, delimiter line, and body lines. */
function buildTable(
  headerLine: string,
  delimLine: string,
  bodyLines: string[],
): MarkdownNode {
  const header = splitTableRow(headerLine);
  const align = splitTableRow(delimLine).map(cellAlign);
  const rows = bodyLines.map((line) => {
    const cells = splitTableRow(line);
    // Pad/truncate to the header column count (ragged rows).
    return header.map((_, col) => cells[col] ?? "");
  });
  return {
    kind: "table",
    header,
    align: header.map((_, col) => align[col] ?? "left"),
    rows,
  };
}

/** If `lines[index]` opens a GFM table (a pipe row whose next line is a
 * delimiter), consume it; returns the node + the last consumed line index, or
 * null (fail-soft — the caller falls through to `classifyLine`). */
function tryConsumeTable(
  lines: string[],
  index: number,
): { node: MarkdownNode; endIndex: number } | null {
  const line = lines[index] as string;
  const next = lines[index + 1];
  if (
    !TABLE_ROW_RE.test(line) ||
    next === undefined ||
    !TABLE_DELIM_RE.test(next)
  ) {
    return null;
  }
  const body: string[] = [];
  let cursor = index + 2;
  while (cursor < lines.length && TABLE_ROW_RE.test(lines[cursor] as string)) {
    body.push(lines[cursor] as string);
    cursor += 1;
  }
  return { node: buildTable(line, next, body), endIndex: cursor - 1 };
}

/** Matches a ul/ol list line into its node, or null. */
function matchListItem(line: string): MarkdownNode | null {
  const item = line.match(UL_ITEM_RE) ?? line.match(OL_ITEM_RE);
  if (item === null) {
    return null;
  }
  const marker = item[2] ?? "-";
  return {
    kind: "list-item",
    ordered: /\d/.test(marker),
    marker,
    indent: (item[1] ?? "").length,
    segments: parseInlineSegments(item[3] ?? ""),
  };
}

/** Classifies one NON-fence, non-blank line into a block node. */
function classifyLine(line: string): MarkdownNode {
  const heading = line.match(HEADING_RE);
  if (heading?.[1] !== undefined) {
    return {
      kind: "heading",
      level: heading[1].length as 1 | 2 | 3 | 4,
      segments: parseInlineSegments(heading[2] ?? ""),
    };
  }
  if (HR_RE.test(line)) {
    return { kind: "hr" };
  }
  return (
    matchListItem(line) ?? {
      kind: "paragraph",
      segments: parseInlineSegments(line),
    }
  );
}

/** Matches a fence-opening line into marker + language, or null. */
function openFence(
  line: string,
): { marker: string; language: string | undefined } | null {
  const fence = line.match(FENCE_RE);
  if (fence?.[1] === undefined) {
    return null;
  }
  return {
    marker: fence[1],
    language: fence[2] === "" ? undefined : fence[2],
  };
}

/** True when `line` closes a fence opened by `marker` — same char AND
 * >= open length, no trailing language (gemini :91-116). */
function closesFence(line: string, marker: string): boolean {
  const close = line.match(FENCE_RE);
  return (
    close !== null &&
    close[1] !== undefined &&
    close[1].startsWith(marker[0] as string) &&
    close[1].length >= marker.length &&
    close[2] === ""
  );
}

/** Parses a full markdown text into block nodes. An unclosed fence at EOF
 * still emits its code node (streaming partials — gemini :287-300). */
export function parseMarkdown(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let fenceMarker: string | null = null;
  let fenceLanguage: string | undefined;
  let fenceLines: string[] = [];
  let lastWasSpacer = true;

  const push = (node: MarkdownNode): void => {
    nodes.push(node);
    lastWasSpacer = node.kind === "spacer";
  };
  const closeFence = (): void => {
    push({ kind: "code", language: fenceLanguage, lines: fenceLines });
    fenceMarker = null;
    fenceLanguage = undefined;
    fenceLines = [];
  };
  // Blanks collapse to ONE spacer (gemini :268-274).
  const pushSpacer = (): void => {
    if (!lastWasSpacer) push({ kind: "spacer" });
  };

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    if (fenceMarker !== null) {
      if (closesFence(line, fenceMarker)) {
        closeFence();
      } else {
        fenceLines.push(line);
      }
      continue;
    }
    const fence = openFence(line);
    if (fence !== null) {
      fenceMarker = fence.marker;
      fenceLanguage = fence.language;
      continue;
    }
    if (line.trim() === "") {
      pushSpacer();
      continue;
    }
    // A table = a pipe row whose NEXT line is a delimiter (fail-soft otherwise).
    const table = tryConsumeTable(lines, index);
    if (table !== null) {
      push(table.node);
      index = table.endIndex; // resume after the consumed table
      continue;
    }
    push(classifyLine(line));
  }

  if (fenceMarker !== null) {
    closeFence();
  }
  // A trailing spacer renders nothing — drop it.
  if (nodes.at(-1)?.kind === "spacer") {
    nodes.pop();
  }
  return nodes;
}

// Inline grammar — ONE alternated regex, first match wins (gemini
// markdownParsingUtils.ts:125-127; <u> dropped from our subset). The
// code-span alternative uses a BACKREFERENCE so double-backtick spans
// match whole (gemini's shape mis-splits them). Groups: 2/3 = link
// text/url; 4 = code-span opening run — used directly, no second parse.
const INLINE_RE =
  /(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*|_.+?_|~~.+?~~|\[(.+?)\]\((.+?)\)|(`+).+?\4|https?:\/\/\S+)/g;

const isWordChar = (value: string): boolean => /\w/.test(value);

/** Tokenizes ONE line of text into styled segments. Code spans are
 * VERBATIM (no nested styling); unmatched markers stay literal. */
export function parseInlineSegments(
  text: string,
  inherited: InlineStyles = {},
): InlineSegment[] {
  if (!/[*_~`[]|https?:/.test(text)) {
    return text === "" ? [] : [{ text, styles: inherited }];
  }

  const segments: InlineSegment[] = [];
  const literal = (value: string): void => {
    if (value !== "") {
      segments.push({ text: value, styles: inherited });
    }
  };
  // Recurse INSIDE a styled marker so nesting composes (gemini recursion).
  const nested = (inner: string, styles: InlineStyles): void => {
    segments.push(...parseInlineSegments(inner, { ...inherited, ...styles }));
  };
  const plain = (segment: InlineSegment): void => {
    segments.push({
      text: segment.text,
      styles: { ...inherited, ...segment.styles },
    });
  };

  let lastIndex = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(text)) !== null) {
    literal(text.slice(lastIndex, match.index));
    lastIndex = INLINE_RE.lastIndex;
    dispatchInlineMatch(match, text, lastIndex, { nested, literal, plain });
  }
  literal(text.slice(lastIndex));
  return segments;
}

// Order matters: longest marker first (the precedence ladder).
const WRAPPED_MARKERS: ReadonlyArray<[string, InlineStyles]> = [
  ["***", { bold: true, italic: true }],
  ["**", { bold: true }],
  ["~~", { strikethrough: true }],
];

interface InlineEmitters {
  nested: (inner: string, styles: InlineStyles) => void;
  literal: (value: string) => void;
  plain: (segment: InlineSegment) => void;
}

/** True when a wrapped marker was emitted (bold-italic/bold/strike). */
function emitWrappedMarker(full: string, emit: InlineEmitters): boolean {
  for (const [marker, styles] of WRAPPED_MARKERS) {
    if (
      full.startsWith(marker) &&
      full.endsWith(marker) &&
      full.length > marker.length * 2
    ) {
      emit.nested(full.slice(marker.length, -marker.length), styles);
      return true;
    }
  }
  return false;
}

/** Italic run with the gemini word-boundary AND path guards (:168-180) —
 * intra-word runs and path/glob contexts (asterisks between path
 * separators) stay literal. */
function isItalicRun(
  full: string,
  text: string,
  matchIndex: number,
  lastIndex: number,
): boolean {
  return (
    (full.startsWith("*") || full.startsWith("_")) &&
    full.length > 2 &&
    !isWordChar(text.slice(matchIndex - 1, matchIndex)) &&
    !isWordChar(text.slice(lastIndex, lastIndex + 1)) &&
    !/\S[./\\]/.test(text.slice(matchIndex - 2, matchIndex)) &&
    !/[./\\]\S/.test(text.slice(lastIndex, lastIndex + 2))
  );
}

/** Emits the segment(s) for ONE INLINE_RE match — the marker precedence
 * ladder (bold-italic, bold, italic with word-boundary guards, strike,
 * code span, link, bare URL); anything unmatched stays literal. */
function dispatchInlineMatch(
  match: RegExpExecArray,
  text: string,
  lastIndex: number,
  emit: InlineEmitters,
): void {
  const full = match[0];
  if (emitWrappedMarker(full, emit)) {
    return;
  }
  if (isItalicRun(full, text, match.index, lastIndex)) {
    emit.nested(full.slice(1, -1), { italic: true });
    return;
  }
  if (match[4] !== undefined) {
    // Backtick-count span (gemini :206-210) — VERBATIM.
    emit.plain({
      text: full.slice(match[4].length, -match[4].length),
      styles: { code: true },
    });
    return;
  }
  if (match[2] !== undefined && match[3] !== undefined) {
    emit.plain({ text: match[2], styles: { link: match[3] } });
    return;
  }
  if (/^https?:\/\//.test(full)) {
    emit.plain({ text: full, styles: { link: full } });
    return;
  }
  emit.literal(full);
}
