import { EventEmitter } from "node:events";

import { createInputParser } from "./input-parser.js";
import { projectKey, type Key } from "./key.js";

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
  /** Subscribe to paste events; returns an unsubscribe function. */
  onPaste(handler: PasteHandler): () => void;
  /** Ref-counted raw mode: raw is on while ≥ 1 consumer holds it. */
  setRawMode(enabled: boolean): void;
}

export function createInputSource(stdin: InputStream): InputSource {
  const parser = createInputParser();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  let rawModeRefCount = 0;
  let listener: ((chunk: Buffer) => void) | undefined;

  const dispatch = (chunk: Buffer): void => {
    for (const event of parser.push(chunk.toString("utf8"))) {
      if (typeof event === "string") {
        const { input, key } = projectKey(event);
        emitter.emit("key", input, key);
      } else if (emitter.listenerCount("paste") > 0) {
        emitter.emit("paste", event.paste);
      } else {
        // No paste listener — fall through to the key channel (Ink's fallback).
        emitter.emit("key", event.paste, projectKey("").key);
      }
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
    },
    stop(): void {
      if (listener) {
        stdin.off("data", listener);
        listener = undefined;
      }
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
  };
}
