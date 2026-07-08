import { nonAlphanumericKeys, parseKeypress } from "./parse-keypress.js";

// M19 key projection (plan m19-input-stack, ADR D2): the 12-field `Key` the
// ChatComposer consumes (matches `chat-composer.tsx:44-57` exactly) + the
// printable `input` string, projected from a parsed keypress — Ink's
// use-input.js:40-100 logic, ported. This is the compat contract: M15's composer
// runs unchanged iff these fields + input match Ink.

export interface Key {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  return: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  meta: boolean;
}

/** Project a raw framed sequence into `(input, key)` — the useInput handler args. */
export function projectKey(sequence: string): { input: string; key: Key } {
  const keypress = parseKeypress(sequence);
  const key: Key = {
    upArrow: keypress.name === "up",
    downArrow: keypress.name === "down",
    leftArrow: keypress.name === "left",
    rightArrow: keypress.name === "right",
    return: keypress.name === "return",
    escape: keypress.name === "escape",
    ctrl: keypress.ctrl,
    shift: keypress.shift,
    tab: keypress.name === "tab",
    backspace: keypress.name === "backspace",
    delete: keypress.name === "delete",
    meta: keypress.meta,
  };

  let input = keypress.ctrl ? keypress.name : keypress.sequence;
  if (nonAlphanumericKeys.includes(keypress.name)) {
    input = "";
  }
  // Strip an escape prefix from a broken/flushed sequence (e.g. lone "\x1b[").
  if (input.startsWith("\x1b")) {
    input = input.slice(1);
  }
  if (input.length === 1 && /[A-Z]/.test(input)) {
    key.shift = true;
  }
  return { input, key };
}
