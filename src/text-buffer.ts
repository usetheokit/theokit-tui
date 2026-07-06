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

function deleteBackward(state: TextBufferState): TextBufferState {
  if (state.cursorOffset === 0) {
    return state;
  }
  const start = prevBoundary(state.text, state.cursorOffset);
  return {
    text: state.text.slice(0, start) + state.text.slice(state.cursorOffset),
    cursorOffset: start,
  };
}

function deleteForward(state: TextBufferState): TextBufferState {
  if (state.cursorOffset >= state.text.length) {
    return state;
  }
  const end = nextBoundary(state.text, state.cursorOffset);
  return {
    text: state.text.slice(0, state.cursorOffset) + state.text.slice(end),
    cursorOffset: state.cursorOffset,
  };
}

function moveLeft(state: TextBufferState): TextBufferState {
  if (state.cursorOffset === 0) {
    return state;
  }
  return {
    ...state,
    cursorOffset: prevBoundary(state.text, state.cursorOffset),
  };
}

function moveRight(state: TextBufferState): TextBufferState {
  if (state.cursorOffset >= state.text.length) {
    return state;
  }
  return {
    ...state,
    cursorOffset: nextBoundary(state.text, state.cursorOffset),
  };
}

function moveHome(state: TextBufferState): TextBufferState {
  const lineStart = state.text.lastIndexOf("\n", state.cursorOffset - 1) + 1;
  return { ...state, cursorOffset: lineStart };
}

function moveEnd(state: TextBufferState): TextBufferState {
  const nextNewline = state.text.indexOf("\n", state.cursorOffset);
  return {
    ...state,
    cursorOffset: nextNewline === -1 ? state.text.length : nextNewline,
  };
}

export function textBufferReducer(
  state: TextBufferState,
  action: TextBufferAction,
): TextBufferState {
  switch (action.type) {
    case "insert":
      return insertAt(state, action.text);
    case "newline":
      return insertAt(state, "\n");
    case "delete-backward":
      return deleteBackward(state);
    case "delete-forward":
      return deleteForward(state);
    case "move-left":
      return moveLeft(state);
    case "move-right":
      return moveRight(state);
    case "move-home":
      return moveHome(state);
    case "move-end":
      return moveEnd(state);
    case "clear":
      return initialTextBuffer;
  }
}
