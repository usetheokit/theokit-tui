import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ExpandableOutput } from "./expandable-output.js";
import { useTheoTheme } from "./theme.js";
import type { CodeTokens } from "./theme.js";

// Minimal structural types for lowlight's hast output — the real package
// types live behind the OPTIONAL peer (plan ADR D2), so we keep a local
// shape instead of importing @types/hast at build time.
interface HastText {
  type: "text";
  value: string;
}
interface HastElement {
  type: "element";
  properties?: { className?: string[] };
  children: HastNode[];
}
type HastNode = HastText | HastElement | { type: string };

interface HighlighterLike {
  registered(language: string): boolean;
  highlight(language: string, code: string): { children: HastNode[] };
}

const TAB_WIDTH = 4;

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001B\[[0-9;]*m/g;
const stripAnsiInput = (value: string): string => value.replace(ANSI_RE, "");

// hljs class → theme.code bucket (M6 T2.2 — colors live in the theme; the
// class→bucket mapping is render-side knowledge and stays module-local,
// mirroring how gemini keeps its class map inside the Theme).
const HLJS_CLASS_TO_BUCKET: Record<string, keyof CodeTokens> = {
  "hljs-keyword": "keyword",
  "hljs-literal": "keyword",
  "hljs-symbol": "keyword",
  "hljs-name": "keyword",
  "hljs-built_in": "builtin",
  "hljs-type": "builtin",
  "hljs-attr": "builtin",
  "hljs-attribute": "builtin",
  "hljs-number": "number",
  "hljs-class": "number",
  "hljs-string": "string",
  "hljs-meta-string": "string",
  "hljs-regexp": "regexp",
  "hljs-template-tag": "regexp",
  "hljs-comment": "comment",
  "hljs-quote": "comment",
  "hljs-variable": "variable",
  "hljs-template-variable": "variable",
};

// Single-flight loader (EC-15): ONE module-scope promise; absent module →
// permanent plain + ONE console.warn naming the peer (plan ADR D2 — never a
// throw, never fully silent).
let highlighterPromise: Promise<HighlighterLike | undefined> | undefined;
let warnedAbsent = false;

/**
 * Starts (or returns) the lowlight load. Exported for deterministic test
 * awaits — NOT re-exported from the package entry (EC-10, D7 precedent).
 */
export function ensureHighlighter(): Promise<HighlighterLike | undefined> {
  highlighterPromise ??= import("lowlight")
    .then((mod) => {
      const lowlight = mod.createLowlight(mod.common);
      // Checked adapter (review arch-5): bind the two methods we use so a
      // lowlight signature change fails HERE at build time, not at runtime.
      const adapter: HighlighterLike = {
        registered: (language) => lowlight.registered(language),
        highlight: (language, code) => lowlight.highlight(language, code),
      };
      return adapter;
    })
    .catch((error: unknown) => {
      if (!warnedAbsent) {
        warnedAbsent = true;
        const code = (error as { code?: string }).code;
        // Distinguish absent from broken (review arch-4 — fail-clear).
        console.warn(
          code === "ERR_MODULE_NOT_FOUND"
            ? 'CodeBlock: optional peer "lowlight" is not installed — code renders unhighlighted. Install it with: pnpm add lowlight'
            : `CodeBlock: optional peer "lowlight" failed to load — code renders unhighlighted. ${String(error)}`,
        );
      }
      return undefined;
    });
  return highlighterPromise;
}

/**
 * PUBLIC readiness seam (review dom-frontend-1 — logged divergence DV-5):
 * one-shot/static renders (piped demos, snapshot tools) capture the PLAIN
 * first frame unless the optional highlighter is awaited first; published
 * consumers cannot reach the internal loader, so this thin wrapper is on the
 * package entry. Resolves whether or not `lowlight` is installed.
 */
export async function preloadHighlighter(): Promise<void> {
  await ensureHighlighter();
}

/** hast→Text mapping (gemini CodeColorizer port): color inherited down,
 * `<Text>` at leaves only, Fragments for elements. */
function renderHast(
  nodes: HastNode[],
  inherited: string | undefined,
  keyPrefix: string,
  codeColors: CodeTokens,
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "text") {
      const value = (node as HastText).value;
      return inherited !== undefined ? (
        <Text key={key} color={inherited}>
          {value}
        </Text>
      ) : (
        <Text key={key}>{value}</Text>
      );
    }
    if (node.type === "element") {
      const element = node as HastElement;
      const classes = element.properties?.className ?? [];
      let color: string | undefined;
      for (let i = classes.length - 1; i >= 0; i--) {
        const bucket = HLJS_CLASS_TO_BUCKET[classes[i] as string];
        if (bucket !== undefined) {
          color = codeColors[bucket];
          break;
        }
      }
      return (
        <Text key={key}>
          {renderHast(element.children, color ?? inherited, key, codeColors)}
        </Text>
      );
    }
    return null;
  });
}

