/**
 * Leave a durable, safe, attributable record when a boundary guard fires.
 *
 * ## What production actually does (measured, and NOT what v1 of this module claimed)
 *
 * 21 public components in this package validate their props and throw a typed `TypeError` before
 * any hook (the F10 idiom, so a test calling the component as a plain function reaches the guard).
 *
 * Measured 2026-08-18 against `ink@7.1.0` + `react@19.2.7` with a real `render()`: a throw from a
 * render path unmounts the WHOLE app — sibling sections vanish with the offending one — and ink's
 * `ErrorBoundary` (`ink/build/components/ErrorBoundary.js`, wired at `App.js:550`) prints an
 * `ERROR` panel to **stdout** carrying the message, the absolute source path, a source excerpt and
 * a reconciler stack. `waitUntilExit()` rejects and the process exits **0**.
 *
 * v1 of this file asserted the opposite: that no error boundary was in play, that the renderer
 * discarded the throw, and that the result was a blank region with nothing recorded anywhere. That
 * measurement was taken through `renderFrame` / `ink-testing-library`, so it described the TEST
 * HARNESS and not the product. The false phrasing is deliberately not quoted, so a grep for it
 * stays a reliable guard against it returning. The teardown, the developer-facing panel and the exit-0 are filed
 * as **B-031**; this module does not address them.
 *
 * ## What this module is for, then
 *
 * **Durability.** A terminal frame is repainted constantly and keeps no history, and ink's ERROR
 * panel goes to stdout — so it is gone at the next repaint or once the scrollback rolls, and
 * `installStderrGuard` does not capture it. An operator debugging an intermittent guard has
 * nothing to read. This module leaves one record that outlives the frame.
 *
 * It buys persistence, not visibility. The user still loses the app.
 *
 * ## The three properties a record has, and why each is enforced here
 *
 * - **Safe.** The offending value is untrusted BY CONSTRUCTION — the guard fired because a caller
 *   passed something wrong. Interpolated verbatim, a hostile value injects control bytes into a
 *   terminal (a clear-screen sequence was measured) and forges a second `[theokit/tui]` record via
 *   an embedded newline. `notify.ts:40-42` states this obligation for the sibling writer.
 * - **Attributable.** The destination is an append-only log rotating at 10 MB x 10 generations, so
 *   a record without a timestamp cannot be placed in time afterwards. The component is an
 *   ARGUMENT, not a convention inside prose — a convention decays exactly when it acquires 20 more
 *   call sites (B-028).
 * - **Durable, and never silently lost.** See `reportGuardFailure` — a sink that fails is counted,
 *   never swallowed.
 *
 * Reporting is ADDITIVE. The throw is the contract 37 test files rest on, so the return type is
 * `never`: "and still throws" is structural rather than something 21 call sites must remember.
 *
 * It does NOT deduplicate: a guard firing every render is a repeating problem and one collapsed
 * line hides it.
 *
 * **What that does NOT buy is a count of fires.** Measured 2026-08-18 with a real `render()`: one
 * logical guard failure produces MORE THAN ONE record, because React re-invokes a component whose
 * render threw. v1 claimed the absence of deduplication let an operator count fires; it does not.
 *
 * The multiplier is NOT a fixed property of this module, and an earlier draft of this paragraph
 * said "2 records" as though it were. Review measured three components with identical signatures:
 * a throw inside an `if` produced 2, an unconditional throw produced 3, and under ink's public
 * `concurrent: true` root the count at `render()` return was 0. So it depends on the guarded
 * component's own shape and on the renderer mode — which is exactly why the count is not a
 * measurement of anything an operator should read. `src/status/guard-sink.integration.test.tsx` pins the number so an upgrade that
 * changes it is reported rather than silently contradicting this paragraph.
 *
 * @public
 */

/**
 * Anything that can take a record.
 *
 * `write` returns `boolean` because that is what a lost write means to `process.stderr` and to
 * this package's own `installStderrGuard`, which returns `false` and counts the loss
 * (`src/terminal/stderr-guard.ts:82`). Typing it `void` — as v1 did — throws that signal away, so
 * a dead sink made every guard diagnostic vanish: the failure this module exists to prevent,
 * reproduced one layer down.
 *
 * @public
 */
export interface GuardSink {
  write(data: string): boolean;
}

/**
 * Diagnostics this process failed to record.
 *
 * A module-level integer and a reader — not an event emitter, not an observer registry (parsimony
 * rung 5). Nobody has asked to subscribe.
 *
 * This comment claimed the design mirrors what `installStderrGuard` does with its own lost-write
 * count. It does NOT, and the difference is the whole of it: `stderr-guard.ts:88-96` REPORTS its
 * count automatically from inside its disposer, requiring nothing of the consumer, while this
 * counter is only surfaced if someone calls `lostGuardRecords()`. Counting happens; surfacing is
 * the consumer's to do, and the README says so rather than leaving the symbol to be discovered.
 *
 * Deliberately not auto-reported: this module owns no lifecycle. It has no teardown to hook, and
 * inventing one so it could print at exit would be a bigger surface than the problem
 * (parsimony rung 1). If a consumer wants the number reported, `installStderrGuard`'s disposer is
 * where their session already ends.
 */
let lostRecords = 0;

