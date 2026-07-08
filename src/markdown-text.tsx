import { Box, Text } from "ink";

import { CodeBlock } from "./code-block.js";
import { parseMarkdown } from "./markdown-model.js";
import type { InlineSegment, MarkdownNode } from "./markdown-model.js";
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
    default: {
      // Exhaustiveness guard — a new node kind must be handled here.
      const exhaustive: never = node;
      throw new TypeError(
        `MarkdownText: unhandled node kind ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

/**
 * Assistant-text Markdown renderer (the AI-chat subset: headings 1-4,
 * lists, hr, paragraphs, fenced code via CodeBlock; inline bold/italic/
 * strikethrough/verbatim code/links). Malformed input degrades to literal
 * text — never throws mid-turn.
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
