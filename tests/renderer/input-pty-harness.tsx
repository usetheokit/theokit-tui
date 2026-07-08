import {
  editorActionForChord,
  editorReducer,
  initialEditorState,
  type EditorState,
} from "../../src/composer-editor.js";
import { createInputSource } from "../../src/renderer/input/input-source.js";
import type { Key } from "../../src/renderer/input/key.js";
import type { TextBufferAction } from "../../src/text-buffer.js";

// M19 T3.1 PTY harness (plan §6): a standalone program node-pty spawns in a REAL
// pseudo-terminal. It reads process.stdin through OUR InputSource in RAW MODE
// (stdin.isTTY === true, real setRawMode), folds keys into the pure EDITOR
// reducer (M21 — kill-ring/undo/yank via the M19 keymap), and echoes state
// markers to stdout so the e2e can assert the real raw-mode path. Exercises the
// M15 EC-5 flow: a submit whose handler throws is caught at the top level.

function bufferAction(input: string, key: Key): TextBufferAction | undefined {
  if (key.leftArrow) return { type: "move-left" };
  if (key.rightArrow) return { type: "move-right" };
  if (key.backspace || key.delete) return { type: "delete-backward" };
  if (input === "\n") return { type: "newline" };
  if (input.length > 0 && !key.ctrl && !key.meta)
    return { type: "insert", text: input };
  return undefined;
}

let state: EditorState = initialEditorState;
const stdin = process.stdin as unknown as Parameters<
  typeof createInputSource
>[0];
const source = createInputSource(stdin);
source.setRawMode(true);
source.start();

// Startup marker: proves the REAL raw-mode path (isTTY true in the pty child).
process.stdout.write(`READY tty=${process.stdin.isTTY === true}\n`);

source.onKey((input, key) => {
  // Ctrl+C exits the harness cleanly.
  if (key.ctrl && input === "c") {
    source.stop();
    process.exit(0);
  }
  if (key.return) {
    try {
      // The M15 EC-5 flow: the submit handler throws. It must NOT be swallowed,
      // but the process survives (top-level catch) and the draft is intact.
      throw new Error("submit exploded");
    } catch (error) {
      process.stdout.write(`SUBMIT_ERROR:${(error as Error).message}\n`);
      process.stdout.write(`DRAFT:${state.buffer.text}\n`);
    }
    return;
  }
  // M21: an emacs editor chord (kill/yank/word-nav/undo) takes precedence;
  // otherwise a plain buffer action (insert/motion/delete).
  const editorAction = editorActionForChord(input, key);
  if (editorAction) {
    state = editorReducer(state, editorAction);
    process.stdout.write(`BUF:${state.buffer.text}\n`);
    return;
  }
  const action = bufferAction(input, key);
  if (action) {
    state = editorReducer(state, { type: "buffer", action });
    process.stdout.write(`BUF:${state.buffer.text}\n`);
  }
});
