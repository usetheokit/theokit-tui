/**
 * `copyToClipboard` — write text to the system clipboard without blocking the Ink loop.
 *
 * Tries each candidate binary with a bounded `spawnSync` (so a hung compositor cannot freeze the
 * UI), treats a missing binary as "try the next one", and turns any other failure into a typed
 * error. An OSC 52 write on a TTY sink is an opt-in last resort, for ssh sessions where the
 * terminal can still take the text.
 *
 * @public
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import type { OscSink } from "../format/terminal-osc.js";

export interface ClipboardCommand {
  bin: string;
  args: readonly string[];
}

export const DEFAULT_CLIPBOARD_COMMANDS: readonly ClipboardCommand[] = [
  { bin: "wl-copy", args: [] },
  { bin: "xclip", args: ["-selection", "clipboard"] },
  { bin: "xsel", args: ["--clipboard", "--input"] },
  { bin: "pbcopy", args: [] },
  { bin: "clip.exe", args: [] },
];

const DEFAULT_TIMEOUT_MS = 5000;

export interface CopyToClipboardOptions {
  candidates?: readonly ClipboardCommand[];
  /** Per-binary timeout. Default 5000. */
  timeoutMs?: number;
  /** Fall back to an OSC 52 write on this sink when no binary exists. Off by default. */
  osc52?: OscSink;
  /** Test seam. */
  runner?: (
    bin: string,
    args: readonly string[],
    input: string,
    timeoutMs: number,
  ) => SpawnSyncReturns<string>;
}

/** No clipboard binary exists (and no usable OSC 52 sink). */
export class NoClipboardError extends Error {
  readonly tried: readonly string[];
  constructor(tried: readonly string[], osc52Note = "") {
    super(
      `No clipboard available: tried ${tried.length > 0 ? tried.join(", ") : "no binaries"}${osc52Note}.`,
    );
    this.name = "NoClipboardError";
    this.tried = tried;
  }
}

/** A clipboard binary exists but failed, timed out or exited non-zero. */
export class ClipboardWriteError extends Error {
  readonly bin: string;
  readonly detail: string;
  constructor(bin: string, detail: string, tried: readonly string[] = [bin]) {
    super(`Clipboard write via ${bin} failed: ${detail} (tried: ${tried.join(", ")})`);
    this.name = "ClipboardWriteError";
    this.bin = bin;
    this.detail = detail;
  }
}

const defaultRunner: NonNullable<CopyToClipboardOptions["runner"]> = (
  bin,
  args,
  input,
  timeoutMs,
) =>
  spawnSync(bin, [...args], {
    input,
    timeout: timeoutMs,
    // SIGTERM can be ignored, and spawnSync then waits for the child forever. SIGKILL cannot.
    killSignal: "SIGKILL",
    encoding: "utf8",
    stdio: ["pipe", "ignore", "pipe"],
  });

function failureDetail(result: SpawnSyncReturns<string>, timeoutMs: number): string {
  const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ETIMEDOUT") return `timed out after ${timeoutMs} ms`;
  if (result.error) return result.error.message;
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  return stderr || `exited with status ${result.status}`;
}

export function copyToClipboard(text: string, opts: CopyToClipboardOptions = {}): { via: string } {
  const candidates = opts.candidates ?? DEFAULT_CLIPBOARD_COMMANDS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const run = opts.runner ?? defaultRunner;
  const tried: string[] = [];

  for (const { bin, args } of candidates) {
    const result = run(bin, args, text, timeoutMs);
    if ((result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      tried.push(bin);
      continue;
    }
    if (result.error || result.status !== 0) {
      throw new ClipboardWriteError(bin, failureDetail(result, timeoutMs), [...tried, bin]);
    }
    return { via: bin };
  }

  if (opts.osc52?.isTTY === true) {
    opts.osc52.write(`\u001B]52;c;${Buffer.from(text, "utf8").toString("base64")}\u0007`);
    return { via: "osc52" };
  }
  throw new NoClipboardError(tried, opts.osc52 ? "; the OSC 52 sink is not a TTY" : "");
}
