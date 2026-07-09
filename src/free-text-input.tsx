import { Text } from "ink";
import { useReducer } from "react";

import { useFocus } from "./renderer/hooks/use-focus.js";
import type { Key } from "./renderer/input/key.js";
import { useInput } from "./renderer/input/use-input.js";
import { initialTextBuffer, textBufferReducer } from "./text-buffer.js";

// M23 FreeTextInput (plan m23-agent-decision-surfaces T2.1/T3.1): a minimal
// single-line text input over the M15 text-buffer reducer — the shared free-text
// branch of QuestionPrompt ("Other…") and PlanApproval ("revise"). Registers in
// the focus registry (autoFocus) so the manager's activeId is correct after the
// sibling (SelectList / ChoiceRow) unmounts, but subscribes to input on MOUNT
// rather than gating on `isFocused`: it is the exclusive interactive branch of
// its parent, so gating on the focus round-trip would drop the first keystrokes
// (a race — testing.md §6). Enter submits the current text (empty allowed).

export interface FreeTextInputProps {
  /** The prompt label shown before the buffer (e.g. "Type your answer:"). */
  label: string;
  /** Called with the buffer text on Enter (empty string allowed). */
  onSubmit: (text: string) => void;
}

export function FreeTextInput({ label, onSubmit }: FreeTextInputProps) {
  const [state, dispatch] = useReducer(textBufferReducer, initialTextBuffer);
  useFocus({ autoFocus: true });
  useInput(
    (input, key: Key) => {
      if (key.return) {
        onSubmit(state.text);
      } else if (key.backspace || key.delete) {
        dispatch({ type: "delete-backward" });
      } else if (input && !key.ctrl && !key.meta) {
        dispatch({ type: "insert", text: input });
      }
    },
    { isActive: true },
  );
  return (
    <Text>
      {label} {state.text}
      <Text dimColor>▏</Text>
    </Text>
  );
}
