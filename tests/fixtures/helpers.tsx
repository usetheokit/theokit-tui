import { render } from "ink-testing-library";
import type { ReactElement } from "react";
import { vi } from "vitest";

/**
 * Single determinism point for frame assertions (plan ADR D2, B-020 ADR D1):
 * render under FROZEN time, advance by exactly nothing, read `lastFrame`.
 *
 * ## Why time is frozen rather than raced
 *
 * This helper used to await `setTimeout(resolve, 0)` and then read the frame, and the comment here
 * explained the coupling that rested on: the 0 ms tick had to land BEFORE ink-spinner's first
 * ~80 ms `dots` interval, so `running` snapshots showed frame[0].
 *
 * `setTimeout(0)` does not fire in 0 ms. It fires when the event loop reaches it, and when the
 * worker process is descheduled under load, real time passes and the animation advances first.
 * Measured 2026-08-18: `npm test` at default workers failed 3 files under load 13-24, and a
 * different single file on another run, while `--maxWorkers=2` on an idle machine passed
 * 145/1564 — each failing file passing in isolation, and the failing SET differing between runs.
 *
 * `run_validation.py` runs `npm test` as a HARD gate of `IMPLEMENTATION_COMPLETE`, so this was not
 * merely annoying: the gate failed for reasons unrelated to the change under test, which is the
 * condition that teaches people to re-run until green — and a gate re-run until green has stopped
 * being a gate.
 *
 * With fake timers no wall-clock time passes between render and read, so no interval can fire and
 * the result no longer depends on what else the machine is doing.
 *
 * ## What was rejected
 *
 * Pinning `maxWorkers` was measured insufficient: a file still failed at `--maxWorkers=4` under
 * load 24. It bounds contention this repository inflicts on itself and does nothing about the rest
 * of the machine. Raising the delay past 80 ms inverts the coupling and flakes every
 * running-status snapshot in the other direction — this comment said so before the change. Retrying
 * until green would hide a real regression identically.
 *
 * ## Limit, stated
 *
 * This helper now requires vitest's timer API, so it cannot be used outside vitest. It never was. A
 * test that legitimately needs real time to elapse during a render must not use it.
 */
export const renderFrame = async (node: ReactElement): Promise<string> => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  try {
    const instance = render(node);
    // Flush what React queued for this render, advancing the clock by nothing.
    await vi.advanceTimersByTimeAsync(0);
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    return frame;
  } finally {
    // Always — a helper that leaked fake timers would corrupt every test after it in the file.
    vi.useRealTimers();
  }
};
