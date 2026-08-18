import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { installStderrGuard } from "../terminal/stderr-guard.js";

import type { GuardSink } from "./guard-sink.js";
import { reportGuardFailure } from "./guard-sink.js";

// B-025 T1.1 — the sink that makes a fired boundary guard observable.
//
// Measured before this existed: 24 public components throw from a boundary guard, this package
// ships no error boundary, and Ink's renderer catches nothing — so a guard that fires produces an
// EMPTY FRAME. No error, no log, nothing on screen. `src/agent/agent-timeline.tsx:189` records the
// same thing in the package's own words: `renderFrame` of an invalid event RESOLVES.
//
// The property under test is a side effect nobody can see in a frame, which is exactly why it is
// asserted here before it exists. A test written after the implementation would assert whatever
// the implementation happened to write.

function fakeSink() {
  const lines: string[] = [];
  return {
    write: (s: string): void => {
      lines.push(s);
    },
    lines,
  };
}

/**
 * The one line the sink received.
 *
 * A helper rather than `sink.lines[0]!` because `exactOptionalPropertyTypes` is on and the
 * non-null assertion would hide the very thing worth failing on: a test that asserts about a line
 * that was never written should fail LOUDLY, naming what it expected, not read `undefined` and
 * compare it to a string.
 */
function onlyLine(sink: { lines: readonly string[] }): string {
  if (sink.lines.length !== 1) {
    throw new Error(
      `expected exactly one line on the sink, got ${String(sink.lines.length)}`,
    );
  }
  return sink.lines[0] as string;
}

