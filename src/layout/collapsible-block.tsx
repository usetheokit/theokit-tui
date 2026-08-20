import { Box, Text } from "ink";
import { useState, type ReactNode } from "react";

import type { LayoutMarginProps } from "./layout-props.js";

import { useFocus } from "../renderer/hooks/use-focus.js";
import type { Key } from "../renderer/input/key.js";
import { useInput } from "../renderer/input/use-input.js";

// M24 CollapsibleBlock (plan m24-live-progress-surfaces T3.1, ADR D3): a collapsed
// summary line + an expandable body, controlled OR key-toggled. When `expanded`
// is passed the block is CONTROLLED (the parent owns the state; Space/Enter call
// `onToggle` and the prop decides what renders); otherwise it is UNCONTROLLED
// (internal state seeded by `defaultExpanded`). The ▶/▼ affordance is a glyph
// (survives a monochrome theme — no color needed). NO global toggle registry —
// each block owns only its own state (the M15/M23 declarative rule).

export interface CollapsibleBlockProps extends LayoutMarginProps {
  /** The always-visible summary line (after the `▸`/`▾` disclosure affordance — B-053). */
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

  // B-053 — SMALL triangles for disclosure, large ones for overflow.
  //
  // `▼` used to mean three unrelated things in this package: "expand this section", "there is more
  // output behind this", and "N rows are hidden below the window". B-022 and B-052 made the third
  // meaning numeric across all three list views, which made the collision concrete rather than
  // theoretical: measured at HEAD, one frame renders `▼ 8` from a CollapsibleBlock whose summary
  // happens to be a number, and `▼ 4` from an overflowing menu, four lines apart — identical in
  // shape, unrelated in meaning.
  //
  // The distinction is weight, not direction, because direction is already load-bearing on both
  // sides: disclosure toggles down/right, overflow shows up/down simultaneously. `▾`/`▸` are the
  // disclosure pair; `▲`/`▼` are the overflow pair. One glyph, one meaning.
  return (
    <Box flexDirection="column" {...margin}>
      <Text>
        {shown ? "▾" : "▸"} {summary}
      </Text>
      {shown ? children : null}
    </Box>
  );
}
