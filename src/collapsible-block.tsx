import { Box, Text } from "ink";
import { useState, type ReactNode } from "react";

import type { LayoutMarginProps } from "./layout-props.js";
import { MarkdownText } from "./markdown-text.js";
import { useFocus } from "./renderer/hooks/use-focus.js";
import type { Key } from "./renderer/input/key.js";
import { useInput } from "./renderer/input/use-input.js";

// M24 CollapsibleBlock (plan m24-live-progress-surfaces T3.1, ADR D3): a collapsed
// summary line + an expandable body, controlled OR key-toggled. When `expanded`
// is passed the block is CONTROLLED (the parent owns the state; Space/Enter call
// `onToggle` and the prop decides what renders); otherwise it is UNCONTROLLED
// (internal state seeded by `defaultExpanded`). The ▶/▼ affordance is a glyph
// (survives a monochrome theme — no color needed). NO global toggle registry —
// each block owns only its own state (the M15/M23 declarative rule).

export interface CollapsibleBlockProps extends LayoutMarginProps {
  /** The always-visible summary line (after the ▶/▼ affordance). */
  summary: ReactNode;
  /** The body shown only when expanded. */
  children: ReactNode;
  /** Controlled expansion — when set, the block defers to this + `onToggle`. */
  expanded?: boolean;
  /** Uncontrolled initial state (ignored when `expanded` is set). */
  defaultExpanded?: boolean;
  /** Called with the requested next state on Space/Enter. */
  onToggle?: (expanded: boolean) => void;
  autoFocus?: boolean;
}

export function CollapsibleBlock({
  summary,
  children,
  expanded,
  defaultExpanded = false,
  onToggle,
  autoFocus = true,
  ...margin
}: CollapsibleBlockProps) {
  const isControlled = expanded !== undefined;
  const [internal, setInternal] = useState(defaultExpanded);
  const shown = isControlled ? expanded : internal;
  const { isFocused } = useFocus({ autoFocus });

  useInput(
    (input, key: Key) => {
      if (!(key.return || input === " ")) return;
      const next = !shown;
      if (!isControlled) setInternal(next);
      onToggle?.(next);
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column" {...margin}>
      <Text>
        {shown ? "▼" : "▶"} {summary}
      </Text>
      {shown ? children : null}
    </Box>
  );
}

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
