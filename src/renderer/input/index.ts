// M19 input barrel (plan m19-input-stack): the renderer's input surface. A
// sibling to the output `Terminal` seam. Ported from Ink (MIT) — no ink/build
// imports — so the M20 Ink-drop is unblocked.

export {
  createInputParser,
  type InputEvent,
  type InputParser,
} from "./input-parser.js";
export {
  createInputSource,
  type InputSource,
  type InputStream,
  type KeyHandler,
  type PasteHandler,
} from "./input-source.js";
export { type Key, projectKey } from "./key.js";
export {
  type Action,
  type Chord,
  chordOf,
  defaultKeymap,
  type Keymap,
  resolveAction,
} from "./keybindings.js";
export { detectKittyActive, KITTY_DISABLE, KITTY_ENABLE } from "./kitty.js";
export { type Keypress, parseKeypress } from "./parse-keypress.js";
export { InputContext, useInput, usePaste } from "./use-input.js";
