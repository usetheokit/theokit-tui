// M21 composer-editor (plan m21-premium-capabilities T3.1, Feature B / ADR B1/B2):
// a PURE editor reducer that bundles the buffer + kill-ring + undo stack +
// input history into one state and one transition function — so kill/yank/undo/
// history are deterministically unit-testable (no refs, no timers), unlike the
// ref-based approach. The composer holds it via useReducer and stays a thin
// dispatcher. Buffer edits delegate to the pure textBufferReducer; the stateful
// rings live here, outside that reducer (SRP — text-buffer stays a pure buffer).

import {
  chordOf,
  defaultKeymap,
  resolveAction,
} from "./renderer/input/keybindings.js";
import type { Key } from "./renderer/input/key.js";
import {
  initialTextBuffer,
  killLineEnd,
  killLineStart,
  killWordBackward,
  killWordForward,
  textBufferReducer,
  type KillResult,
  type TextBufferAction,
  type TextBufferState,
} from "./text-buffer.js";

const HISTORY_CAP = 100;

export interface EditorState {
  buffer: TextBufferState;
  /** Kill-ring, most-recent last (Emacs cut buffer). */
  ring: string[];
  /** Undo snapshots, most-recent last (one-way; no redo — ADR B1). */
  undo: TextBufferState[];
  /** Submitted entries, most-recent last (session history). */
  history: string[];
  /** -1 = editing the live draft; else an index into `history`. */
  historyIndex: number;
  /** The live draft saved while browsing history. */
  draft: string;
  /** True when the previous op was a kill (drives kill coalescing). */
  lastKill: boolean;
  /** True when the previous op was a word-char insert (undo coalescing). */
  coalescingInsert: boolean;
}

export type KillKind = "line-end" | "line-start" | "word-back" | "word-forward";

export type EditorAction =
  | { type: "buffer"; action: TextBufferAction }
  | { type: "kill"; kind: KillKind }
  | { type: "yank" }
  | { type: "yank-pop" }
  | { type: "undo" }
  | { type: "history-prev" }
  | { type: "history-next" }
  | { type: "submit"; entry: string };

export const initialEditorState: EditorState = {
  buffer: initialTextBuffer,
  ring: [],
  undo: [],
  history: [],
  historyIndex: -1,
  draft: "",
  lastKill: false,
  coalescingInsert: false,
};

/** Push a snapshot, keeping the undo stack bounded like the history. */
function pushUndo(
  undo: TextBufferState[],
  snapshot: TextBufferState,
): TextBufferState[] {
  const next = [...undo, snapshot];
  return next.length > HISTORY_CAP
    ? next.slice(next.length - HISTORY_CAP)
    : next;
}

/** A run of word-char inserts coalesces into one undo step (fish-style, ADR B1). */
function isWordCharInsert(action: TextBufferAction): boolean {
  return action.type === "insert" && /^\w+$/.test(action.text);
}

function applyBuffer(
  state: EditorState,
  action: TextBufferAction,
): EditorState {
  const mutating =
    action.type !== "move-left" &&
    action.type !== "move-right" &&
    action.type !== "move-home" &&
    action.type !== "move-end" &&
    action.type !== "move-word-left" &&
    action.type !== "move-word-right";
  const coalesce = isWordCharInsert(action) && state.coalescingInsert;
  const undo =
    mutating && !coalesce ? pushUndo(state.undo, state.buffer) : state.undo;
  return {
    ...state,
    buffer: textBufferReducer(state.buffer, action),
    undo,
    lastKill: false,
    coalescingInsert: isWordCharInsert(action),
  };
}

const KILL_FNS: Record<KillKind, (s: TextBufferState) => KillResult> = {
  "line-end": killLineEnd,
  "line-start": killLineStart,
  "word-back": killWordBackward,
  "word-forward": killWordForward,
};

function applyKill(state: EditorState, kind: KillKind): EditorState {
  const result = KILL_FNS[kind](state.buffer);
  if (!result.killed) {
    return state;
  }
  // Backward kills prepend, forward kills append, when coalescing a run.
  const prepend = kind === "line-start" || kind === "word-back";
  let ring: string[];
  if (state.lastKill && state.ring.length > 0) {
    const last = state.ring[state.ring.length - 1]!;
    ring = [
      ...state.ring.slice(0, -1),
      prepend ? result.killed + last : last + result.killed,
    ];
  } else {
    ring = [...state.ring, result.killed];
  }
  return {
    ...state,
    buffer: result.state,
    ring,
    undo: pushUndo(state.undo, state.buffer),
    lastKill: true,
    coalescingInsert: false,
  };
}

