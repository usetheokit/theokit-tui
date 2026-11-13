import type { Chord, Keymap } from "../renderer/input/keybindings.js";

/** Options for {@link parseKeybindings}. */
export interface ParseKeybindingsOptions<A extends string> {
  /** The actions the app understands; any other action name is reported, not bound. */
  actions: readonly A[];
  /** Chords that can never be rebound. */
  reserved?: readonly Chord[];
  /** Chords the app always handles first, so a binding would never fire. */
  claimed?: readonly Chord[];
  /** The keymap to start from (copied, never mutated). Default: an empty map. */
  base?: Keymap;
}

const NAMED = new Set([
  "left",
  "right",
  "up",
  "down",
  "backspace",
  "delete",
  "tab",
  "escape",
  "return",
  "home",
  "end",
]);

const normalize = (chord: string): string => chord.trim().toLowerCase();

/** True when `chordOf` can produce this (already normalized) chord. */
function isChord(chord: string): boolean {
  if (NAMED.has(chord)) {
    return true;
  }
  return /^(ctrl|alt)\+.$/u.test(chord);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const malformed = (what: string) => ({
  chord: "",
  reason: `The keybindings document is malformed: ${what}.`,
});

type Report = { chord: string; reason: string };

/** The binding tables in a document, or a malformed report when it has none usable. */
function tablesOf(document: unknown): { tables: unknown[]; problem?: Report } {
  if (!isRecord(document)) {
    return { tables: [], problem: malformed("expected an object") };
  }
  if (!("bindings" in document)) {
    return { tables: [document] };
  }
  if (!Array.isArray(document.bindings)) {
    return { tables: [], problem: malformed("`bindings` must be an array of blocks") };
  }
  return { tables: document.bindings.map((b: unknown) => (isRecord(b) ? b.bindings : undefined)) };
}

/** Why a chord/action pair cannot be applied, or undefined when it can. */
function rejection(
  chord: string,
  raw: string,
  action: unknown,
  opts: { reserved: Set<string>; claimed: Set<string>; actions: Set<string> },
): Report | undefined {
  if (!isChord(chord)) {
    return {
      chord: raw,
      reason: `"${raw}" is not a chord the input layer can produce (ctrl+<key>, alt+<key> or a named key).`,
    };
  }
  if (opts.reserved.has(chord)) {
    return { chord, reason: `${chord} is reserved and cannot be rebound.` };
  }
  if (opts.claimed.has(chord)) {
    return {
      chord,
      reason: `${chord} is always handled by the app first, so a binding would never fire.`,
    };
  }
  if (action !== null && (typeof action !== "string" || !opts.actions.has(action))) {
    const shown = typeof action === "string" ? `"${action}"` : "a non-string value";
    return { chord, reason: `${chord} is bound to ${shown}, which is not a known action.` };
  }
  return undefined;
}

/**
 * Apply a keybindings document (the parsed JSON, read by the app) onto a keymap.
 *
 * Accepts `{ "<chord>": "<action>" | null }` or the nested
 * `{ bindings: [{ bindings: { ... } }] }`. Never throws: everything it could not apply is returned
 * in `notApplied`, each with an English reason naming the chord. `null` unbinds a chord.
 */
export function parseKeybindings<A extends string>(
  document: unknown,
  opts: ParseKeybindingsOptions<A>,
): { keymap: Keymap; notApplied: Report[] } {
  const keymap: Keymap = new Map(opts.base ?? []);
  const notApplied: Report[] = [];
  const sets = {
    reserved: new Set((opts.reserved ?? []).map(normalize)),
    claimed: new Set((opts.claimed ?? []).map(normalize)),
    actions: new Set<string>(opts.actions),
  };
  const { tables, problem } = tablesOf(document);
  if (problem) {
    notApplied.push(problem);
  }
  for (const table of tables) {
    if (!isRecord(table)) {
      notApplied.push(malformed("each block needs a `bindings` object"));
      continue;
    }
    for (const [raw, action] of Object.entries(table)) {
      const chord = normalize(raw);
      const bad = rejection(chord, raw, action, sets);
      if (bad) {
        notApplied.push(bad);
      } else if (action === null) {
        keymap.delete(chord);
      } else {
        keymap.set(chord, action as string);
      }
    }
  }
  return { keymap, notApplied };
}
