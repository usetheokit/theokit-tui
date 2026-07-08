// M19 parse-keypress (plan m19-input-stack, ADR D2/D4): the keypress semantics —
// a faithful port of Ink's parse-keypress.js (MIT, enquirer lineage), reduced to
// the LEGACY path (kitty CSI-u decode is deferred to M21; M19 ships kitty
// handshake-awareness only, T3.1). A framed byte sequence → a Keypress. Ported
// (not imported from ink/build) so the M20 Ink-drop is unblocked.

export interface Keypress {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
  code?: string;
}

// The ESC byte is injected via fromCharCode so no control char appears as a
// regex literal in source (eslint no-control-regex flags even `\xNN` escapes).
const ESC = String.fromCharCode(27);
const metaKeyCodeRe = new RegExp("^(?:" + ESC + ")([a-zA-Z0-9])$");
const fnKeyRe = new RegExp(
  "^(?:" +
    ESC +
    "+)(O|N|\\[|\\[\\[)(?:(\\d+)(?:;(\\d+))?([~^$])|(?:1;)?(\\d+)?([a-zA-Z]))",
);

// The xterm/vt/rxvt escape-code → key-name table (Ink's, verbatim).
const keyName: Record<string, string> = {
  OP: "f1",
  OQ: "f2",
  OR: "f3",
  OS: "f4",
  "[P": "f1",
  "[Q": "f2",
  "[R": "f3",
  "[S": "f4",
  "[11~": "f1",
  "[12~": "f2",
  "[13~": "f3",
  "[14~": "f4",
  "[[A": "f1",
  "[[B": "f2",
  "[[C": "f3",
  "[[D": "f4",
  "[[E": "f5",
  "[15~": "f5",
  "[17~": "f6",
  "[18~": "f7",
  "[19~": "f8",
  "[20~": "f9",
  "[21~": "f10",
  "[23~": "f11",
  "[24~": "f12",
  "[A": "up",
  "[B": "down",
  "[C": "right",
  "[D": "left",
  "[E": "clear",
  "[F": "end",
  "[H": "home",
  OA: "up",
  OB: "down",
  OC: "right",
  OD: "left",
  OE: "clear",
  OF: "end",
  OH: "home",
  "[1~": "home",
  "[2~": "insert",
  "[3~": "delete",
  "[4~": "end",
  "[5~": "pageup",
  "[6~": "pagedown",
  "[[5~": "pageup",
  "[[6~": "pagedown",
  "[7~": "home",
  "[8~": "end",
  "[a": "up",
  "[b": "down",
  "[c": "right",
  "[d": "left",
  "[e": "clear",
  "[2$": "insert",
  "[3$": "delete",
  "[5$": "pageup",
  "[6$": "pagedown",
  "[7$": "home",
  "[8$": "end",
  Oa: "up",
  Ob: "down",
  Oc: "right",
  Od: "left",
  Oe: "clear",
  "[2^": "insert",
  "[3^": "delete",
  "[5^": "pageup",
  "[6^": "pagedown",
  "[7^": "home",
  "[8^": "end",
  "[Z": "tab",
};

/** Every non-alphanumeric key name (used to blank the printable `input`). */
export const nonAlphanumericKeys = [...Object.values(keyName), "backspace"];

const shiftKeyCodes = [
  "[a",
  "[b",
  "[c",
  "[d",
  "[e",
  "[2$",
  "[3$",
  "[5$",
  "[6$",
  "[7$",
  "[8$",
  "[Z",
];
const ctrlKeyCodes = [
  "Oa",
  "Ob",
  "Oc",
  "Od",
  "Oe",
  "[2^",
  "[3^",
  "[5^",
  "[6^",
  "[7^",
  "[8^",
];
const isShiftKey = (code: string): boolean => shiftKeyCodes.includes(code);
const isCtrlKey = (code: string): boolean => ctrlKeyCodes.includes(code);

type KeyMatch = Partial<Keypress> | null;

// Exact-match control sequences → semantics (table-driven; meta = ESC-prefixed).
const controlChars: Record<string, Partial<Keypress>> = {
  "\r": { name: "return", meta: false },
  "\x1b\r": { name: "return", meta: true },
  "\n": { name: "enter" }, // Ctrl+J — inserts a newline (not return)
  "\t": { name: "tab" },
  "\b": { name: "backspace", meta: false },
  "\x7f": { name: "backspace", meta: false },
  "\x1b\b": { name: "backspace", meta: true },
  "\x1b\x7f": { name: "backspace", meta: true },
  "\x1b": { name: "escape", meta: false },
  "\x1b\x1b": { name: "escape", meta: true },
  " ": { name: "space", meta: false },
  "\x1b ": { name: "space", meta: true },
};

function matchControlChar(s: string): KeyMatch {
  return controlChars[s] ?? null;
}

/** Single printable/control char (ctrl+letter / number / lower / upper). */
function matchSingleChar(s: string): KeyMatch {
  if (s.length !== 1) return null;
  if (s <= "\x1a") {
    return {
      name: String.fromCharCode(s.charCodeAt(0) + "a".charCodeAt(0) - 1),
      ctrl: true,
    };
  }
  if (s >= "0" && s <= "9") return { name: "number" };
  if (s >= "a" && s <= "z") return { name: s };
  if (s >= "A" && s <= "Z") return { name: s.toLowerCase(), shift: true };
  return null;
}

/** Build a function-key match from the fnKeyRe capture groups + modifier bits. */
function buildFnKey(s: string, fn: RegExpExecArray): Partial<Keypress> {
  const doubleEscMeta = s.startsWith(ESC + ESC);
  const code = [fn[1], fn[2], fn[4], fn[6]].filter(Boolean).join("");
  const modifier = (Number(fn[3] ?? fn[5] ?? 1) || 1) - 1;
  return {
    name: keyName[code] ?? "",
    code,
    ctrl: !!(modifier & 4) || isCtrlKey(code),
    meta: doubleEscMeta || !!(modifier & 10),
    shift: !!(modifier & 1) || isShiftKey(code),
  };
}

/** Meta+char and the CSI/SS3 function-key forms (arrows, delete, etc.). */
function matchEscapeForm(s: string): KeyMatch {
  const meta = metaKeyCodeRe.exec(s);
  if (meta) {
    return {
      name: meta[1]!.toLowerCase(),
      meta: true,
      shift: /^[A-Z]$/.test(meta[1]!),
    };
  }
  const fn = fnKeyRe.exec(s);
  return fn ? buildFnKey(s, fn) : null;
}

/** Parse one framed byte sequence into its key semantics (legacy path). */
export function parseKeypress(s = ""): Keypress {
  const base: Keypress = {
    name: "",
    ctrl: false,
    meta: false,
    shift: false,
    sequence: s,
  };
  const match = matchControlChar(s) ?? matchSingleChar(s) ?? matchEscapeForm(s);
  return match ? { ...base, ...match } : base;
}
