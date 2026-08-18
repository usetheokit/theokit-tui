import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { installStderrGuard } from "../terminal/stderr-guard.js";

import type { GuardSink } from "./guard-sink.js";
import { lostGuardRecords, reportGuardFailure } from "./guard-sink.js";

// B-025 — the sink that leaves a DURABLE record when a boundary guard fires.
//
// This header stated the opposite of the truth in v1: it claimed the package had no error boundary
// anywhere in play, that the renderer discarded the throw, and that the result was a blank region
// with nothing recorded. Measured against a real `render()` with ink@7.1.0: ink ships an
// `ErrorBoundary` and it fires, printing an `ERROR` panel with a stack to stdout, unmounting the
// whole app, and exiting 0 (B-031). The false phrasing is deliberately NOT quoted here, so a grep
// for it stays a reliable guard against it coming back.
//
// The empty frame is what `renderFrame` / `ink-testing-library` produces — a property of the TEST
// HARNESS. `src/agent/agent-timeline.tsx:189` says exactly that, about `renderFrame`, and v1
// generalised it to production without measuring production.
//
// What production genuinely lacks is DURABILITY: the panel is transient stdout, erased by the next
// repaint or lost to scrollback, and `installStderrGuard` does not capture it. That is what this
// module provides — persistence, not visibility.
//
// The property under test is a side effect nobody can see in a frame, which is why it is asserted
// before it exists. A test written afterwards would assert whatever the implementation happened to
// write.

/** A raw ESC. Written as a code point so this file carries no control byte of its own. */
const ESC_CHAR = String.fromCharCode(27);
const NEWLINE = String.fromCharCode(10);
/** Any C0 control character. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function fakeSink() {
  const lines: string[] = [];
  return {
    write: (s: string): boolean => {
      lines.push(s);
      return true;
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
    const error = new TypeError(
      "UsagePanel: contextWindow must be > 0 — got 0",
    );

    // The throw is the contract 37 test files rest on. Reporting is ADDITIVE: it never replaces
    // the throw, and this assertion is what keeps a future "just log it" refactor honest.
    expect(() => {
      reportGuardFailure("UsagePanel", error, sink);
    }).toThrow(error);

    expect(sink.lines).toHaveLength(1);
  });

  it("the_line_names_the_component_and_the_offending_value", () => {
    const sink = fakeSink();

    expect(() => {
      reportGuardFailure(
        "WindowedList",
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
      reportGuardFailure(
        "UsagePanel",
        new TypeError("CostMeter: costUsd must be >= 0 — got -1"),
        sink,
      );
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
      reportGuardFailure(
        "UsagePanel",
        new TypeError("Toast: variant unknown — got 'purple'"),
        sink,
      );
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
        reportGuardFailure(
          "UsagePanel",
          new TypeError("Notice: variant unknown — got 'x'"),
          sink,
        );
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
      write: (): boolean => {
        throw new Error("EPIPE: broken pipe");
      },
    };
    const original = new TypeError(
      "ContextWindowBar: usedTokens must be >= 0 — got -5",
    );

    // The failure scenario the plan names: a closed pipe must not turn a diagnosable guard failure
    // into an EPIPE nobody can trace back to the real cause. Reporting is best-effort; the guard's
    // own error is not.
    expect(() => {
      reportGuardFailure("ContextWindowBar", original, broken);
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
            "UsagePanel",
            new TypeError("UsagePanel: contextWindow must be > 0 — got 0"),
            // No sink argument: this is the DEFAULT path, which is the one under test.
          );
        }).toThrow(TypeError);
      } finally {
        dispose();
      }

      expect(readFileSync(logPath, "utf8")).toContain(
        "UsagePanel: contextWindow",
      );
      // Nothing reached the stream the frame is painted on.
      expect(framed.join("")).not.toContain("UsagePanel: contextWindow");

      // And after teardown the line goes to the terminal again — the guard is scoped to the
      // session, not a permanent redirect.
      expect(() => {
        reportGuardFailure(
          "UsagePanel",
          new TypeError("CostMeter: costUsd must be >= 0 — got -1"),
        );
      }).toThrow(TypeError);
      expect(framed.join("")).toContain("CostMeter: costUsd");
    } finally {
      process.stderr.write = realWrite;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// B-025 v2 T1.1 — the record is SAFE and ATTRIBUTABLE (plan ADRs D5, D6).
//
// The offending value inside a guard's message is untrusted BY CONSTRUCTION: the guard fired
// precisely because a caller passed something wrong. `/review` measured a hostile prop producing
// ONE write and TWO physical lines, the second a well-formed forged `[theokit/tui]` record, with a
// raw ESC reaching the stream — which, with no `installStderrGuard` installed, clears the user's
// screen. `src/status/notify.ts:40-42` documents this exact hazard for the sibling writer, and v1
// cited that file as precedent without applying its warning.
//
// These are asserted BEFORE they exist because v1 proved the alternative: its "exactly one line"
// claim was defeated by an input the author had not thought of, and nothing caught it.

/** A string carrying the two things a record must survive: a control byte and a line break. */
const HOSTILE_VALUE =
  "12" +
  NEWLINE +
  "[theokit/tui] CostMeter: costUsd OK" +
  ESC_CHAR +
  "[2J" +
  ESC_CHAR +
  "[H";

