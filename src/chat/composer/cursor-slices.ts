import { graphemeAt } from "../text-buffer.js";

export interface CursorSlices {
  before: string;
  atCursor: string;
  after: string;
}

/**
 * Splits text for inverse-video cursor rendering (space at EOL/newline).
 * Slices by GRAPHEME — never splits a surrogate pair or combining sequence
 * (SEPA iteration-5 finding 1; plan ADR D3).
 */
export function cursorSlices(text: string, cursorOffset: number): CursorSlices {
  const before = text.slice(0, cursorOffset);
  const raw = graphemeAt(text, cursorOffset);
  if (raw === "") {
    return { before, atCursor: " ", after: "" };
  }
  if (raw === "\n") {
    // Render a visible cursor cell, then the real newline + rest.
    return { before, atCursor: " ", after: text.slice(cursorOffset) };
  }
  return {
    before,
    atCursor: raw,
    after: text.slice(cursorOffset + raw.length),
  };
}

/**
 * Multi-line chat input on a grapheme-aware buffer (plan ADR D3).
 * Enter submits (whitespace-only is a no-op); the buffer clears on submit.
 *
 * Environment caveats (review F-dom-2/F-dom-5):
 * - Requires a raw-mode-capable stdin (real TTY). Gate the mount on
 *   `process.stdin.isTTY` in non-interactive contexts, as `examples/scenes/chat.tsx`
 *   does — ink's `useInput` throws otherwise.
 * - Under NO_COLOR the inverse-video cursor is invisible (ANSI-only
 *   affordance); typed text still renders. A visible fallback is an M6 item.
 *
 * Key caveat: ink conflates Backspace (0x7f) and Delete into erase-BACKWARD
 * on most terminals; forward-delete is reducer-reachable (`delete-forward`)
 * but not key-bound at M1 (same YAGNI posture as home/end).
 */
// Single source for the degrade cursor glyph (review arch-3 — one knowledge,
// one site). U+258F, EAW-Ambiguous — same class as the shipped █/░ bars.
