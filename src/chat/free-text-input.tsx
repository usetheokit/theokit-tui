import { Box, Text } from "ink";
import { useEffect, useReducer, useRef } from "react";

import { pickMargin } from "../layout/layout-props.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { useFocus } from "../renderer/hooks/use-focus.js";
import type { Key } from "../renderer/input/key.js";
import { useInput } from "../renderer/input/use-input.js";
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

export interface FreeTextInputProps extends LayoutMarginProps {
  /** The prompt label shown before the buffer (e.g. "Type your answer:"). */
  label: string;
  /** Called with the buffer text on Enter (empty string allowed). */
  onSubmit: (text: string) => void;
  /** Called when Esc blurs the input (cancel back to the parent surface). */
  onCancel?: () => void;
  /**
   * Take focus on mount (default true). Set false for a non-interactive render
   * (e.g. a component gallery) so the input does not grab stdin — parity with
   * `ChatComposer` / `SelectList` / the agent-decision surfaces.
   */
  autoFocus?: boolean;
  /**
   * U-9 — render a placeholder instead of the typed text (API keys, tokens, passwords).
   *
   * `true` uses `•`; a string uses its first grapheme. Absent means plaintext, exactly as before.
   *
   * The mask is a RENDERING concern only: `onSubmit` still receives the real text. A component
   * that masked the submitted value too would be silently useless, and only at the point the
   * credential fails — remotely, later, with a provider message that says nothing about it.
   *
   * What this deliberately does NOT claim: that the secret is kept out of memory. It lives in the
   * buffer like any other text, and a version that moved it to a ref would be the same heap with a
   * stronger-sounding story. The property this DOES give is the one that matters at a terminal —
   * the plaintext never reaches the screen, where it would land in scrollback, a screen share, or
   * a recorded session.
   */
  mask?: boolean | string;
}

/** `•` by default; a caller's string contributes its first grapheme, so a multi-char value cannot
 *  silently inflate the rendered length and leak how long the secret is. */
function maskCharOf(mask: boolean | string): string {
  if (mask === true || mask === "") return "•";
  return [...String(mask)][0] ?? "•";
}

export function FreeTextInput({
  label,
  onSubmit,
  onCancel,
  autoFocus = true,
  mask,
  ...margin
}: FreeTextInputProps) {
  const [state, dispatch] = useReducer(textBufferReducer, initialTextBuffer);
  const { isFocused } = useFocus({ autoFocus });

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
        // A masked field is where a value gets PASTED — from a password manager or a browser —
        // and a paste arrives as one chunk that may carry a trailing newline. Inserting it raw
        // would put a line break inside the secret; letting it through as Enter would submit a
        // truncated one. Neither failure is visible here: both surface later, remotely, as an
        // opaque auth error. So a masked insert drops newlines and keeps the rest verbatim.
        const text = mask === undefined ? input : input.replace(/\r?\n/g, "");
        if (text) {
          dispatch({ type: "insert", text });
        }
      }
    },
    { isActive: isFocused },
  );
  // Grapheme count, not `.length`: an emoji or a combining mark is one thing the user typed, and
  // code units would render more dots than characters entered — leaking a wrong length is still
  // leaking a length.
  const rendered =
    mask === undefined
      ? state.text
      : maskCharOf(mask).repeat([...state.text].length);
  const content = (
    <Text>
      {label} {rendered}
      <Text dimColor>▏</Text>
    </Text>
  );
  // Ink `<Text>` cannot carry margin. Wrap in a margin `<Box>` ONLY when a
  // consumer actually passes margin — otherwise return the bare `<Text>` so no
  // extra layout node is added (this input is focus/timing sensitive; an
  // always-on wrapper delays the input subscription and the no-op invariant
  // must hold structurally, not just visually).
  const m = pickMargin(margin);
  return Object.keys(m).length > 0 ? <Box {...m}>{content}</Box> : content;
}
