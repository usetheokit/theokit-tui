import { Box, Text, useFocus, useInput } from "ink";
import { useReducer } from "react";

import {
  graphemeAt,
  initialTextBuffer,
  textBufferReducer,
} from "./text-buffer.js";
import type { TextBufferAction } from "./text-buffer.js";
import { useTheoTheme } from "./theme.js";

export interface ChatComposerProps {
  /**
   * Called with the trimmed buffer text on Enter. Exceptions propagate —
   * the composer never swallows caller errors (plan EC-5).
   */
  onSubmit: (text: string) => void;
  /** Dimmed hint shown while the buffer is empty. */
  placeholder?: string;
  /**
   * Multi-line mode (default): Ctrl+J ALWAYS inserts a newline (it is the
   * literal `\n` byte — works in every terminal); Shift+Enter also inserts
   * one, but ONLY on terminals that encode shift (kitty keyboard protocol) —
   * legacy terminals send plain Enter (plan ADR D3 caveat).
   */
  multiLine?: boolean;
  autoFocus?: boolean;
}

interface ComposerKey {
  return: boolean;
  shift: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  backspace: boolean;
  delete: boolean;
  ctrl: boolean;
  meta: boolean;
}

function newlineAction(
  input: string,
  key: ComposerKey,
  multiLine: boolean,
): TextBufferAction | undefined {
  // Ctrl+J arrives as a literal linefeed with key.return === false;
  // Shift+Enter only on terminals that encode shift (kitty protocol).
  const wantsNewline = input === "\n" || (key.return && key.shift);
  return multiLine && wantsNewline ? { type: "newline" } : undefined;
}

function motionAction(key: ComposerKey): TextBufferAction | undefined {
  if (key.leftArrow) {
    return { type: "move-left" };
  }
  if (key.rightArrow) {
    return { type: "move-right" };
  }
  if (key.backspace || key.delete) {
    // ink maps the 0x7f byte to `delete` on most terminals; both erase back.
    return { type: "delete-backward" };
  }
  return undefined;
}

function insertAction(
  input: string,
  key: ComposerKey,
): TextBufferAction | undefined {
  if (input.length > 0 && !key.ctrl && !key.meta && input !== "\n") {
    return { type: "insert", text: input };
  }
  return undefined;
}

/** Maps one useInput event to a buffer action (undefined = not a buffer op). */
function actionForKey(
  input: string,
  key: ComposerKey,
  multiLine: boolean,
): TextBufferAction | undefined {
  return (
    newlineAction(input, key, multiLine) ??
    motionAction(key) ??
    insertAction(input, key)
  );
}

interface CursorSlices {
  before: string;
  atCursor: string;
  after: string;
}

/**
 * Splits text for inverse-video cursor rendering (space at EOL/newline).
 * Slices by GRAPHEME — never splits a surrogate pair or combining sequence
 * (SEPA iteration-5 finding 1; plan ADR D3).
 */
function cursorSlices(text: string, cursorOffset: number): CursorSlices {
  const before = text.slice(0, cursorOffset);
  const raw = graphemeAt(text, cursorOffset);
  if (raw === "") {
    return { before, atCursor: " ", after: "" };
  }
  if (raw === "\n") {
    // Render a visible cursor cell, then the real newline + rest.
    return { before, atCursor: " ", after: text.slice(cursorOffset) };
  }
  return {
    before,
    atCursor: raw,
    after: text.slice(cursorOffset + raw.length),
  };
}

/**
 * Multi-line chat input on a grapheme-aware buffer (plan ADR D3).
 * Enter submits (whitespace-only is a no-op); the buffer clears on submit.
 *
 * Key caveat: ink conflates Backspace (0x7f) and Delete into erase-BACKWARD
 * on most terminals; forward-delete is reducer-reachable (`delete-forward`)
 * but not key-bound at M1 (same YAGNI posture as home/end).
 */
export function ChatComposer({
  onSubmit,
  placeholder = "",
  multiLine = true,
  autoFocus = true,
}: ChatComposerProps) {
  const [buffer, dispatch] = useReducer(textBufferReducer, initialTextBuffer);
  const { isFocused } = useFocus({ autoFocus });
  const theme = useTheoTheme();

  useInput(
    (input, key) => {
      if (key.return && !(key.shift && multiLine)) {
        const text = buffer.text.trim();
        if (text.length > 0) {
          dispatch({ type: "clear" });
          onSubmit(text);
        }
        return;
      }
      const action = actionForKey(input, key, multiLine);
      if (action !== undefined) {
        dispatch(action);
      }
    },
    { isActive: isFocused },
  );

  const { before, atCursor, after } = cursorSlices(
    buffer.text,
    buffer.cursorOffset,
  );
  const showPlaceholder = buffer.text.length === 0 && placeholder.length > 0;

  return (
    <Box>
      <Text color={theme.role.user.prefix}>{theme.role.user.glyph}</Text>
      {showPlaceholder ? (
        <Box>
          <Text inverse> </Text>
          <Text dimColor>{placeholder}</Text>
        </Box>
      ) : (
        <Text>
          {before}
          <Text inverse>{atCursor}</Text>
          {after}
        </Text>
      )}
    </Box>
  );
}
