import { Text } from "ink";
import { useEffect, useReducer, useRef } from "react";

import { useFocus } from "./renderer/hooks/use-focus.js";
import type { Key } from "./renderer/input/key.js";
import { useInput } from "./renderer/input/use-input.js";
import { initialTextBuffer, textBufferReducer } from "./text-buffer.js";

// M23 FreeTextInput (plan m23-agent-decision-surfaces T2.1/T3.1): a minimal
// single-line text input over the M15 text-buffer reducer — the shared free-text
// branch of QuestionPrompt ("Other…") and PlanApproval ("revise"). Auto-focuses
// on mount (it is the exclusive interactive branch of its parent — the sibling
// SelectList / ChoiceRow unmounts) and gates its input on `isFocused`, exactly
// like every other component (ChoiceRow / SelectList / ChatComposer) — so it
// never steals keys meant for a different focused surface (review HIGH-1). Enter
// submits the current text (empty allowed); Esc cancels back to the parent
// (review HIGH-2): the M20 priority ESC arbiter blurs the input, and since this
// is the exclusive interactive branch, a blur can only mean Esc — so a
// focused→blurred transition fires `onCancel`.

export interface FreeTextInputProps {
  /** The prompt label shown before the buffer (e.g. "Type your answer:"). */
  label: string;
  /** Called with the buffer text on Enter (empty string allowed). */
  onSubmit: (text: string) => void;
  /** Called when Esc blurs the input (cancel back to the parent surface). */
  onCancel?: () => void;
}

export function FreeTextInput({
  label,
  onSubmit,
  onCancel,
}: FreeTextInputProps) {
  const [state, dispatch] = useReducer(textBufferReducer, initialTextBuffer);
  const { isFocused } = useFocus({ autoFocus: true });

  // Esc-cancel via the M20 priority arbiter: once the input has been focused, a
  // subsequent blur can only be an Esc (nothing else is focusable while this is
  // the exclusive branch), so treat the focused→blurred edge as cancel.
  const wasFocused = useRef(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    if (isFocused) {
      wasFocused.current = true;
    } else if (wasFocused.current) {
      wasFocused.current = false;
      onCancelRef.current?.();
    }
  }, [isFocused]);

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
    { isActive: isFocused },
  );
  return (
    <Text>
      {label} {state.text}
      <Text dimColor>▏</Text>
    </Text>
  );
}
