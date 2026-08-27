// Barrel for the composer's presentation parts (ADR 0002).
//
// ChatComposer itself stays in src/chat/chat-composer.tsx — it owns the input
// state machine. Everything here is a rendering unit it composes, split out so
// each can be read and tested on its own rather than at line 700 of one file.
//
// The two cursor cells are deliberately NOT here: they exist only for InputRow
// and live inside it. ADR 0002 asks for extraction when a component is reused,
// tested independently, or outgrows its file — not reflexively.

export { ComposerFooter } from "./composer-footer.js";
export { ComposerFrame } from "./composer-frame.js";
export type { ComposerVariant } from "./composer-frame.js";
export type { CursorSlices } from "./cursor-slices.js";
export { cursorSlices } from "./cursor-slices.js";
export { InputRow } from "./input-row.js";
export { SlashMenuList } from "./slash-menu-list.js";