/**
 * Every code point that terminates a LINE for some reader, plus the 8-bit escape introducers.
 *
 * `HOSTILE_VALUE` above carries only ESC and LF — both C0, both already handled by
 * `JSON.stringify`. So the C1/DEL/separator escaping added later was pinned by NOTHING: reverting
 * it left 130 tests green. Found by review (F-tests-13 / F-dom-5), and it is the defect class the
 * commit that introduced it was written to close.
 *
 * U+0085, U+2028 and U+2029 matter because a reader that splits Unicode-aware — Python's
 * `splitlines()` does — sees a second well-formed `[theokit/tui]` record. U+009B and U+009D are
 * the 8-bit CSI and OSC introducers.
 */
const LINE_BREAKERS: readonly string[] = [
  String.fromCharCode(0x0b), // VT
  String.fromCharCode(0x0c), // FF
  String.fromCharCode(0x85), // NEL
  String.fromCharCode(0x7f), // DEL
  String.fromCharCode(0x9b), // CSI, 8-bit
  String.fromCharCode(0x9d), // OSC, 8-bit
  "\u2028", // LINE SEPARATOR
  "\u2029", // PARAGRAPH SEPARATOR
];

describe("the record is safe and attributable (B-025 v2 T1.1)", () => {
  it("test_record_escapes_control_characters", () => {
    const sink = fakeSink();
    expect(() => {
      reportGuardFailure(
        "UsagePanel",
        new TypeError(
          `UsagePanel: usage.cost must be >= 0 — got ${HOSTILE_VALUE}`,
        ),
        sink,
      );
    }).toThrow(TypeError);

    const line = onlyLine(sink);
    // Every C0 control byte except the single trailing terminator must be gone.
    expect(CONTROL_CHAR_RE.test(line.slice(0, -1))).toBe(false);
  });

  it("test_record_is_one_physical_line", () => {
    const sink = fakeSink();
    expect(() => {
      reportGuardFailure(
        "UsagePanel",
        new TypeError(
          `UsagePanel: usage.cost must be >= 0 — got ${HOSTILE_VALUE}`,
        ),
        sink,
      );
    }).toThrow(TypeError);

    // Content plus the trailing terminator: splitting on the newline yields exactly two parts.
    expect(onlyLine(sink).split(NEWLINE).length).toBe(2);
  });

  it("test_hostile_message_cannot_forge_a_second_record", () => {
    const sink = fakeSink();
    expect(() => {
      reportGuardFailure(
        "UsagePanel",
        new TypeError(
          `UsagePanel: usage.cost must be >= 0 — got ${HOSTILE_VALUE}`,
        ),
        sink,
      );
    }).toThrow(TypeError);

    // A RECORD is delimited by a newline, so forgery means producing a second LINE that starts
    // with the prefix — which is what the measured attack did before the escaping existed.
    //
    // This assertion first counted the prefix ANYWHERE in the line and expected 1. It failed at 2,
    // and the failure was the test's fault, not the code's: the hostile value literally contains
    // the text `[theokit/tui]`, and with the newline escaped that copy sits MID-record where no
    // reader parses it as a record start. Corrected to the property that actually matters rather
    // than to the number that made it green.
    const line = onlyLine(sink);
    const starts = line
      .split(NEWLINE)
      .filter((part) => part.startsWith("[theokit/tui]"));
    expect(starts.length).toBe(1);
    // And the copy carried by the attacker is still THERE, escaped and readable — the diagnostic
    // content was preserved, not silently dropped.
    expect(line).toContain("[theokit/tui] CostMeter: costUsd OK");
  });

  it("test_the_component_field_does_not_duplicate_the_message_prefix", () => {
    const sink = fakeSink();
    // Every guard in this package writes `"UsagePanel: <what>"`, a convention older than this
    // module. Without stripping it the record read `UsagePanel: UsagePanel: ...`. Found by reading
    // the output of a real run — every unit test here authors its own message, so none of them
    // reproduced the convention the 21 real call sites follow. That gap is the point.
    expect(() => {
      reportGuardFailure(
        "UsagePanel",
        new TypeError(
          "UsagePanel: contextWindow must be a finite number > 0 when given — got 0",
        ),
        sink,
      );
    }).toThrow(TypeError);

    const line = onlyLine(sink);
    expect(line).toContain("UsagePanel: contextWindow must be");
    expect(line).not.toContain("UsagePanel: UsagePanel:");
  });

  it("test_record_carries_an_iso_timestamp", () => {
    const sink = fakeSink();
    expect(() => {
      reportGuardFailure(
        "CostMeter",
        new TypeError("CostMeter: costUsd must be >= 0 — got -1"),
        sink,
      );
    }).toThrow(TypeError);

    // The blessed destination is an append-only log rotating at 10 MB x 10 generations, so "when"
    // is unrecoverable unless the record carries it (`/review` F-dom-3).
    expect(onlyLine(sink)).toMatch(ISO_RE);
  });

  it("test_the_component_is_a_field_not_a_convention", () => {
    const sink = fakeSink();
    // `reportGuardFailure(new Error("bad"))` type-checked in v1 and emitted the generic message
    // `.claude/rules/error-handling.md` § 5 bans. The component is now an argument.
    //
    // Asserted by inspecting the caught value rather than with `toThrow(/component/i)`: that form
    // PASSED against the old two-argument signature, because the call threw the bare string `""`
    // and the matcher was satisfied by accident. A test that passes for the wrong reason is the
    // defect `/review` found across v1 — so this one pins the type, the message AND the absence of
    // a record.
    let caught: unknown;
    try {
      reportGuardFailure("", new TypeError("bad"), sink);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TypeError);
    expect((caught as Error).message).toMatch(/component/i);
    expect(sink.lines).toHaveLength(0);
  });
});

