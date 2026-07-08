// M19 input barrel (plan m19-input-stack): the renderer's input surface. A
// sibling to the output `Terminal` seam. Ported from Ink (MIT) — no ink/build
// imports — so the M20 Ink-drop is unblocked.

export {
  createInputParser,
  type InputEvent,
  type InputParser,
} from "./input-parser.js";
export { parseKeypress, type Keypress } from "./parse-keypress.js";
export { projectKey, type Key } from "./key.js";
export {
  createInputSource,
  type InputSource,
  type InputStream,
  type KeyHandler,
  type PasteHandler,
} from "./input-source.js";
export { InputContext, useInput, usePaste } from "./use-input.js";
export {
  chordOf,
  defaultKeymap,
  resolveAction,
  type Action,
  type Chord,
  type Keymap,
} from "./keybindings.js";
