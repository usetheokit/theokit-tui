// M13 markdown model (plan m13-markdown-renderer, ADR D1): the PURE
// AI-chat markdown subset parser — gemini-cli's production-proven
// hand-rolled grammar (blueprint Corner 4), zero dependencies, zero ink.
// Malformed input NEVER throws: unmatched markers fall through as literal
// text (the assistant stream is untrusted input; fail-soft by design —
// a wrong style is recoverable, a crash mid-turn is not).

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
  | { kind: "hr" }
  | { kind: "spacer" };

// Block grammar — gemini MarkdownDisplay.tsx:62-69 (tables/LaTeX out of
// subset per blueprint).
const HEADING_RE = /^ *(#{1,4}) +(.*)$/;
const FENCE_RE = /^ *(`{3,}|~{3,}) *(\w*) *$/;
const UL_ITEM_RE = /^([ \t]*)([-*+]) +(.*)$/;
const OL_ITEM_RE = /^([ \t]*)(\d+)\. +(.*)$/;
const HR_RE = /^ *([-*_] *){3,}$/;

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

  for (const line of text.split(/\r?\n/)) {
    if (fenceMarker !== null) {
      const close = line.match(FENCE_RE);
      // Close requires the SAME fence char and >= open length
      // (gemini :91-116); anything else is verbatim content.
      if (
        close !== null &&
        close[1] !== undefined &&
        close[1].startsWith(fenceMarker[0] as string) &&
        close[1].length >= fenceMarker.length &&
        close[2] === ""
      ) {
        closeFence();
      } else {
        fenceLines.push(line);
      }
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence !== null && fence[1] !== undefined) {
      fenceMarker = fence[1];
      fenceLanguage = fence[2] === "" ? undefined : fence[2];
      continue;
    }
    const heading = line.match(HEADING_RE);
    if (heading !== null && heading[1] !== undefined) {
      push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4,
        segments: parseInlineSegments(heading[2] ?? ""),
      });
      continue;
    }
    if (HR_RE.test(line)) {
      push({ kind: "hr" });
      continue;
    }
    const ul = line.match(UL_ITEM_RE);
    if (ul !== null) {
      push({
        kind: "list-item",
        ordered: false,
        marker: ul[2] ?? "-",
        indent: (ul[1] ?? "").length,
        segments: parseInlineSegments(ul[3] ?? ""),
      });
      continue;
    }
    const ol = line.match(OL_ITEM_RE);
    if (ol !== null) {
      push({
        kind: "list-item",
        ordered: true,
        marker: ol[2] ?? "1",
        indent: (ol[1] ?? "").length,
        segments: parseInlineSegments(ol[3] ?? ""),
      });
      continue;
    }
    if (line.trim() === "") {
      // Consecutive blanks collapse to ONE spacer (gemini :268-274).
      if (!lastWasSpacer) {
        push({ kind: "spacer" });
      }
      continue;
    }
    push({ kind: "paragraph", segments: parseInlineSegments(line) });
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
// markdownParsingUtils.ts:125-127; <u> dropped from our subset).
// The code-span alternative uses a BACKREFERENCE (\2) so a ``a`b``
// double-backtick span matches whole — gemini's `+.+?`+ shape stops at the
// first backtick run and mis-splits nested spans.
// Groups: 2 = code-span opening backtick run; 3/4 = link text/url — used
// directly below so no second parse (and no dead defensive branch) exists.
const INLINE_RE =
  /(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*|_.+?_|~~.+?~~|\[(.+?)\]\((.+?)\)|(`+).+?\4|https?:\/\/\S+)/g;

const isWordChar = (value: string): boolean => /\w/.test(value);

/** Tokenizes ONE line of text into styled segments. Code spans are
 * VERBATIM (no nested styling); unmatched markers stay literal. */
export function parseInlineSegments(
  text: string,
  inherited: InlineStyles = {},
): InlineSegment[] {
  // Fast path: no marker characters at all (gemini :120-122).
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

  let lastIndex = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(text)) !== null) {
    const full = match[0];
    literal(text.slice(lastIndex, match.index));
    lastIndex = INLINE_RE.lastIndex;

    if (full.startsWith("***") && full.endsWith("***") && full.length > 6) {
      nested(full.slice(3, -3), { bold: true, italic: true });
    } else if (
      full.startsWith("**") &&
      full.endsWith("**") &&
      full.length > 4
    ) {
      nested(full.slice(2, -2), { bold: true });
    } else if (
      (full.startsWith("*") || full.startsWith("_")) &&
      full.length > 2 &&
      // Word-boundary guards: intra-word runs stay literal
      // (gemini :168-180).
      !isWordChar(text.slice(match.index - 1, match.index)) &&
      !isWordChar(text.slice(lastIndex, lastIndex + 1))
    ) {
      nested(full.slice(1, -1), { italic: true });
    } else if (
      full.startsWith("~~") &&
      full.endsWith("~~") &&
      full.length > 4
    ) {
      nested(full.slice(2, -2), { strikethrough: true });
    } else if (match[4] !== undefined) {
      // Backtick-count span (gemini :206-210) — content is VERBATIM; the
      // opening run is group 4 of INLINE_RE (no second parse).
      segments.push({
        text: full.slice(match[4].length, -match[4].length),
        styles: { ...inherited, code: true },
      });
    } else if (match[2] !== undefined && match[3] !== undefined) {
      segments.push({
        text: match[2],
        styles: { ...inherited, link: match[3] },
      });
    } else if (/^https?:\/\//.test(full)) {
      segments.push({ text: full, styles: { ...inherited, link: full } });
    } else {
      literal(full);
    }
  }
  literal(text.slice(lastIndex));
  return segments;
}
