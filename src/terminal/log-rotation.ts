/**
 * Size-capped log rotation: `x.log` → `x.log.0` → `x.log.1` → … → dropped.
 *
 * @public
 */

import { existsSync, renameSync, statSync, unlinkSync } from "node:fs";

/** 10 MiB. The size at which the active log is rolled. */
export const DEFAULT_CAP_BYTES = 10 * 1024 * 1024;

/** How many rolled generations to keep, including `.0`. */
export const DEFAULT_KEEP = 10;

/** @public */
export interface RotateOptions {
  /** Roll once the file reaches this size. Must be > 0. */
  readonly capBytes?: number;
  /** Generations to keep. Must be >= 1 — 0 would mean "truncate", which this does not do. */
  readonly keep?: number;
}

function requireValidArguments(capBytes: number, keep: number): void {
  // Typed and fail-fast, because a zero or negative cap silently means "rotate on every write" and
  // a keep of 0 silently means "delete the log" — both indistinguishable from working, later.
  if (!Number.isFinite(capBytes) || capBytes <= 0) {
    throw new RangeError(`invalid cap: ${String(capBytes)}`);
  }
  if (!Number.isInteger(keep) || keep < 1) {
    throw new RangeError(
      `keep must be >= 1 (0 is equivalent to truncate): ${String(keep)}`,
    );
  }
}

/**
 * Roll `path` when it has reached the cap. No-op when it is absent or still under it.
 *
 * Argument validation throws; filesystem failure does not. That asymmetry is deliberate: a bad
 * `keep` is a programming error the caller must see, while a full disk or a read-only directory is
 * an environment error on a best-effort path, and starting without rotating is strictly better than
 * refusing to start. This is not a swallowed domain error.
 *
 * @public
 */
export function rotateLog(path: string, options: RotateOptions = {}): void {
  const capBytes = options.capBytes ?? DEFAULT_CAP_BYTES;
  const keep = options.keep ?? DEFAULT_KEEP;
  requireValidArguments(capBytes, keep);

  try {
    if (!existsSync(path) || statSync(path).size < capBytes) return;
    const oldest = `${path}.${String(keep - 1)}`;
    if (existsSync(oldest)) unlinkSync(oldest);
    for (let i = keep - 2; i >= 0; i--) {
      const generation = `${path}.${String(i)}`;
      if (existsSync(generation))
        renameSync(generation, `${path}.${String(i + 1)}`);
    }
    renameSync(path, `${path}.0`);
  } catch {
    // See the docblock: environment failure on a best-effort path.
  }
}
