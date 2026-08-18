import { Box, Text } from "ink";

import { CodeBlock } from "./code-block.js";
import type { MarkdownNode } from "./markdown.js";
import { Segments } from "./markdown-segments.js";
import { Table } from "./markdown-table-view.js";

function headingTone(
  level: number,
  accent: string,
): { bold?: boolean; color?: string; italic?: boolean; dimColor?: boolean } {
  if (level <= 2) {
    return { bold: true, color: accent };
  }
  return level === 3 ? { bold: true } : { italic: true, dimColor: true };
}

export function BlockNode({
  node,
  accent,
}: {
  node: MarkdownNode;
  accent: string;
}) {
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