/**
 * Per-line highlight with the 4-level fallback ladder (plan ADR D6).
 * Exported for ladder unit tests (levels 2/3 need a stub highlighter —
 * real lowlight rarely returns empty roots or throws on common langs);
 * NOT on the package entry.
 */
export function highlightLine(
  line: string,
  language: string | undefined,
  highlighter: HighlighterLike | undefined,
  key: string,
  codeColors: CodeTokens,
): ReactNode {
  if (
    highlighter === undefined ||
    language === undefined ||
    !highlighter.registered(language)
  ) {
    return line;
  }
  try {
    const root = highlighter.highlight(language, line);
    if (root.children.length === 0) {
      return line;
    }
    return <>{renderHast(root.children, undefined, key, codeColors)}</>;
  } catch {
    return line;
  }
}

/** Sanitize (ANSI strip, tab expand) + split; trailing newline is no row. */
function toCodeLines(code: string): string[] {
  const sanitized = stripAnsiInput(code).replaceAll(
    "\t",
    " ".repeat(TAB_WIDTH),
  );
  if (sanitized === "") {
    return [];
  }
  const lines = sanitized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop(); // M2 EC-7 parity
  }
  return lines;
}

export interface CodeBlockProps {
  /** Source text. ANSI escapes are stripped on input (EC-16). */
  code: string;
  /** Explicit language id (lowlight/common). No auto-detect (determinism). */
  language?: string;
  /** Dim right-aligned original line numbers (default false). */
  showLineNumbers?: boolean;
  /** HEAD-retained line cap with dim `… (+N more lines)` trailer. Int >= 1. */
  maxLines?: number;
  /**
   * M25: when line-capped, make the block interactively expandable (ctrl+o /
   * Space / Enter over the M24 CollapsibleBlock).
   */
  interactive?: boolean;
}

/**
 * Syntax-highlighted code block. Renders PLAIN immediately; re-renders
 * highlighted once the OPTIONAL `lowlight` peer loads (plan ADR D2 — absent
 * peer degrades to plain forever with one warn). Tabs expand to 4 spaces.
 */
/** Fail-fast on an invalid `maxLines` (integer >= 1). */
function assertPositiveMaxLines(maxLines: number | undefined): void {
  if (maxLines !== undefined && (!Number.isInteger(maxLines) || maxLines < 1)) {
    throw new TypeError(
      `CodeBlock: maxLines must be an integer >= 1 — got ${String(maxLines)}`,
    );
  }
}

export function CodeBlock({
  code,
  language,
  showLineNumbers = false,
  maxLines,
  interactive = false,
}: CodeBlockProps) {
  // Boundary guard FIRST, before hooks (F10 idiom).
  assertPositiveMaxLines(maxLines);
  const theme = useTheoTheme();
  const [highlighter, setHighlighter] = useState<HighlighterLike | undefined>(
    undefined,
  );
  useEffect(() => {
    let mounted = true;
    void ensureHighlighter().then((loaded) => {
      // EC-14: never setState after unmount.
      if (mounted && loaded !== undefined) {
        setHighlighter(loaded);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const allLines = toCodeLines(code);
  if (allLines.length === 0) {
    return null;
  }
  const capped = maxLines !== undefined && allLines.length > maxLines;
  const visible = capped ? allLines.slice(0, maxLines) : allLines;
  const padWidth = String(allLines.length).length;

  const rows = (lines: string[]) => (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Box key={`l${index}`}>
          {showLineNumbers && (
            <Box flexShrink={0}>
              <Text dimColor>{String(index + 1).padStart(padWidth)} </Text>
            </Box>
          )}
          <Text wrap="wrap">
            {line === ""
              ? " "
              : highlightLine(
                  line,
                  language,
                  highlighter,
                  `h${index}`,
                  theme.code,
                )}
          </Text>
        </Box>
      ))}
    </Box>
  );

  const hidden = capped ? allLines.length - (maxLines as number) : 0;
  if (interactive && capped) {
    return (
      <ExpandableOutput
        collapsed={rows(visible)}
        expanded={rows(allLines)}
        hiddenCount={hidden}
      />
    );
  }

  return (
    <Box flexDirection="column">
      {rows(visible)}
      {capped && <Text dimColor>… (+{hidden} more lines)</Text>}
    </Box>
  );
}
