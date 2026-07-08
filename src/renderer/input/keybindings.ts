import type { Key } from "./key.js";

// M19 keybindings (plan m19-input-stack, blueprint §4): a remappable emacs
// keymap — a plain `Map<Chord, Action>` (YAGNI: no manager class). `chordOf`
// builds a chord string from `(input, key)`; `resolveAction` looks it up. The
// ChatComposer consumes this instead of hard-coded key branches (M20 wiring).

/** A chord identifier, e.g. "ctrl+w", "alt+f", "left", "backspace". */
export type Chord = string;

/** A semantic editor action name resolved from a chord. */
export type Action = string;

export type Keymap = Map<Chord, Action>;

// Named keys that ARE chords on their own (no ctrl/alt needed).
const namedChords: Partial<Record<keyof Key, Chord>> = {
  leftArrow: "left",
  rightArrow: "right",
  upArrow: "up",
  downArrow: "down",
  backspace: "backspace",
  delete: "delete",
  tab: "tab",
  escape: "escape",
  return: "return",
};

/**
 * Build a chord string from a projected keypress, or `undefined` for a plain
 * printable char (which inserts rather than commands). Ctrl+letter → "ctrl+X";
 * Alt/meta+letter → "alt+X"; a named key → its name.
 */
export function chordOf(input: string, key: Key): Chord | undefined {
  if (key.ctrl && input.length === 1) {
    return "ctrl+" + input.toLowerCase();
  }
  if (key.meta && input.length === 1) {
    return "alt+" + input.toLowerCase();
  }
  for (const [field, chord] of Object.entries(namedChords)) {
    if (key[field as keyof Key]) {
      return chord;
    }
  }
  return undefined;
}

/** Resolve the action bound to a chord (or undefined when unbound). */
export function resolveAction(
  keymap: Keymap,
  chord: Chord,
): Action | undefined {
  return keymap.get(chord);
}

/** The emacs default bindings (pi keybindings.ts lineage). */
export const defaultKeymap: Keymap = new Map<Chord, Action>([
  ["ctrl+a", "move-line-start"],
  ["ctrl+e", "move-line-end"],
  ["ctrl+w", "delete-word-back"],
  ["ctrl+u", "delete-to-line-start"],
  ["ctrl+k", "delete-to-line-end"],
  ["alt+b", "move-word-back"],
  ["alt+f", "move-word-forward"],
  ["alt+d", "delete-word-forward"],
  ["ctrl+d", "delete-forward"],
  ["ctrl+y", "yank"],
  ["alt+y", "yank-pop"],
  ["left", "move-left"],
  ["right", "move-right"],
  ["backspace", "delete-backward"],
]);
