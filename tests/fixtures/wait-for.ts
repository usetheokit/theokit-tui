/**
 * Wait for a CONDITION to hold, instead of for a number of milliseconds to pass.
 *
 * ## The defect this replaces
 *
 * 13 test files awaited a fixed duration and then asserted — `await new Promise(r =>
 * setTimeout(r, 40))` and friends. That encodes "the effect completes within 40 ms", which is true
 * on an idle laptop and false on a loaded one. Measured 2026-08-18, on the
 * `run_validation.py` run immediately after B-020 landed:
 * `public-api.integration.test.tsx:103` wrote to stdin, slept 50 ms, and asserted 0 calls — while
 * passing 18/18 in isolation.
 *
 * B-020 fixed the same class for `renderFrame` by FREEZING time. That does not work here: these
 * sites wait on real round trips (stdin reaching a component, a pty starting), and a frozen clock
 * prevents the very thing being awaited. So this one polls instead.
 *
 * ## Why not `expect.poll`
 *
 * vitest 3.2 ships `expect.poll`, and reaching for it first is parsimony rung 2. It is rejected
 * here for one reason: it polls an ASSERTION, so the thing being waited for must be expressible as
 * a matcher on a value. Several of the 13 sites wait on a plain counter incremented by a callback
 * (`cancelled`, `attempts`) before asserting something else entirely, and a few wait for a
 * side effect with no value to poll at all. A predicate covers both shapes, and one idiom across
 * 13 files is the point of the slice.
 *
 * `expect.poll` remains the better tool where the wait IS the assertion, and nothing here stops a
 * future test from using it.
 *
 * ## The trade
 *
 * On a loaded machine this may take longer than the fixed sleep it replaces — it waits until the
 * condition actually holds. On an idle machine it is FASTER, because it stops at the first success
 * instead of always paying the full duration.
 */

/** @internal */
export interface WaitForOptions {
  /**
   * What is being waited for, in the words a failure should use — "the submit handler to fire".
   *
   * Required, not optional. Optional context is context nobody writes, and it is the whole
   * difference between a useful failure and "timeout", which is the generic message
   * `.claude/rules/error-handling.md` § 5 bans.
   */
  readonly describe: string;
  /**
   * How long to keep trying.
   *
   * 10000 ms by default.
   *
   * The first draft used 2000 ms, "matching the bound `waitForFrame` already uses" — and that bound
   * turned out to be the defect rather than the precedent. Measured 2026-08-18: at load 26,
   * `chat-composer.test.tsx > slash_command_menu_still_works_unchanged` exhausted exactly that
   * 2000 ms and failed with "frame never contained \"show help\"". The frame was correct; the
   * budget was not.
   *
   * 10000 ms sits under B-020's 15000 ms `testTimeout`, deliberately: a wait that outlived the test
   * timeout would surrender the failure message to vitest's generic one, and the message naming
   * what never happened is the entire point of this helper.
   *
   * The cost is that a genuinely broken wait takes 10 s to report. That is paid once per real
   * breakage, against a false failure paid on every loaded run.
   */
  readonly timeoutMs?: number;
  /** How long to wait between attempts. */
  readonly intervalMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The suite's one wait budget, exported so a helper that cannot use `waitFor` itself still shares
 * the number rather than inventing a fourth one.
 *
 * B-034 — `chat-composer.test.tsx`'s `typeUntil` RE-SENDS input between attempts, which `waitFor`
 * does not do, so it cannot simply delegate. It carried its own 2000 ms: the exact number B-033
 * measured expiring on a correct frame, in the same file where two other copies had already been
 * replaced.
 *
 * @internal
 */
export const WAIT_BUDGET_MS = DEFAULT_TIMEOUT_MS;
const DEFAULT_INTERVAL_MS = 5;

/**
 * Poll `predicate` until it returns true, or throw naming what never happened.
 *
 * @throws the predicate's own error, unchanged, if it throws — a broken test is not a slow one, and
 *   reporting a `TypeError` as "the condition never held" would hide it.
 * @internal
 */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  options: WaitForOptions,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const start = Date.now();

  // Checked BEFORE any wait: an already-satisfied condition must not cost an interval.
  for (;;) {
    if (await predicate()) return;
    const elapsed = Date.now() - start;
    if (elapsed >= timeoutMs) {
      throw new Error(
        `waitFor: timed out after ${String(elapsed)}ms waiting for ${options.describe}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
