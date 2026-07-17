import { Box, Text } from "ink";
import { useEffect, useRef, useState } from "react";

import {
  resolveChoiceKey,
  type ApprovalChoice,
  type ChoiceKey,
} from "./agent-decision-model.js";
import type { LayoutMarginProps } from "./layout-props.js";
import { useFocus } from "./renderer/hooks/use-focus.js";
import { useInput } from "./renderer/input/use-input.js";
import { useTheoTheme } from "./theme.js";

// M23 ChoiceRow (plan m23-agent-decision-surfaces T1.1, ADR D4): a horizontal
// fixed choice bar — the spine of ApprovalPrompt and PlanApproval. Distinct from
// SelectList (a filterable windowed vertical list): ChoiceRow has NO filter, NO
// window, just a small set of `{value,label}` choices. ←/→ move (wrapping),
// Enter commits the active choice, Esc cancels, a digit `1..n` jumps. The active
// choice is marked with `❯` (the affordance survives a monochrome theme — the
// accent color is decorative, the glyph carries the meaning). Consumes OUR
// M19/M20 input/focus hooks; holds only the highlighted-index UI state.

export interface ChoiceRowProps extends LayoutMarginProps {
  choices: readonly ApprovalChoice[];
  /** Called with the active choice's `value` on Enter (or a digit jump + Enter). */
  onCommit: (value: string) => void;
  /** Called on Esc (the caller decides the safe default — reject/revise). */
  onCancel?: () => void;
  /** `horizontal` (default) is a one-line bar; `vertical` stacks each choice on
   * its own line (the PermissionPrompt / numbered-menu idiom). ↑/↓ also move. */
  orientation?: "horizontal" | "vertical";
  /** Prefix each label with `{n}. ` (matches the digit-jump shortcut). */
  numbered?: boolean;
  /** Blank rows between choices in vertical mode (issue #50). Default 0. */
  gap?: number;
  autoFocus?: boolean;
}

export function ChoiceRow({
  choices,
  onCommit,
  onCancel,
  orientation = "horizontal",
  numbered = false,
  gap = 0,
  autoFocus = true,
  ...margin
}: ChoiceRowProps) {
  const [index, setIndex] = useState(0);
  // The committed index is mirrored in a ref so a commit reads the LATEST index
  // even when a move + Enter arrive in the same tick (rapid input / paste over a
  // real PTY) — reading the state closure alone would commit the pre-move choice.
  const indexRef = useRef(0);
  const { isFocused } = useFocus({ autoFocus });
  const theme = useTheoTheme();
  const count = choices.length;

  // Re-clamp when the `choices` prop shrinks (a dynamic/streamed choice set —
  // ADR D3): an index past the new tail would render no active marker and commit
  // `undefined`. Keep index + ref in sync at the new last row (review MEDIUM-2).
  useEffect(() => {
    if (index >= count) {
      const clamped = Math.max(0, count - 1);
      indexRef.current = clamped;
      setIndex(clamped);
    }
  }, [count, index]);

  useInput(
    (input, key) => {
      const action = resolveChoiceKey(
        input,
        key as unknown as ChoiceKey,
        count,
        indexRef.current,
      );
      if (!action) return;
      if (action.type === "move") {
        indexRef.current = action.index;
        setIndex(action.index);
      } else if (action.type === "commit") {
        const choice = choices[indexRef.current];
        if (choice) onCommit(choice.value);
      } else {
        onCancel?.();
      }
    },
    { isActive: isFocused },
  );

  const vertical = orientation === "vertical";
  return (
    <Box flexDirection={vertical ? "column" : "row"} gap={gap} {...margin}>
      {choices.map((choice, position) => {
        const active = position === index;
        const marker = active ? "❯ " : "  ";
        const prefix = numbered ? `${position + 1}. ` : "";
        // Horizontal keeps a 3-space separator between choices; vertical needs
        // none (each choice owns its line). Distinct from the `gap` prop, which
        // is the Box's row/column gap (issue #50).
        const trailer = !vertical && position < count - 1 ? "   " : "";
        return (
          <Text
            key={choice.value}
            {...(active ? { color: theme.accent } : { dimColor: true })}
          >
            {marker}
            {prefix}
            {choice.label}
            {trailer}
          </Text>
        );
      })}
    </Box>
  );
}
