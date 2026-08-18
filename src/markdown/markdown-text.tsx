import { Box } from "ink";

import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { parseMarkdown } from "./markdown.js";
import { BlockNode } from "./markdown-block.js";

import { useTheoTheme } from "../theme/theme.js";

// M13 MarkdownText (plan m13-markdown-renderer, ADR D2): the render adapter
// over the pure markdown-model — nodes → ink tree styled by THEME tokens
// (data-driven; monochrome themes zero the color axis while bold/italic
// SGR attributes survive — the M10 ToolCall precedent). Fences render
// through the existing CodeBlock (language forwarded to lowlight).

export interface MarkdownTextProps extends LayoutMarginProps {
  /** Markdown source (the AI-chat subset). Streaming partials are safe —
   * an unclosed code fence still renders as code. */
  text: string;
}

/** Renders one inline segment run inside a block. */

export function MarkdownText(props: MarkdownTextProps) {
  // Boundary validation before hooks (house F10 idiom).
  if (typeof props.text !== "string") {
    throw new TypeError(
      `MarkdownText: \`text\` must be a string — got ${typeof props.text}`,
    );
  }
  const theme = useTheoTheme();
  const m = pickMargin(props);
  const nodes = parseMarkdown(props.text);
  if (nodes.length === 0) {
    return null;
  }
  return (
    <Box flexDirection="column" {...m}>
      {nodes.map((node, index) => (
        <BlockNode key={`md-${index}`} node={node} accent={theme.accent} />
      ))}
    </Box>
  );
}