// B-025 v2 T2.1 — a lost record is COUNTED, never swallowed (plan ADR D4).
//
// This is the slice's own defect reproduced one layer down. `GuardSink.write` was typed `void` in
// v1, so the `false` that `src/terminal/stderr-guard.ts:82` returns to signal a lost write was
// discarded, and the surrounding empty catch discarded a throw. A dead sink therefore made every
// guard diagnostic vanish — a mechanism built to end silent failure, failing silently.
//
// `stderr-guard.ts:11-19` already rejected this design in prose and implemented the third option:
// count the loss, report it when the terminal is free. These tests hold this module to the same
// standard its own dependency set years ago.
describe("a lost record is counted (B-025 v2 T2.1)", () => {
  it("test_a_healthy_sink_records_no_loss", () => {
    const sink = fakeSink();
    const before = lostGuardRecords();

    expect(() => {
      reportGuardFailure(
        "CostMeter",
        new TypeError("CostMeter: costUsd must be >= 0 — got -1"),
        sink,
      );
    }).toThrow(TypeError);

    expect(lostGuardRecords()).toBe(before);
  });

  it("test_a_false_return_counts_a_lost_record", () => {
    // `false` is not an error — it is `installStderrGuard`'s documented way of saying the write
    // was lost (its log path was unwritable). A `void` return type threw that away.
    const dead: GuardSink = { write: (): boolean => false };
    const before = lostGuardRecords();

    expect(() => {
      reportGuardFailure(
        "UsagePanel",
        new TypeError("UsagePanel: usage.cost must be >= 0 — got -1"),
        dead,
      );
    }).toThrow(TypeError);

    expect(lostGuardRecords()).toBe(before + 1);
  });

  it("test_a_throwing_sink_counts_a_lost_record", () => {
    const broken: GuardSink = {
      write: (): boolean => {
        throw new Error("EPIPE: broken pipe");
      },
    };
    const before = lostGuardRecords();

    expect(() => {
      reportGuardFailure(
        "Notice",
        new TypeError("Notice: variant unknown — got 'x'"),
        broken,
      );
    }).toThrow(TypeError);

    expect(lostGuardRecords()).toBe(before + 1);
  });

  it("test_a_lost_record_does_not_replace_the_original_error", () => {
    const dead: GuardSink = { write: (): boolean => false };
    const original = new TypeError(
      "ContextWindowBar: usedTokens must be >= 0 — got -5",
    );

    // Counting the loss must not turn a diagnosable guard failure into something else. The caller
    // still receives exactly the error the guard raised.
    let caught: unknown;
    try {
      reportGuardFailure("ContextWindowBar", original, dead);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(original);
  });

  it("test_the_counter_is_monotonic_and_reading_does_not_reset_it", () => {
    const dead: GuardSink = { write: (): boolean => false };
    expect(() => {
      reportGuardFailure(
        "Toast",
        new TypeError("Toast: variant unknown — got 'purple'"),
        dead,
      );
    }).toThrow(TypeError);

    // Two consecutive reads with no fire between them must agree. A counter that resets on read
    // makes "how many diagnostics did we lose this session" unanswerable by a second reader.
    const first = lostGuardRecords();
    const second = lostGuardRecords();
    expect(first).toBe(second);
  });
});

// B-025 — the escaping the review found unpinned (F-tests-13, F-dom-5).
//
// These assert the PROPERTY, not the character list: for every code point some reader treats as a
// line break, one fired guard still yields exactly one record. Asserting the class rather than the
// implementation is what makes the test survive a change of technique.
describe("the record survives every line-breaking code point (B-025)", () => {
  for (const breaker of LINE_BREAKERS) {
    const code = `U+${breaker.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

    it(`test_no_second_record_can_be_forged_with_${code}`, () => {
      const sink = fakeSink();
      const hostile = `12${breaker}[theokit/tui] CostMeter: costUsd OK`;

      expect(() => {
        reportGuardFailure(
          "UsagePanel",
          new TypeError(`UsagePanel: usage.cost must be >= 0 — got ${hostile}`),
          sink,
        );
      }).toThrow(TypeError);

      const line = onlyLine(sink);
      // The raw byte must not reach the sink at all...
      expect(line.includes(breaker)).toBe(false);
      // ...and no reader, however it splits, finds a second record start.
      // Built from code points rather than written as a literal: the class deliberately contains
      // control characters, and a source file carrying them raw is what `no-control-regex` exists
      // to stop — the same hazard the code under test is about.
      const anyLineBreak = new RegExp(
        `[${LINE_BREAKERS.concat(NEWLINE)
          .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
          .join("")}]`,
      );
      const starts = line
        .split(anyLineBreak)
        .filter((part) => part.startsWith("[theokit/tui]"));
      expect(starts.length).toBe(1);
    });
  }
});

// B-025 — the `error` validation the review found unpinned (F-tests-13).
//
// `reportGuardFailure` reads `error.message`. Before this was validated, a malformed `error` threw
// from OUTSIDE the guarded region: no record, no loss counted, and the guard's own diagnostic
// replaced by a TypeError about the reporter.
describe("a malformed error argument is refused (B-025)", () => {
  const malformed: readonly [string, unknown][] = [
    ["undefined", undefined],
    ["a bare string", "not an error"],
    ["a plain object", { message: "looks like one" }],
    ["null", null],
  ];

  for (const [label, value] of malformed) {
    it(`test_${label.replace(/\s+/g, "_")}_is_refused_by_the_reporter`, () => {
      const sink = fakeSink();
      let caught: unknown;
      try {
        reportGuardFailure("UsagePanel", value as Error, sink);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(TypeError);
      expect((caught as Error).message).toContain(
        "reportGuardFailure: error must be an Error",
      );
      // And nothing was written — a malformed call must not emit a record naming a value it could
      // not read.
      expect(sink.lines).toHaveLength(0);
    });
  }
});
