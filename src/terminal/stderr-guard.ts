/**
 * Keep stray writes to `process.stderr` from corrupting the frame.
 *
 * A terminal UI owns the screen. Anything that writes to stderr while a frame is being painted —
 * a dependency's deprecation notice, an unhandled-rejection warning, the runtime's own diagnostics —
 * lands in the middle of the drawing and the display is wrong until the next full repaint. The guard
 * redirects those writes to a log file for the duration of the session and returns the disposer that
 * puts the real stream back.
 *
 * ## The part that is easy to get wrong
 *
 * The obvious implementation swallows failures and returns `true`, so a session on a read-only path
 * runs with every diagnostic dead and nothing says so — and this is often the ONLY output channel a
 * TUI has left. Falling back to the real stderr is not the fix either: writing mid-frame is the
 * thing being prevented.
 *
 * So a failed write is counted, the first error is kept, and the total is reported once at teardown,
 * when the terminal is free again. The write itself returns `false`, which is what Node's stream
 * contract already means by it.
 *
 * @public
 */

import { appendFileSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";

import { DEFAULT_CAP_BYTES, DEFAULT_KEEP, rotateLog } from "./log-rotation.js";

/** @public */
export interface StderrGuardOptions {
  /** Prefix for the teardown report, so a reader knows which program lost diagnostics. */
  readonly label?: string;
  /** Roll the log at this size. */
  readonly capBytes?: number;
  /** Generations of the log to keep. */
  readonly keep?: number;
}

/**
 * Redirect `process.stderr.write` to `logPath`.
 *
 * @returns the disposer. Calling it restores the original stream and, if any write was lost, prints
 *   one line saying how many and why — to the REAL stderr, once the frame no longer matters.
 * @public
 */
export function installStderrGuard(logPath: string, options: StderrGuardOptions = {}): () => void {
  const label = options.label ?? "tui";
  const capBytes = options.capBytes ?? DEFAULT_CAP_BYTES;
  const keep = options.keep ?? DEFAULT_KEEP;

  const original = process.stderr.write;
  try {
    mkdirSync(dirname(logPath), { recursive: true });
  } catch {
    // Unwritable parent. Not fatal, and not silent either: every append below fails and the
    // teardown report says so.
  }
  rotateLog(logPath, { capBytes, keep });

  let dropped = 0;
  let firstError: string | undefined;
  // Rotating on accumulated bytes rather than on a `stat` per write: the guard sits on a path that
  // can be written thousands of times a session, and a stat each time is a syscall for nothing.
  let sinceRotation = 0;

  process.stderr.write = ((chunk: unknown): boolean => {
    const text = typeof chunk === "string" ? chunk : String(chunk);
    try {
      appendFileSync(logPath, text);
      sinceRotation += text.length;
      if (sinceRotation >= capBytes) {
        rotateLog(logPath, { capBytes, keep });
        sinceRotation = statSync(logPath).size;
      }
      return true;
    } catch (err) {
      dropped += 1;
      firstError ??= (err as Error).message;
      return false;
    }
  }) as typeof process.stderr.write;

  return () => {
    process.stderr.write = original;
    if (dropped > 0) {
      original.call(
        process.stderr,
        `[${label}] ${String(dropped)} diagnostic message(s) could not be written to ${logPath} ` +
          `and were lost: ${firstError ?? "unknown error"}\n`,
      );
    }
  };
}
