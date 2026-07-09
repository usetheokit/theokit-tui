import { Box, Text } from "ink";
import { useRef, useState } from "react";

import {
  resolveChoiceKey,
  type ApprovalChoice,
  type ChoiceKey,
} from "./agent-decision-model.js";
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

export interface ChoiceRowProps {
  choices: readonly ApprovalChoice[];
  /** Called with the active choice's `value` on Enter (or a digit jump + Enter). */
  onCommit: (value: string) => void;
  /** Called on Esc (the caller decides the safe default — reject/revise). */
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function ChoiceRow({
  choices,
  onCommit,
  onCancel,
  autoFocus = true,
}: ChoiceRowProps) {
  const [index, setIndex] = useState(0);
  // The committed index is mirrored in a ref so a commit reads the LATEST index
  // even when a move + Enter arrive in the same tick (rapid input / paste over a
  // real PTY) — reading the state closure alone would commit the pre-move choice.
  const indexRef = useRef(0);
  const { isFocused } = useFocus({ autoFocus });
  const theme = useTheoTheme();
  const count = choices.length;

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

  return (
    <Box>
      {choices.map((choice, position) => {
        const active = position === index;
        const marker = active ? "❯ " : "  ";
        return (
          <Text
            key={choice.value}
            {...(active ? { color: theme.accent } : { dimColor: true })}
          >
            {marker}
            {choice.label}
            {position < count - 1 ? "   " : ""}
          </Text>
        );
      })}
    </Box>
  );
}
