// Pure text-buffer domain logic for terminal input (plan T3.1, blueprint D3).
// NO ink/react imports — unit-testable without a TTY (rules/architecture.md § 1).
// Grapheme discipline via Intl.Segmenter: cursor ops never split emoji or
// combining marks (borrowed from the react-ink useTextBuffer analog).

export interface TextBufferState {
  text: string;
  /** Cursor position as a code-unit offset into `text`. */
  cursorOffset: number;
}

export type TextBufferAction =
  | { type: "insert"; text: string }
  | { type: "delete-backward" }
  | { type: "delete-forward" }
  | { type: "move-left" }
  | { type: "move-right" }
  | { type: "move-home" }
  | { type: "move-end" }
  | { type: "newline" }
  | { type: "clear" };

export const initialTextBuffer: TextBufferState = { text: "", cursorOffset: 0 };

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Offset of the grapheme boundary immediately BEFORE `offset` (0 at start). */
function prevBoundary(text: string, offset: number): number {
  let prev = 0;
  for (const seg of segmenter.segment(text)) {
    if (seg.index >= offset) {
      break;
    }
    prev = seg.index;
  }
  return prev;
}

/** Offset of the grapheme boundary immediately AFTER `offset` (length at end). */
function nextBoundary(text: string, offset: number): number {
  for (const seg of segmenter.segment(text)) {
    const end = seg.index + seg.segment.length;
    if (end > offset) {
      return end;
    }
  }
  return text.length;
}

function insertAt(state: TextBufferState, insertion: string): TextBufferState {
  const { text, cursorOffset } = state;
  return {
    text: text.slice(0, cursorOffset) + insertion + text.slice(cursorOffset),
    cursorOffset: cursorOffset + insertion.length,
  };
}

export function textBufferReducer(
  state: TextBufferState,
  action: TextBufferAction,
): TextBufferState {
  const { text, cursorOffset } = state;
  switch (action.type) {
    case "insert":
      return insertAt(state, action.text);
    case "newline":
      return insertAt(state, "\n");
    case "delete-backward": {
      if (cursorOffset === 0) {
        return state;
      }
      const start = prevBoundary(text, cursorOffset);
      return {
        text: text.slice(0, start) + text.slice(cursorOffset),
        cursorOffset: start,
      };
    }
    case "delete-forward": {
      if (cursorOffset >= text.length) {
        return state;
      }
      const end = nextBoundary(text, cursorOffset);
      return {
        text: text.slice(0, cursorOffset) + text.slice(end),
        cursorOffset,
      };
    }
    case "move-left":
      return cursorOffset === 0
        ? state
        : { text, cursorOffset: prevBoundary(text, cursorOffset) };
    case "move-right":
      return cursorOffset >= text.length
        ? state
        : { text, cursorOffset: nextBoundary(text, cursorOffset) };
    case "move-home": {
      const lineStart = text.lastIndexOf("\n", cursorOffset - 1) + 1;
      return { text, cursorOffset: lineStart };
    }
    case "move-end": {
      const nextNewline = text.indexOf("\n", cursorOffset);
      return {
        text,
        cursorOffset: nextNewline === -1 ? text.length : nextNewline,
      };
    }
    case "clear":
      return initialTextBuffer;
  }
}