/**
 * How many guard records this process failed to write.
 *
 * Monotonic, and reading does NOT reset it: a counter that reset on read would make "how many
 * diagnostics did we lose this session" unanswerable by a second reader.
 *
 * @public
 */
export function lostGuardRecords(): number {
  return lostRecords;
}

/** ISO-8601 to the second. Milliseconds add noise a human tailing a log does not read. */
function stamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Neutralise anything in `text` that a terminal would interpret or that would end the record.
 *
 * `JSON.stringify` is the platform's escaper (parsimony rung 3): it turns control characters into
 * readable `\uXXXX` / `\n` escapes rather than dropping them, so the diagnostic content survives
 * and stays recoverable. The surrounding quotes it adds are stripped — the record is a log line,
 * not a JSON document.
 */
function sanitize(text: string): string {
  // `JSON.stringify` is the platform's escaper and does most of the work — but it escapes C0 ONLY.
  // ADR D5 says C0 AND C1, and the gap is not cosmetic: U+0085 (NEL), U+2028 and U+2029 are
  // Unicode LINE TERMINATORS, so a reader that splits on them — Python's `splitlines()` does —
  // still sees a second, well-formed, correctly-timestamped `[theokit/tui]` record. U+009B and
  // U+009D are the 8-bit CSI and OSC introducers. U+007F (DEL) is C0-adjacent and the suite's own
  // CONTROL_CHAR_RE already demands it.
  //
  // Found by review, measured: the first version closed v1's attack and left 33 code points raw.
  // "One physical line" was true only under the narrower of two definitions of "line".
  const quoted = JSON.stringify(text);
  return quoted
    .slice(1, -1)
    .replace(
      /[\u007F-\u009F\u2028\u2029]/g,
      (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
}

/**
 * Drop a leading `<component>: ` from the message, because the record already carries the
 * component as its own field.
 *
 * Every guard in this package writes its message as `"UsagePanel: contextWindow must be ..."` — a
 * convention that predates this module and that ADR D6 replaces with a field. Without this, a real
 * record read `[theokit/tui] <iso> UsagePanel: UsagePanel: contextWindow must be ...`.
 *
 * Found by looking at the output of an actual test run, not by a unit test: every unit test here
 * builds its own message, so none of them reproduced the convention the 21 real call sites follow.
 */
function withoutComponentPrefix(component: string, message: string): string {
  const prefix = `${component}: `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

/**
 * Report a boundary-guard failure, then throw it.
 *
 * @param component - the component whose guard fired, e.g. `"UsagePanel"`. Required, and required
 *   to be non-empty: an unattributed record is the generic message
 *   `.claude/rules/error-handling.md` § 5 bans.
 * @param error - the guard's own typed error. Its message is sanitised into the record.
 * @param sink - where the record goes. Defaults to `process.stderr`, resolved at call time so an
 *   installed `installStderrGuard` is honoured.
 * @returns never — it always throws `error`.
 * @public
 */
export function reportGuardFailure(
  component: string,
  error: Error,
  sink: GuardSink = process.stderr,
): never {
  if (!(error instanceof Error) || typeof error.message !== "string") {
    // Validated alongside `component`, and INSIDE the guarded region for the same reason: an
    // unvalidated `error` made `error.message` throw from OUTSIDE the try, producing no record, no
    // count, and replacing the guard's diagnostic with a TypeError about the reporter.
    throw new TypeError(
      `reportGuardFailure: error must be an Error with a message — got ${String(error)}`,
    );
  }
  if (typeof component !== "string" || component.trim() === "") {
    throw new TypeError(
      `reportGuardFailure: component must be a non-empty string naming the component whose guard fired — got ${String(component)}`,
    );
  }
  recordGuardFailure(component, error, sink);
  throw error;
}

/**
 * Write the durable record WITHOUT throwing.
 *
 * B-031 — extracted so `ComponentBoundary` can record a failure it has just contained. The boundary
 * catches an error that has already been thrown, so it cannot use `reportGuardFailure`, whose whole
 * contract is that it throws. Before this existed the boundary took no parameters and the error
 * vanished: a non-guard error produced a fallback line, a non-zero exit code, and nothing anywhere
 * saying what happened — the swallow `.claude/rules/error-handling.md` § 5 forbids, introduced by
 * the very component meant to make failures visible.
 *
 * A contained guard failure therefore produces TWO records: one when the guard fired, one when it
 * was contained. That is not duplication to be collapsed — they are different facts, and § 3.1's
 * "never deduplicate" applies for the same reason it does there: a repeating pair IS the signal.
 */
export function recordGuardFailure(
  component: string,
  error: Error,
  sink: GuardSink = process.stderr,
): void {
  const record = `[theokit/tui] ${stamp()} ${sanitize(component)}: ${sanitize(withoutComponentPrefix(component, error.message))}\n`;
  try {
    // `false` is not an error — it is how `process.stderr` and this package's own
    // `installStderrGuard` (`src/terminal/stderr-guard.ts:82`) report a write that was lost. Typing
    // it away is what made a dead sink silent.
    if (!sink.write(record)) {
      lostRecords += 1;
    }
  } catch {
    lostRecords += 1;
    // NOT the swallow `.claude/rules/error-handling.md` § 5 forbids: the loss is counted rather
    // than discarded, and re-throwing here would replace a diagnosable guard error with an EPIPE
    // nobody can trace back to the real cause. The caller still receives the guard's own error on
    // the line below.
  }
}
