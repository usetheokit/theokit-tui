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

/**
 * Shift+Enter chord — ONLY arrives on kitty-protocol terminals (ink 5 needs
 * the kitty handshake; unsynthesizable via test stdin — verified: CSI-u lands
 * as literal text). Unit-tested with a synthetic key object instead.
 * Exported for tests; not part of the package public surface.
 */
export function isShiftReturn(key: ComposerKey): boolean {
  return key.return && key.shift;
}

/**
 * Single source of the newline-vs-submit decision (review F-arch-3): the
 * submit gate is derived from THIS predicate, never re-encoded.
 */
export function isNewlineChord(
  input: string,
  key: ComposerKey,
  multiLine: boolean,
): boolean {
  // Ctrl+J arrives as a literal linefeed with key.return === false.
  return multiLine && (input === "\n" || isShiftReturn(key));
}

function newlineAction(
  input: string,
  key: ComposerKey,
  multiLine: boolean,
): TextBufferAction | undefined {
  return isNewlineChord(input, key, multiLine)
    ? { type: "newline" }
    : undefined;
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
 * Environment caveats (review F-dom-2/F-dom-5):
 * - Requires a raw-mode-capable stdin (real TTY). Gate the mount on
 *   `process.stdin.isTTY` in non-interactive contexts, as `examples/chat.tsx`
 *   does — ink's `useInput` throws otherwise.
 * - Under NO_COLOR the inverse-video cursor is invisible (ANSI-only
 *   affordance); typed text still renders. A visible fallback is an M6 item.
 *
 * Key caveat: ink conflates Backspace (0x7f) and Delete into erase-BACKWARD
 * on most terminals; forward-delete is reducer-reachable (`delete-forward`)
 * but not key-bound at M1 (same YAGNI posture as home/end).
 */
/** Placeholder-branch cursor cell (M6 D8): visible marker under no-color. */
function PlaceholderCursor({ marker }: { marker: boolean }) {
  return marker ? <Text>▏</Text> : <Text inverse> </Text>;
}

/** Text-branch cursor cell (M6 D8): `▏` before the char under no-color,
 * inverse styling otherwise. */
function CursorCell({
  atCursor,
  focused,
  marker,
}: {
  atCursor: string;
  focused: boolean;
  marker: boolean;
}) {
  if (marker) {
    return <>▏{atCursor}</>;
  }
  return <Text inverse={focused}>{atCursor}</Text>;
}

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
      if (key.return && !isNewlineChord(input, key, multiLine)) {
        const text = buffer.text.trim();
        if (text.length > 0) {
          // onSubmit BEFORE clear: a throwing handler propagates (EC-5) AND
          // the user's draft survives (review F-dom-6).
          onSubmit(text);
          dispatch({ type: "clear" });
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

  // M6 D8: at chalk level 0 the inverse attribute is stripped — the cursor
  // vanishes. Under the no-color THEME (degrade as data — no env read here)
  // a visible `▏` marker carries the affordance instead. Colored-mode bytes
  // are unchanged. Known scope (EC-1): TERM=dumb/bare-pipe with a colored
  // theme keeps the invisible inverse — the cursor is an interactive
  // affordance, meaningless in non-interactive pipes; NO_COLOR is the
  // standard opt-out for dumb interactive terminals.
  const noColorMarker = theme.name === "no-color" && isFocused;
  return (
    <Box>
      <Text color={theme.role.user.prefix}>{theme.role.user.glyph}</Text>
      {showPlaceholder ? (
        <Box>
          {isFocused && <PlaceholderCursor marker={noColorMarker} />}
          <Text dimColor>{placeholder}</Text>
        </Box>
      ) : (
        <Text>
          {before}
          {/* Cursor cell only while focused (review F-dom-4 — plan: "cursor
              shows when focused"); blurred composers render plain text. */}
          <CursorCell
            atCursor={atCursor}
            focused={isFocused}
            marker={noColorMarker}
          />
          {after}
        </Text>
      )}
    </Box>
  );
}
