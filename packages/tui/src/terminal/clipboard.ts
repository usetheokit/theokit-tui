/**
 * `copyToClipboard` — write text to the system clipboard without blocking the loop forever.
 *
 * Tries each clipboard binary in turn with a bounded `spawnSync`. A missing binary (`ENOENT`) means
 * "try the next one"; any other failure (non-zero exit, timeout) is a real write error and stops
 * the probe, because the next binary would only hide it. When no binary exists, an OSC 52 write on
 * a TTY sink is the fallback (the terminal can still take the text over ssh). Off by default.
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

/** No clipboard binary exists and no usable OSC 52 sink was given. */
export class NoClipboardError extends Error {
  readonly tried: readonly string[];
  constructor(tried: readonly string[], osc52Unavailable: boolean) {
    super(
      `No clipboard available: tried ${tried.length > 0 ? tried.join(", ") : "no binaries"}, none found` +
        (osc52Unavailable ? "; the OSC 52 sink is not a TTY." : "."),
    );
    this.name = "NoClipboardError";
    this.tried = tried;
  }
}

/** A clipboard binary exists but failed (non-zero exit, timeout, spawn error). */
export class ClipboardWriteError extends Error {
  readonly bin: string;
  readonly detail: string;
  constructor(bin: string, detail: string) {
    super(`Clipboard write failed via ${bin}: ${detail}`);
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
) => spawnSync(bin, [...args], { input, timeout: timeoutMs, encoding: "utf8" });

export function copyToClipboard(text: string, opts: CopyToClipboardOptions = {}): { via: string } {
  const candidates = opts.candidates ?? DEFAULT_CLIPBOARD_COMMANDS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const run = opts.runner ?? defaultRunner;
  const tried: string[] = [];

  for (const { bin, args } of candidates) {
    const result = run(bin, args, text, timeoutMs);
    const err = result.error as NodeJS.ErrnoException | undefined;
    if (err?.code === "ENOENT") {
      tried.push(bin);
      continue;
    }
    if (err) throw new ClipboardWriteError(bin, err.message);
    if (result.status !== 0) {
      const stderr = String(result.stderr ?? "").trim();
      throw new ClipboardWriteError(bin, stderr || `exited with status ${result.status}`);
    }
    return { via: bin };
  }

  if (opts.osc52?.isTTY === true) {
    opts.osc52.write(`\x1b]52;c;${Buffer.from(text, "utf8").toString("base64")}\x07`);
    return { via: "osc52" };
  }
  throw new NoClipboardError(tried, opts.osc52 !== undefined);
}
