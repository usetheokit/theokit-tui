import { EventEmitter } from "node:events";

// M19 test helper (plan m19-input-stack §6, fast tier): an in-process stdin that
// lies about isTTY and no-ops setRawMode, so the InputSource + hooks can be
// driven deterministically with byte fixtures — no subprocess, no real TTY.
// The PTY tier (node-pty, T3.1) exercises the REAL raw-mode path.

export interface FakeStdin extends EventEmitter {
  isTTY: boolean;
  setRawMode(enabled: boolean): void;
  rawModeCalls: boolean[];
  resume(): void;
  pause(): void;
  /** Simulate the terminal sending bytes to the program. */
  send(bytes: string): void;
}

export function createFakeStdin(): FakeStdin {
  const emitter = new EventEmitter() as FakeStdin;
  emitter.isTTY = true;
  emitter.rawModeCalls = [];
  emitter.setRawMode = (enabled: boolean): void => {
    emitter.rawModeCalls.push(enabled);
  };
  emitter.resume = (): void => {};
  emitter.pause = (): void => {};
  emitter.send = (bytes: string): void => {
    emitter.emit("data", Buffer.from(bytes, "utf8"));
  };
  return emitter;
}
