import { EventEmitter } from "node:events";

import { createInputParser } from "./input-parser.js";
import { type Key, projectKey } from "./key.js";
import { detectKittyActive, KITTY_DISABLE, KITTY_ENABLE } from "./kitty.js";

// M19 InputSource (plan m19-input-stack, ADR D1/D3): the raw-stdin lifecycle —
// a symmetric sibling to the output Terminal seam. Reads a stdin stream, frames
// bytes through the parser, and emits key events (input, key) + paste events
// (content) on SEPARATE channels to any number of subscribers (Ink's emitter
// model). setRawMode is ref-counted (App.js:208-256) so mounting/unmounting
// components never thrashes raw mode. Injecting the stream keeps it testable.

/** The minimal stdin surface the InputSource needs (real stdin or a fake). */
export interface InputStream {
  isTTY?: boolean;
  setRawMode?(enabled: boolean): void;
  on(event: "data", listener: (chunk: Buffer) => void): void;
  off(event: "data", listener: (chunk: Buffer) => void): void;
  resume?(): void;
  pause?(): void;
}

export type KeyHandler = (input: string, key: Key) => void;
export type PasteHandler = (content: string) => void;

export interface InputSource {
  start(): void;
  stop(): void;
  /** Subscribe to key events; returns an unsubscribe function. */
  onKey(handler: KeyHandler): () => void;
  /**
   * Subscribe to key events on the PRIORITY channel — these run before every
   * `onKey` subscriber, regardless of registration order (React effects fire
   * bottom-up, so a parent focus arbiter cannot rely on subscribing first).
   * Ink's App runs its ESC/Tab focus arbiter ahead of useInput the same way.
   */
  onKeyPriority(handler: KeyHandler): () => void;
  /** Subscribe to paste events; returns an unsubscribe function. */
  onPaste(handler: PasteHandler): () => void;
  /** Ref-counted raw mode: raw is on while ≥ 1 consumer holds it. */
  setRawMode(enabled: boolean): void;
  /** True once a kitty keyboard-protocol reply has been seen (awareness). */
  isKittyActive(): boolean;
}

/**
 * @param stdin the input stream to read.
 * @param writeToTerminal optional output writer — when provided, `start` emits
 *   the kitty enable handshake and `stop` emits the disable pop (the query the
 *   terminal replies to, so `isKittyActive()` can ever become true). Without it
 *   the source is read-only (awareness detection still works if some other layer
 *   already sent the query).
 */
export function createInputSource(
  stdin: InputStream,
  writeToTerminal?: (data: string) => void,
): InputSource {
  const parser = createInputParser();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  let rawModeRefCount = 0;
  let listener: ((chunk: Buffer) => void) | undefined;
  let kittyActive = false;
  let escapeFlushTimer: ReturnType<typeof setTimeout> | undefined;

  // A lone ESC is held pending (it may start a longer sequence). Flush it as the
  // Escape key after a short delay if no continuation arrives — Ink's App
  // schedulePendingInputFlush (App.js:164-173). Without this, pressing Escape
  // never delivers a key (the focus arbiter + composer ESC-dismiss depend on it).
  const ESCAPE_FLUSH_MS = 20;

  // Priority subscribers fire before the regular "key" channel (focus arbiter).
  const emitKey = (input: string, key: Key): void => {
    emitter.emit("key:priority", input, key);
    emitter.emit("key", input, key);
  };

  const clearEscapeFlush = (): void => {
    if (escapeFlushTimer) {
      clearTimeout(escapeFlushTimer);
      escapeFlushTimer = undefined;
    }
  };

  const scheduleEscapeFlush = (): void => {
    clearEscapeFlush();
    escapeFlushTimer = setTimeout(() => {
      escapeFlushTimer = undefined;
      const pending = parser.flushPendingEscape();
      if (pending !== undefined) {
        const { input, key } = projectKey(pending);
        emitKey(input, key);
      }
    }, ESCAPE_FLUSH_MS);
  };

  const dispatch = (chunk: Buffer): void => {
    clearEscapeFlush(); // a new chunk may complete the pending escape
    for (const event of parser.push(chunk.toString("utf8"))) {
      if (typeof event === "string") {
        // A kitty handshake reply is awareness state — not a key event.
        if (detectKittyActive(event)) {
          kittyActive = true;
          continue;
        }
        const { input, key } = projectKey(event);
        emitKey(input, key);
      } else if (emitter.listenerCount("paste") > 0) {
        emitter.emit("paste", event.paste);
      } else {
        // No paste listener — fall through to the key channel (Ink's fallback).
        emitKey(event.paste, projectKey("").key);
      }
    }
    if (parser.hasPendingEscape()) {
      scheduleEscapeFlush(); // lone ESC → deliver it after the flush delay
    }
  };

  return {
    start(): void {
      if (listener) {
        return;
      }
      listener = dispatch;
      stdin.on("data", listener);
      stdin.resume?.();
      writeToTerminal?.(KITTY_ENABLE); // query kitty support (awareness handshake)
    },
    stop(): void {
      clearEscapeFlush();
      if (listener) {
        stdin.off("data", listener);
        listener = undefined;
      }
      writeToTerminal?.(KITTY_DISABLE); // pop the kitty flag stack on teardown
      emitter.removeAllListeners();
      if (rawModeRefCount > 0) {
        rawModeRefCount = 0;
        stdin.setRawMode?.(false);
      }
    },
    onKey(handler: KeyHandler): () => void {
      emitter.on("key", handler);
      return () => emitter.off("key", handler);
    },
    onKeyPriority(handler: KeyHandler): () => void {
      emitter.on("key:priority", handler);
      return () => emitter.off("key:priority", handler);
    },
    onPaste(handler: PasteHandler): () => void {
      emitter.on("paste", handler);
      return () => emitter.off("paste", handler);
    },
    setRawMode(enabled: boolean): void {
      if (enabled) {
        rawModeRefCount += 1;
        if (rawModeRefCount === 1) {
          stdin.setRawMode?.(true);
        }
      } else if (rawModeRefCount > 0) {
        rawModeRefCount -= 1;
        if (rawModeRefCount === 0) {
          stdin.setRawMode?.(false);
        }
      }
    },
    isKittyActive(): boolean {
      return kittyActive;
    },
  };
}