describe("reportGuardFailure (B-025 T1.1)", () => {
  it("a_reported_guard_failure_reaches_the_sink_and_still_throws", () => {
    const sink = fakeSink();
    const error = new TypeError("UsagePanel: contextWindow must be > 0 — got 0");

    // The throw is the contract 37 test files rest on. Reporting is ADDITIVE: it never replaces
    // the throw, and this assertion is what keeps a future "just log it" refactor honest.
    expect(() => {
      reportGuardFailure(error, sink);
    }).toThrow(error);

    expect(sink.lines).toHaveLength(1);
  });

  it("the_line_names_the_component_and_the_offending_value", () => {
    const sink = fakeSink();

    expect(() => {
      reportGuardFailure(
        new TypeError("WindowedList: selected must be an integer — got NaN"),
        sink,
      );
    }).toThrow(TypeError);

    // `.claude/rules/error-handling.md` § 5 bans the generic message. A line that says only
    // "invalid input" tells an operator nothing they can act on: WHICH component, and WHICH value.
    const line = onlyLine(sink);
    expect(line).toContain("WindowedList");
    expect(line).toContain("NaN");
  });

  it("the_line_says_which_package_wrote_it_and_ends_in_one_newline", () => {
    const sink = fakeSink();

    expect(() => {
      reportGuardFailure(new TypeError("CostMeter: costUsd must be >= 0 — got -1"), sink);
    }).toThrow(TypeError);

    const line = onlyLine(sink);
    // A log a consumer reads carries diagnostics from everything in the process. `installStderrGuard`
    // prefixes its own teardown report for the same reason; this follows that precedent.
    expect(line).toMatch(/^\[theokit\/tui]/);
    // Exactly one line, terminated. Two writes for one failure would interleave with whatever else
    // shares the stream.
    expect(line.endsWith("\n")).toBe(true);
    expect(line.trimEnd()).not.toContain("\n");
  });

  it("the_same_guard_firing_twice_writes_twice", () => {
    const sink = fakeSink();
    const fire = (): void => {
      reportGuardFailure(new TypeError("Toast: variant unknown — got 'purple'"), sink);
    };

    expect(fire).toThrow(TypeError);
    expect(fire).toThrow(TypeError);

    // Deliberately NOT deduplicated. A guard firing on every render is a repeating problem, and
    // collapsing it to one line would hide exactly the signal that says so.
    expect(sink.lines).toHaveLength(2);
  });

  it("an_injected_sink_receives_the_line_and_the_real_stderr_does_not", () => {
    const sink = fakeSink();
    const realWrite = process.stderr.write;
    const stderrWrites: string[] = [];
    process.stderr.write = ((chunk: unknown): boolean => {
      stderrWrites.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      expect(() => {
        reportGuardFailure(new TypeError("Notice: variant unknown — got 'x'"), sink);
      }).toThrow(TypeError);
    } finally {
      process.stderr.write = realWrite;
    }

    expect(sink.lines).toHaveLength(1);
    // Injectability is not a testing convenience — it is what keeps this suite from writing 24
    // diagnostics into the operator's terminal on every run. `notify(out = process.stdout)` set
    // the precedent in this same domain.
    expect(stderrWrites).toHaveLength(0);
  });

  it("a_sink_that_throws_does_not_replace_the_original_error", () => {
    const broken: GuardSink = {
      write: (): void => {
        throw new Error("EPIPE: broken pipe");
      },
    };
    const original = new TypeError("ContextWindowBar: usedTokens must be >= 0 — got -5");

    // The failure scenario the plan names: a closed pipe must not turn a diagnosable guard failure
    // into an EPIPE nobody can trace back to the real cause. Reporting is best-effort; the guard's
    // own error is not.
    expect(() => {
      reportGuardFailure(original, broken);
    }).toThrow(original);
  });
});

// B-025 T1.3 — the interaction with `installStderrGuard`, MEASURED.
//
// The plan flagged this as a real risk and refused to guess: a TUI owns the screen, so a fix that
// makes guards visible by writing into the middle of a frame has traded one silent failure for a
// loud wrong one. `src/terminal/stderr-guard.ts` exists for exactly that hazard.
//
// The measurement, run here rather than reasoned about:
//
//   `installStderrGuard` REPLACES `process.stderr.write` with one that appends to a log file. The
//   sink resolves its default through `process.stderr` at CALL time, not at module load, so a
//   guard line written while the guard is installed lands in the log and NOT in the frame. The
//   disposer restores the original stream, and lines written after it go to the terminal again.
//
// Which settles the plan's Q3 and leaves the default as `process.stderr`: with the guard installed
// the frame is safe, and without it the line reaches the terminal — the accepted cost, and the
// right side of the trade, because a corrupted frame is repainted and a silent failure is not.
describe("reportGuardFailure under installStderrGuard (B-025 T1.3)", () => {
  it("a_guard_line_lands_in_the_log_file_and_not_in_the_frame", () => {
    const dir = mkdtempSync(join(tmpdir(), "guard-sink-"));
    const logPath = join(dir, "session.log");
    const framed: string[] = [];

    // Stand in for the terminal: whatever reaches the REAL stream would have hit the frame.
    const realWrite = process.stderr.write;
    process.stderr.write = ((chunk: unknown): boolean => {
      framed.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const dispose = installStderrGuard(logPath, { label: "guard-sink-test" });
      try {
        expect(() => {
          reportGuardFailure(
            new TypeError("UsagePanel: contextWindow must be > 0 — got 0"),
            // No sink argument: this is the DEFAULT path, which is the one under test.
          );
        }).toThrow(TypeError);
      } finally {
        dispose();
      }

      expect(readFileSync(logPath, "utf8")).toContain("UsagePanel: contextWindow");
      // Nothing reached the stream the frame is painted on.
      expect(framed.join("")).not.toContain("UsagePanel: contextWindow");

      // And after teardown the line goes to the terminal again — the guard is scoped to the
      // session, not a permanent redirect.
      expect(() => {
        reportGuardFailure(new TypeError("CostMeter: costUsd must be >= 0 — got -1"));
      }).toThrow(TypeError);
      expect(framed.join("")).toContain("CostMeter: costUsd");
    } finally {
      process.stderr.write = realWrite;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
