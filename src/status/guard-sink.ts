/**
 * Make a fired boundary guard observable outside the rendered frame.
 *
 * ## The measurement this exists for
 *
 * 24 public components in this package validate their props and throw a typed `TypeError` before
 * any hook runs (the F10 idiom, so a test calling the component as a plain function reaches the
 * guard). That decision is coherent and it is not what is broken.
 *
 * What was never decided is what a USER sees. React unwinds a render-time throw, Ink's renderer
 * catches nothing, and this package ships no error boundary — so a guard that fires produces an
 * EMPTY FRAME. No error, no log, nothing on screen. In a composite the sections that were fine
 * vanish along with the one that was not.
 *
 * The package already knew: `src/agent/agent-timeline.tsx:189` records, in its own words, that
 * `renderFrame` of an invalid event RESOLVES rather than rejects. That note was about making the
 * throw testable. This module is about making it visible.
 *
 * ## What it does, and what it deliberately does not
 *
 * Reporting is ADDITIVE. The throw is the contract 37 test files rest on, so `reportGuardFailure`
 * writes one line and then throws the error it was given — its return type is `never`, which makes
 * "and still throws" structural instead of a convention each of 24 call sites has to remember.
 *
 * It does NOT deduplicate. A guard firing on every render is a repeating problem, and collapsing
 * it to one line hides the signal that says so.
 *
 * It does NOT make the failure visible on SCREEN. That needs an error boundary component, which is
 * a larger surface decision recorded as an open question rather than smuggled in here.
 *
 * ## Where the line goes
 *
 * `process.stderr` by default, injectable like `notify(out = process.stdout)` in this same domain —
 * which is not a testing convenience: without it this package's own suite would write two dozen
 * diagnostics into the operator's terminal on every run.
 *
 * A TUI owns the screen, so a stray stderr write mid-frame corrupts the display. That is precisely
 * what `installStderrGuard` exists to prevent, and when it is installed these lines land in its log
 * file instead of the frame — measured, not assumed, in `guard-sink.test.ts`. When it is NOT
 * installed the line reaches the terminal and may land mid-frame. That is the accepted cost, and it
 * is the right side of the trade: a corrupted frame is repainted, a silent failure is not.
 *
 * @public
 */

/** Anything that can take a line. `process.stderr` satisfies it; so does a test double. */
export interface GuardSink {
  write(data: string): void;
}

/**
 * Report a boundary-guard failure, then throw it.
 *
 * @param error - the guard's own typed error. Its message is the line, so it must already name the
 *   component and the offending value — `.claude/rules/error-handling.md` § 5 bans the generic
 *   "invalid input" that tells an operator nothing they can act on.
 * @param sink - where the line goes. Defaults to `process.stderr`, resolved at call time so an
 *   installed `installStderrGuard` is honoured.
 * @returns never — it always throws `error`.
 * @public
 */
export function reportGuardFailure(
  error: Error,
  sink: GuardSink = process.stderr,
): never {
  try {
    sink.write(`[theokit/tui] ${error.message}\n`);
  } catch {
    // Best-effort by design. A closed pipe must not turn a diagnosable guard failure into an EPIPE
    // nobody can trace back to the real cause — the guard's own error is what the caller needs, and
    // swallowing THIS one is not the swallow `error-handling.md` forbids: nothing is lost that the
    // throw below does not already carry.
  }
  throw error;
}
