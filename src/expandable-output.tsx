import { Text } from "ink";
import { useState, type ReactNode } from "react";

import { CollapsibleBlock } from "./collapsible-block.js";
import { useFocus } from "./renderer/hooks/use-focus.js";
import type { Key } from "./renderer/input/key.js";
import { useInput } from "./renderer/input/use-input.js";

// M25 ExpandableOutput (plan m25-parity-polish-audit T3.1, ADR C): a capped view
// that reveals its full body on ctrl+o / Space / Enter (the gemini ctrl+o idiom).
// Per-component state (no global registry — the M15/M23/M24 declarative rule);
// multiple instances toggle independently. Composes the M24 CollapsibleBlock in
// CONTROLLED mode for its ▶/▼ affordance; ExpandableOutput owns the focus + the
// key handling (adding ctrl+o alongside CollapsibleBlock's Space/Enter, which is
// inert here since the composed block is not itself focused).

export interface ExpandableOutputProps {
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
}: ExpandableOutputProps) {
  const [open, setOpen] = useState(false);
  const { isFocused } = useFocus({ autoFocus });

  useInput(
    (input, key: Key) => {
      if (key.return || input === " " || (key.ctrl && input === "o")) {
        setOpen((value) => !value);
      }
    },
    { isActive: isFocused },
  );

  const summary = open ? (
    expanded
  ) : (
    <Text>
      {collapsed} <Text dimColor>… {hiddenCount} more (ctrl+o)</Text>
    </Text>
  );

  return (
    <CollapsibleBlock expanded={open} summary={summary} autoFocus={false}>
      {null}
    </CollapsibleBlock>
  );
}
