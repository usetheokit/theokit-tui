import { Text } from "ink";
import type { ReactNode } from "react";

import { CollapsibleBlock } from "./collapsible-block.js";
import type { LayoutMarginProps } from "./layout-props.js";
import { MarkdownText } from "../markdown/markdown-text.js";

export interface ThinkingBlockProps extends LayoutMarginProps {
  /** Summary line; defaults to "Thinking…". */
  summary?: string;
  /** The reasoning body — a markdown string renders via MarkdownText. */
  children: ReactNode;
  defaultExpanded?: boolean;
}

/** A CollapsibleBlock preset for reasoning/thinking: collapsed-default, dim+italic
 * summary, a MarkdownText body when the children are a plain string. */
export function ThinkingBlock({
  summary = "Thinking…",
  children,
  defaultExpanded = false,
  ...margin
}: ThinkingBlockProps) {
  const body =
    typeof children === "string" ? <MarkdownText text={children} /> : children;
  return (
    <CollapsibleBlock
      {...margin}
      summary={
        <Text dimColor italic>
          {"✻ "}
          {summary}
        </Text>
      }
      defaultExpanded={defaultExpanded}
    >
      {body}
    </CollapsibleBlock>
  );
}
