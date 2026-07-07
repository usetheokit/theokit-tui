import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

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

// Module-local hljs palette (~10 buckets from the gemini theme bucketing
// table → ink named colors). Documented M6 theming candidate (M2 glyph
// precedent) — do NOT hardcode per-class colors in render code.
const HLJS_COLOR_MAP: Record<string, string> = {
  "hljs-keyword": "blue",
  "hljs-literal": "blue",
  "hljs-symbol": "blue",
  "hljs-name": "blue",
  "hljs-built_in": "cyan",
  "hljs-type": "cyan",
  "hljs-number": "green",
  "hljs-class": "green",
  "hljs-string": "yellow",
  "hljs-meta-string": "yellow",
  "hljs-regexp": "red",
  "hljs-template-tag": "red",
  "hljs-comment": "gray",
  "hljs-quote": "gray",
  "hljs-variable": "magenta",
  "hljs-template-variable": "magenta",
  "hljs-attr": "cyan",
  "hljs-attribute": "cyan",
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
      return lowlight as unknown as HighlighterLike;
    })
    .catch(() => {
      if (!warnedAbsent) {
        warnedAbsent = true;
        console.warn(
          'CodeBlock: optional peer "lowlight" is not installed — code renders unhighlighted. Install it with: pnpm add lowlight',
        );
      }
      return undefined;
    });
  return highlighterPromise;
}

/** hast→Text mapping (gemini CodeColorizer port): color inherited down,
 * `<Text>` at leaves only, Fragments for elements. */
function renderHast(
  nodes: HastNode[],
  inherited: string | undefined,
  keyPrefix: string,
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
        const mapped = HLJS_COLOR_MAP[classes[i] as string];
        if (mapped !== undefined) {
          color = mapped;
          break;
        }
      }
      return (
        <Text key={key}>
          {renderHast(element.children, color ?? inherited, key)}
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
    return <>{renderHast(root.children, undefined, key)}</>;
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
}

/**
 * Syntax-highlighted code block. Renders PLAIN immediately; re-renders
 * highlighted once the OPTIONAL `lowlight` peer loads (plan ADR D2 — absent
 * peer degrades to plain forever with one warn). Tabs expand to 4 spaces.
 */
export function CodeBlock({
  code,
  language,
  showLineNumbers = false,
  maxLines,
}: CodeBlockProps) {
  // Boundary guard FIRST, before hooks (F10 idiom).
  if (maxLines !== undefined && (!Number.isInteger(maxLines) || maxLines < 1)) {
    throw new TypeError(
      `CodeBlock: maxLines must be an integer >= 1 — got ${String(maxLines)}`,
    );
  }
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

  return (
    <Box flexDirection="column">
      {visible.map((line, index) => (
        <Box key={`l${index}`}>
          {showLineNumbers && (
            <Box flexShrink={0}>
              <Text dimColor>{String(index + 1).padStart(padWidth)} </Text>
            </Box>
          )}
          <Text wrap="wrap">
            {line === ""
              ? " "
              : highlightLine(line, language, highlighter, `h${index}`)}
          </Text>
        </Box>
      ))}
      {capped && (
        <Text dimColor>
          … (+{allLines.length - (maxLines as number)} more lines)
        </Text>
      )}
    </Box>
  );
}
