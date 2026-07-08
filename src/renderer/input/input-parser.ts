// M19 input-parser (plan m19-input-stack, ADR D2/D4): the byte framer — a
// faithful port of Ink's input-parser.js (MIT). Slices a raw stdin stream into
// complete key/paste events, holds partial sequences in `pending`, splits
// held-backspace runs, and frames bracketed paste as an atomic `{paste}` event.
// Ported (not imported from ink/build) so the M20 Ink-drop is unblocked.

const ESC = "\x1b";
const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

/** A framed input event: a raw key sequence string, or an atomic paste. */
export type InputEvent = string | { paste: string };

interface Parsed {
  sequence: string;
  nextIndex: number;
}
type ParseResult = Parsed | "pending" | undefined;

const isCsiParameterByte = (b: number): boolean => b >= 0x30 && b <= 0x3f;
const isCsiIntermediateByte = (b: number): boolean => b >= 0x20 && b <= 0x2f;
const isCsiFinalByte = (b: number): boolean => b >= 0x40 && b <= 0x7e;

function parseCsiSequence(
  input: string,
  start: number,
  prefixLength: number,
): ParseResult {
  const payloadStart = start + prefixLength + 1;
  for (let index = payloadStart; index < input.length; index++) {
    // index < length guarantees a defined code point.
    const byte = input.codePointAt(index)!;
    if (isCsiParameterByte(byte) || isCsiIntermediateByte(byte)) {
      continue;
    }
    // Preserve legacy function-key sequences like ESC[[A and ESC[[5~.
    if (byte === 0x5b && index === payloadStart) {
      continue;
    }
    if (isCsiFinalByte(byte)) {
      return { sequence: input.slice(start, index + 1), nextIndex: index + 1 };
    }
    return undefined;
  }
  return "pending";
}

function parseSs3Sequence(
  input: string,
  start: number,
  prefixLength: number,
): ParseResult {
  const nextIndex = start + prefixLength + 2;
  if (nextIndex > input.length) {
    return "pending";
  }
  // nextIndex <= length guarantees a defined final byte.
  const finalByte = input.codePointAt(nextIndex - 1)!;
  if (!isCsiFinalByte(finalByte)) {
    return undefined;
  }
  return { sequence: input.slice(start, nextIndex), nextIndex };
}

function parseControlSequence(
  input: string,
  start: number,
  prefixLength: number,
): ParseResult {
  // The caller guards length, so the type byte after the prefix is defined.
  const type = input[start + prefixLength];
  if (type === "[") {
    return parseCsiSequence(input, start, prefixLength);
  }
  if (type === "O") {
    return parseSs3Sequence(input, start, prefixLength);
  }
  return undefined;
}

function parseEscapedCodePoint(input: string, escapeIndex: number): Parsed {
  const next = input.codePointAt(escapeIndex + 1);
  const nextLength = next !== undefined && next > 0xffff ? 2 : 1;
  const nextIndex = escapeIndex + 1 + nextLength;
  return { sequence: input.slice(escapeIndex, nextIndex), nextIndex };
}

function parseEscapeSequence(
  input: string,
  escapeIndex: number,
): Parsed | "pending" {
  if (escapeIndex === input.length - 1) {
    return "pending";
  }
  if (input[escapeIndex + 1] === ESC) {
    if (escapeIndex + 2 >= input.length) {
      return "pending";
    }
    const doubleEscape = parseControlSequence(input, escapeIndex, 2);
    if (doubleEscape === "pending") {
      return "pending";
    }
    if (doubleEscape) {
      return doubleEscape;
    }
    return {
      sequence: input.slice(escapeIndex, escapeIndex + 2),
      nextIndex: escapeIndex + 2,
    };
  }
  const control = parseControlSequence(input, escapeIndex, 1);
  if (control === "pending") {
    return "pending";
  }
  if (control) {
    return control;
  }
  return parseEscapedCodePoint(input, escapeIndex);
}

/**
 * Split a run of non-escape text so held-backspace bytes (0x7F/0x08) become
 * individual events — a terminal sends repeated bytes in one chunk, and
 * parseKeypress only recognizes a single backspace. `\r`/`\t` are NOT split
 * (they legitimately appear inside pasted text).
 */
function splitBackspaceBytes(text: string, events: InputEvent[]): void {
  let segmentStart = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === "\x7f" || character === "\x08") {
      if (index > segmentStart) {
        events.push(text.slice(segmentStart, index));
      }
      events.push(character);
      segmentStart = index + 1;
    }
  }
  if (segmentStart < text.length) {
    events.push(text.slice(segmentStart));
  }
}

function parseKeypresses(input: string): {
  events: InputEvent[];
  pending: string;
} {
  const events: InputEvent[] = [];
  let index = 0;
  while (index < input.length) {
    const escapeIndex = input.indexOf(ESC, index);
    if (escapeIndex === -1) {
      splitBackspaceBytes(input.slice(index), events);
      return { events, pending: "" };
    }
    if (escapeIndex > index) {
      splitBackspaceBytes(input.slice(index, escapeIndex), events);
    }
    const parsed = parseEscapeSequence(input, escapeIndex);
    if (parsed === "pending") {
      return { events, pending: input.slice(escapeIndex) };
    }
    if (parsed.sequence === PASTE_START) {
      const afterStart = parsed.nextIndex;
      const endIndex = input.indexOf(PASTE_END, afterStart);
      if (endIndex === -1) {
        return { events, pending: input.slice(escapeIndex) };
      }
      events.push({ paste: input.slice(afterStart, endIndex) });
      index = endIndex + PASTE_END.length;
      continue;
    }
    events.push(parsed.sequence);
    index = parsed.nextIndex;
  }
  return { events, pending: "" };
}

export interface InputParser {
  push(chunk: string): InputEvent[];
  hasPendingEscape(): boolean;
  flushPendingEscape(): string | undefined;
  reset(): void;
}

/** A stateful framer that accumulates `pending` bytes across chunks. */
export function createInputParser(): InputParser {
  let pending = "";
  return {
    push(chunk: string): InputEvent[] {
      const parsed = parseKeypresses(pending + chunk);
      pending = parsed.pending;
      return parsed.events;
    },
    hasPendingEscape(): boolean {
      // Don't flush while assembling a paste-start marker or awaiting paste end.
      return (
        pending.startsWith(ESC) &&
        !pending.startsWith(PASTE_START) &&
        pending !== "\x1b[200"
      );
    },
    flushPendingEscape(): string | undefined {
      if (!pending.startsWith(ESC)) {
        return undefined;
      }
      const pendingEscape = pending;
      pending = "";
      return pendingEscape;
    },
    reset(): void {
      pending = "";
    },
  };
}
