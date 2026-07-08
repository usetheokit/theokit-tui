// Pure text-buffer domain logic for terminal input (plan T3.1, blueprint D3).
// NO ink/react imports — unit-testable without a TTY (rules/architecture.md § 1).
// Grapheme discipline via Intl.Segmenter: cursor ops never split emoji or
// combining marks (borrowed from the react-ink useTextBuffer analog).

import {
  findWordBackward,
  findWordForward,
} from "./renderer/word-navigation.js";

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
  | { type: "move-word-left" }
  | { type: "move-word-right" }
  | { type: "newline" }
  | { type: "clear" }
  /** M15: replace line 1 with `/name ` (cursor after the space) —
   * the slash-menu completion writes through the reducer (plan D3). */
  | { type: "complete-command"; name: string }
  /** M21: replace the whole state — undo / yank-pop / history restore write
   * through the reducer so React sees one atomic transition (plan ADR B2). */
  | { type: "set"; state: TextBufferState };

/** The result of a kill: the new buffer state + the removed slice (→ kill-ring). */
export interface KillResult {
  state: TextBufferState;
  killed: string;
}

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
  // Defensive fall-through: every public caller guards offset >= text.length
  // before reaching here (unreachable via the API).
  /* v8 ignore next 2 */
  return text.length;
}

/** The full grapheme starting at `offset` ("" at end of text). */
export function graphemeAt(text: string, offset: number): string {
  if (offset >= text.length) {
    return "";
  }
  return text.slice(offset, nextBoundary(text, offset));
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
  if (state.cursorOffset === 0) {
    // lastIndexOf("\n", -1) clamps to 0 and would match a LEADING newline,
    // moving the cursor forward (SEPA iteration-5 finding 2).
    return state;
  }
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

/**
 * Pure reducer over the buffer state. PUBLIC API safety (review F-arch-4):
 * a caller-supplied out-of-range `cursorOffset` is clamped to [0, text.length]
 * at entry — malformed state degrades safely instead of corrupting text.
 */
function clampCursor(state: TextBufferState): TextBufferState {
  if (state.cursorOffset >= 0 && state.cursorOffset <= state.text.length) {
    return state;
  }
  return {
    text: state.text,
    cursorOffset: Math.min(Math.max(0, state.cursorOffset), state.text.length),
  };
}

/** M15 D3: replace line 1 with `/name ` — cursor after the space. */
function completeCommand(
  state: TextBufferState,
  name: string,
): TextBufferState {
  const rest = state.text.includes("\n")
    ? state.text.slice(state.text.indexOf("\n"))
    : "";
  const line = `/${name} `;
  return { text: line + rest, cursorOffset: line.length };
}

function moveWordLeft(state: TextBufferState): TextBufferState {
  return {
    ...state,
    cursorOffset: findWordBackward(state.text, state.cursorOffset),
  };
}

function moveWordRight(state: TextBufferState): TextBufferState {
  return {
    ...state,
    cursorOffset: findWordForward(state.text, state.cursorOffset),
  };
}

/** Offset of the current line's start (after the previous newline, or 0). */
function lineStartOffset(text: string, cursor: number): number {
  return cursor === 0 ? 0 : text.lastIndexOf("\n", cursor - 1) + 1;
}

/** Offset of the current line's end (the next newline, or text length). */
function lineEndOffset(text: string, cursor: number): number {
  const next = text.indexOf("\n", cursor);
  return next === -1 ? text.length : next;
}

/** Remove `[from, to)` and place the cursor at `from`; return the removed slice. */
function sliceKill(
  state: TextBufferState,
  from: number,
  to: number,
): KillResult {
  return {
    state: {
      text: state.text.slice(0, from) + state.text.slice(to),
      cursorOffset: from,
    },
    killed: state.text.slice(from, to),
  };
}

/** Kill from the cursor to the end of the line (Emacs C-k). Pure. */
export function killLineEnd(state: TextBufferState): KillResult {
  const s = clampCursor(state);
  return sliceKill(s, s.cursorOffset, lineEndOffset(s.text, s.cursorOffset));
}

/** Kill from the start of the line to the cursor (Emacs C-u). Pure. */
export function killLineStart(state: TextBufferState): KillResult {
  const s = clampCursor(state);
  return sliceKill(s, lineStartOffset(s.text, s.cursorOffset), s.cursorOffset);
}

/** Kill the word before the cursor (Emacs C-w). Pure. */
export function killWordBackward(state: TextBufferState): KillResult {
  const s = clampCursor(state);
  return sliceKill(s, findWordBackward(s.text, s.cursorOffset), s.cursorOffset);
}

/** Kill the word after the cursor (Emacs M-d). Pure. */
export function killWordForward(state: TextBufferState): KillResult {
  const s = clampCursor(state);
  return sliceKill(s, s.cursorOffset, findWordForward(s.text, s.cursorOffset));
}

// Table-driven dispatch (the 10-case switch tripped the complexity lint
// at M15): one handler per action type; the cast is safe because the key
// IS the discriminant.
const ACTION_HANDLERS: {
  [K in TextBufferAction["type"]]: (
    state: TextBufferState,
    action: Extract<TextBufferAction, { type: K }>,
  ) => TextBufferState;
} = {
  insert: (state, action) => insertAt(state, action.text),
  newline: (state) => insertAt(state, "\n"),
  "delete-backward": (state) => deleteBackward(state),
  "delete-forward": (state) => deleteForward(state),
  "move-left": (state) => moveLeft(state),
  "move-right": (state) => moveRight(state),
  "move-home": (state) => moveHome(state),
  "move-end": (state) => moveEnd(state),
  "move-word-left": (state) => moveWordLeft(state),
  "move-word-right": (state) => moveWordRight(state),
  "complete-command": (state, action) => completeCommand(state, action.name),
  set: (_state, action) => clampCursor(action.state),
  clear: () => initialTextBuffer,
};

export function textBufferReducer(
  state: TextBufferState,
  action: TextBufferAction,
): TextBufferState {
  state = clampCursor(state);
  const handler = ACTION_HANDLERS[action.type] as (
    s: TextBufferState,
    a: TextBufferAction,
  ) => TextBufferState;
  return handler(state, action);
}