function applyYank(state: EditorState): EditorState {
  const head = state.ring[state.ring.length - 1];
  if (head === undefined) {
    return state;
  }
  return {
    ...applyBuffer(state, { type: "insert", text: head }),
    lastKill: false,
  };
}

function applyYankPop(state: EditorState): EditorState {
  if (state.ring.length < 2) {
    return state;
  }
  // Rotate the ring, then re-yank: remove the previously-yanked head and insert
  // the new head at the same place.
  const previous = state.ring[state.ring.length - 1]!;
  const rotated = [
    state.ring[state.ring.length - 1]!,
    ...state.ring.slice(0, -1),
  ];
  const head = rotated[rotated.length - 1]!;
  const cursor = state.buffer.cursorOffset;
  const start = Math.max(0, cursor - previous.length);
  const withoutPrev: TextBufferState = {
    text: state.buffer.text.slice(0, start) + state.buffer.text.slice(cursor),
    cursorOffset: start,
  };
  return {
    ...state,
    ring: rotated,
    buffer: textBufferReducer(withoutPrev, { type: "insert", text: head }),
    lastKill: false,
    coalescingInsert: false,
  };
}

function applyUndo(state: EditorState): EditorState {
  const snapshot = state.undo[state.undo.length - 1];
  if (snapshot === undefined) {
    return state;
  }
  return {
    ...state,
    buffer: snapshot,
    undo: state.undo.slice(0, -1),
    lastKill: false,
    coalescingInsert: false,
  };
}

/** Load `text` into the buffer with the cursor at the end (history recall). */
function loadText(
  state: EditorState,
  text: string,
  historyIndex: number,
): EditorState {
  return {
    ...state,
    buffer: { text, cursorOffset: text.length },
    historyIndex,
    lastKill: false,
    coalescingInsert: false,
  };
}

function applyHistoryPrev(state: EditorState): EditorState {
  if (state.history.length === 0) {
    return state;
  }
  // First step off the live draft: remember it.
  const draft = state.historyIndex === -1 ? state.buffer.text : state.draft;
  const index =
    state.historyIndex === -1
      ? state.history.length - 1
      : Math.max(0, state.historyIndex - 1);
  return loadText({ ...state, draft }, state.history[index]!, index);
}

function applyHistoryNext(state: EditorState): EditorState {
  if (state.historyIndex === -1) {
    return state;
  }
  const index = state.historyIndex + 1;
  if (index >= state.history.length) {
    // Past the newest entry → restore the saved live draft.
    return loadText(state, state.draft, -1);
  }
  return loadText(state, state.history[index]!, index);
}

function applySubmit(state: EditorState, entry: string): EditorState {
  // Dedup a consecutive identical entry; cap the ring.
  const last = state.history[state.history.length - 1];
  const history =
    last === entry
      ? state.history
      : [...state.history, entry].slice(-HISTORY_CAP);
  return {
    ...initialEditorState,
    ring: state.ring,
    history,
  };
}

// The M19 keymap action name → editor action. History recall (arrows) is NOT
// here — it needs a first/last-line gate the composer owns.
const CHORD_ACTIONS: Record<string, EditorAction> = {
  "delete-word-back": { type: "kill", kind: "word-back" },
  "delete-word-forward": { type: "kill", kind: "word-forward" },
  "delete-to-line-start": { type: "kill", kind: "line-start" },
  "delete-to-line-end": { type: "kill", kind: "line-end" },
  "move-word-back": { type: "buffer", action: { type: "move-word-left" } },
  "move-word-forward": { type: "buffer", action: { type: "move-word-right" } },
  "move-line-start": { type: "buffer", action: { type: "move-home" } },
  "move-line-end": { type: "buffer", action: { type: "move-end" } },
  "delete-forward": { type: "buffer", action: { type: "delete-forward" } },
  yank: { type: "yank" },
  "yank-pop": { type: "yank-pop" },
};

/**
 * Resolve an emacs editor action from a keypress via the M19 keymap, or
 * undefined when the key is not an editor chord. `C-_` (0x1f) is undo.
 */
export function editorActionForChord(
  input: string,
  key: Key,
): EditorAction | undefined {
  if (input === "\x1f") {
    return { type: "undo" };
  }
  const chord = chordOf(input, key);
  const action = chord ? resolveAction(defaultKeymap, chord) : undefined;
  return action ? CHORD_ACTIONS[action] : undefined;
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "buffer":
      return applyBuffer(state, action.action);
    case "kill":
      return applyKill(state, action.kind);
    case "yank":
      return applyYank(state);
    case "yank-pop":
      return applyYankPop(state);
    case "undo":
      return applyUndo(state);
    case "history-prev":
      return applyHistoryPrev(state);
    case "history-next":
      return applyHistoryNext(state);
    case "submit":
      return applySubmit(state, action.entry);
  }
}
