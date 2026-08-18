import { Box, Text } from "ink";
import { useState, type ReactNode } from "react";

import type { LayoutMarginProps } from "../layout/layout-props.js";
import { useFocus } from "../renderer/hooks/use-focus.js";
import type { Key } from "../renderer/input/key.js";
import { useInput } from "../renderer/input/use-input.js";

// M25 ExpandableOutput (plan m25-parity-polish-audit T3.1, ADR C): a capped view
// that reveals its full body on ctrl+r / Space / Enter (the Claude Code
// `(ctrl+r to expand)` idiom).
// Per-component state (no global registry — the M15/M23/M24 declarative rule);
// multiple instances toggle independently.
//
// It renders the M24 CollapsibleBlock's ▶/▼ affordance INLINE rather than
// composing the component: composing it would register a SECOND focusable (its
// own `useFocus`), injecting a dead Tab-stop that swallows keys (review H1). Since
// ExpandableOutput already owns the toggle state + focus + input, the glyph render
// is a three-line inline — cleaner than a controlled CollapsibleBlock with a dead
// key handler. The ▶/▼ glyph carries the affordance under a monochrome theme.

export interface ExpandableOutputProps extends LayoutMarginProps {
  /** The capped preview shown while collapsed. */
  collapsed: ReactNode;
  /** The full body shown while expanded. */
  expanded: ReactNode;
  /** Lines hidden by the cap — shown in the collapsed affordance. */
  hiddenCount: number;
  autoFocus?: boolean;
}

export function ExpandableOutput({
  collapsed,
  expanded,
  hiddenCount,
  autoFocus = true,
  ...margin
}: ExpandableOutputProps) {
  const [open, setOpen] = useState(false);
  const { isFocused } = useFocus({ autoFocus });

  useInput(
    (input, key: Key) => {
      if (key.return || input === " " || (key.ctrl && input === "r")) {
        setOpen((value) => !value);
      }
    },
    { isActive: isFocused },
  );

  // Content renders in the Box (multi-line layout preserved — a Text wrapper
  // would flatten capped rows onto one line); the ▶/▼ affordance is its own line
  // BELOW the content (the gemini/pi "… N more" idiom). The glyph carries the
  // affordance under a monochrome theme.
  return (
    <Box flexDirection="column" {...margin}>
      {open ? expanded : collapsed}
      <Text dimColor>
        {open
          ? "▼ (ctrl+r to collapse)"
          : `▶ … ${hiddenCount} more (ctrl+r to expand)`}
      </Text>
    </Box>
  );
}
