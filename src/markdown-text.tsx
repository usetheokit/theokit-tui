import { Box, Text, useStdout } from "ink";
import stringWidth from "string-width";

import { CodeBlock } from "./code-block.js";
import { computeTableLayout } from "./markdown-table.js";
import { parseMarkdown } from "./markdown-model.js";
import type {
  InlineSegment,
  MarkdownNode,
  TableAlign,
} from "./markdown-model.js";
import { useTheoTheme } from "./theme.js";

// M13 MarkdownText (plan m13-markdown-renderer, ADR D2): the render adapter
// over the pure markdown-model — nodes → ink tree styled by THEME tokens
// (data-driven; monochrome themes zero the color axis while bold/italic
// SGR attributes survive — the M10 ToolCall precedent). Fences render
// through the existing CodeBlock (language forwarded to lowlight).

export interface MarkdownTextProps {
  /** Markdown source (the AI-chat subset). Streaming partials are safe —
   * an unclosed code fence still renders as code. */
  text: string;
}

/** Renders one inline segment run inside a block. */
function Segments({
  segments,
  accent,
}: {
  segments: InlineSegment[];
  accent: string;
}) {
  return (
    <>
      {segments.map((segment, index) => {
        const key = `seg-${index}`;
        if (segment.styles.code === true) {
          return (
            <Text key={key} color={accent}>
              {segment.text}
            </Text>
          );
        }
        if (segment.styles.link !== undefined) {
          // "text (url)" shape (gemini parity); bare URLs carry text===url.
          const bare = segment.text === segment.styles.link;
          return (
            <Text key={key}>
              {bare ? "" : `${segment.text} (`}
              <Text color={accent}>{segment.styles.link}</Text>
              {bare ? "" : ")"}
            </Text>
          );
        }
        return (
          <Text
            key={key}
            bold={segment.styles.bold === true}
            italic={segment.styles.italic === true}
            strikethrough={segment.styles.strikethrough === true}
          >
            {segment.text}
          </Text>
        );
      })}
    </>
  );
}

/** h1/h2 bold accent; h3 bold; h4 italic dim (gemini level ladder). */
function headingTone(
  level: number,
  accent: string,
): { bold?: boolean; color?: string; italic?: boolean; dimColor?: boolean } {
  if (level <= 2) {
    return { bold: true, color: accent };
  }
  return level === 3 ? { bold: true } : { italic: true, dimColor: true };
}

/** Pad `text` to `width` cells per alignment (string-width aware). */
function padCell(text: string, width: number, align: TableAlign): string {
  const gap = Math.max(0, width - stringWidth(text));
  if (align === "right") return " ".repeat(gap) + text;
  if (align === "center") {
    const left = Math.floor(gap / 2);
    return " ".repeat(left) + text + " ".repeat(gap - left);
  }
  return text + " ".repeat(gap);
}

/** A box-drawing horizontal border line (`left … junction … right`). */
function borderLine(
  widths: number[],
  left: string,
  mid: string,
  right: string,
): string {
  return left + widths.map((w) => "─".repeat(w + 2)).join(mid) + right;
}

/** One grid data row: `│ cell │ cell │`. */
function gridRow(
  cells: string[],
  widths: number[],
  align: TableAlign[],
): string {
  const body = widths
    .map((w, i) => ` ${padCell(cells[i] ?? "", w, align[i] ?? "left")} `)
    .join("│");
  return `│${body}│`;
}

/** A markdown table: a bordered grid when it fits `columns`, else aligned
 * plain text (which ink wraps — no data loss, no overflow). */
function Table({ node }: { node: Extract<MarkdownNode, { kind: "table" }> }) {
  const { stdout } = useStdout();
  const budget = stdout?.columns ?? 80;
  const { widths, degrade } = computeTableLayout(
    node.header,
    node.rows,
    budget,
  );
  if (degrade) {
    // Space-separated cells; ink wraps a long row across visual lines.
    const rowText = (cells: string[]): string => cells.join("  ");
    return (
      <Box flexDirection="column">
        <Text bold wrap="wrap">
          {rowText(node.header)}
        </Text>
        {node.rows.map((row, index) => (
          <Text key={`tr-${index}`} wrap="wrap">
            {rowText(row)}
          </Text>
        ))}
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Text>{borderLine(widths, "┌", "┬", "┐")}</Text>
      <Text bold>{gridRow(node.header, widths, node.align)}</Text>
      <Text>{borderLine(widths, "├", "┼", "┤")}</Text>
      {node.rows.map((row, index) => (
        <Text key={`tr-${index}`}>{gridRow(row, widths, node.align)}</Text>
      ))}
      <Text>{borderLine(widths, "└", "┴", "┘")}</Text>
    </Box>
  );
}

/** Renders one block node. */
function BlockNode({ node, accent }: { node: MarkdownNode; accent: string }) {
  switch (node.kind) {
    case "heading":
      return (
        <Text wrap="wrap" {...headingTone(node.level, accent)}>
          <Segments segments={node.segments} accent={accent} />
        </Text>
      );
    case "list-item": {
      const prefix = node.ordered ? `${node.marker}. ` : `${node.marker} `;
      return (
        <Box paddingLeft={node.indent + 1} flexDirection="row">
          <Box width={prefix.length} flexShrink={0}>
            <Text>{prefix}</Text>
          </Box>
          <Box flexGrow={1}>
            <Text wrap="wrap">
              <Segments segments={node.segments} accent={accent} />
            </Text>
          </Box>
        </Box>
      );
    }
    case "code":
      return (
        <CodeBlock
          code={node.lines.join("\n")}
          {...(node.language === undefined ? {} : { language: node.language })}
        />
      );
    case "table":
      return <Table node={node} />;
    case "hr":
      return <Text dimColor>---</Text>;
    case "spacer":
      return <Box height={1} />;
    case "paragraph":
      return (
        <Text wrap="wrap">
          <Segments segments={node.segments} accent={accent} />
        </Text>
      );
    /* v8 ignore start — unreachable via the public surface: parseMarkdown
       never emits an unknown kind; the guard exists for future node kinds
       (review r1-F3: excluded from coverage by decision, not silence). */
    default: {
      // Exhaustiveness guard — a new node kind must be handled here.
      const exhaustive: never = node;
      throw new TypeError(
        `MarkdownText: unhandled node kind ${JSON.stringify(exhaustive)}`,
      );
    }
    /* v8 ignore stop */
  }
}

/**
 * Assistant-text Markdown renderer (the AI-chat subset: headings 1-4,
 * lists, hr, paragraphs, fenced code via CodeBlock; inline bold/italic/
 * strikethrough/verbatim code/links). Malformed input degrades to literal
 * text — never throws mid-turn. Known subset limits (recorded at review):
 * styled link TEXT is literal (`[**b**](u)` keeps the asterisks — no
 * recursive parse inside links); a code span inside an h1/h2 heading is
 * visually fused with the heading accent (and unstyled under monochrome).
 */
export function MarkdownText(props: MarkdownTextProps) {
  // Boundary validation before hooks (house F10 idiom).
  if (typeof props.text !== "string") {
    throw new TypeError(
      `MarkdownText: \`text\` must be a string — got ${typeof props.text}`,
    );
  }
  const theme = useTheoTheme();
  const nodes = parseMarkdown(props.text);
  if (nodes.length === 0) {
    return null;
  }
  return (
    <Box flexDirection="column">
      {nodes.map((node, index) => (
        <BlockNode key={`md-${index}`} node={node} accent={theme.accent} />
      ))}
    </Box>
  );
}
