import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./diff.js";

/**
 * B-085 — `parse-diff` receives the untrusted patch, and until this file nothing about it had been
 * measured.
 *
 * ## What this is NOT
 *
 * It is not a performance regression suite. Wall-clock in a test is a flaky oracle, and a tight
 * bound here would fail on a loaded CI runner for reasons that have nothing to do with the parser.
 *
 * The bounds below are deliberately an ORDER OF MAGNITUDE above measured — they detect
 * CATASTROPHE (quadratic, exponential, a hang) and nothing finer. A regression from 150ms to 400ms
 * passes here on purpose; a regression from 150ms to "never returns" does not, and that is the
 * failure class the item is about. `.claude/rules/cycle-discover.md` calls a hang neither pass nor
 * fail, which is the same practical outcome as no gate at all.
 *
 * ## Measured 2026-08-20, `parse-diff@0.12.0`, this machine
 *
 * | input                | bytes | parse   | heap   | result                  |
 * |----------------------|-------|---------|--------|-------------------------|
 * | 100k `@@` headers    | 1.6MB | 80.9ms  | 29.0MB | files=1, lines=50000    |
 * | 50k file headers     | 2.7MB | 178.3ms |  0.5MB | files=50000             |
 * | 500k added lines     | 1.5MB | 148.4ms | 67.4MB | files=1, lines=500001   |
 * | one 5MB line         | 5.0MB |   0.2ms |  0.0MB | files=1                 |
 * | huge hunk numbers    |   79B |   0.4ms |      — | files=1                 |
 *
 * Every shape is LINEAR in input size. No ReDoS, no blowup, no throw. The ~45x heap amplification
 * on the 500k-line case is one object per line, not a defect.
 *
 * ## What was checked in the dependency itself
 *
 * `parse.js:239` builds a `RegExp` from a string at runtime — the shape a ReDoS lives in. It is in
 * `leftTrimChars`, and `grep -c 'leftTrimChars('` returns 1: the definition. The function has no
 * call site, so the construct is unreachable. Recorded because "there is a dynamic RegExp in the
 * parser" is true and alarming and, here, means nothing.
 *
 * ## Maintenance, measured rather than assumed from a silent `npm audit`
 *
 * `0.12.0` published 2026-04-17 after a three-year gap (`0.11.1` was 2023-03-20). MIT, ZERO runtime
 * dependencies, 34 releases. No published advisory — which establishes only that none is published.
 * The zero-dependency fact is the load-bearing one: there is no transitive surface to audit.
 */
describe("pathological patches (B-085)", () => {
  // An order of magnitude above the worst measured (178ms). Catches a hang, not a slowdown.
  const CATASTROPHE_MS = 5000;

  const within = <T>(run: () => T): { value: T; ms: number } => {
    const started = performance.now();
    const value = run();
    return { value, ms: performance.now() - started };
  };

  it("a_hunk_header_with_absurd_line_counts_does_not_allocate_by_those_counts", () => {
    // The naive parser bug: trusting `@@ -1,N +1,N @@` and sizing something by N. A parser that
    // did would die here rather than return.
    const patch =
      "diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1,999999999999 +1,999999999999 @@\n-x\n+y\n";

    const { value, ms } = within(() => parseUnifiedDiff(patch));

    expect(ms).toBeLessThan(CATASTROPHE_MS);
    expect(value).toHaveLength(1);
    // The counts are a CLAIM by the patch; what exists is what gets parsed. I expected two lines
    // and measured THREE — the trailing newline yields a synthesized empty context line. Pinned as
    // measured rather than as assumed, because the assumption was the interesting part: a parser
    // that sized anything by `999999999999` would never have reached this assertion.
    expect(value[0]?.lines).toHaveLength(3);
    expect(value[0]?.lines.map((l) => l.kind)).toEqual([
      "del",
      "add",
      "context",
    ]);
  });

  it("one_hundred_thousand_hunk_headers_parse_in_linear_time", () => {
    const patch =
      "diff --git a/a b/a\n--- a/a\n+++ b/a\n" +
      "@@ -1,1 +1,1 @@\n".repeat(100_000);

    const { value, ms } = within(() => parseUnifiedDiff(patch));

    expect(ms).toBeLessThan(CATASTROPHE_MS);
    expect(value).toHaveLength(1);
  });

  it("fifty_thousand_file_headers_parse_in_linear_time", () => {
    const patch = Array.from(
      { length: 50_000 },
      (_, i) =>
        `diff --git a/f${String(i)} b/f${String(i)}\n--- a/f${String(i)}\n+++ b/f${String(i)}\n`,
    ).join("");

    const { value, ms } = within(() => parseUnifiedDiff(patch));

    expect(ms).toBeLessThan(CATASTROPHE_MS);
    expect(value).toHaveLength(50_000);
  });

  it("a_single_five_megabyte_line_is_not_scanned_quadratically", () => {
    // The classic quadratic shape: a per-character scan that restarts. 5MB in one line is where
    // that would show, and it is also the cheapest case measured (0.2ms) — which is the point.
    const patch =
      "diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1,1 +1,1 @@\n+" +
      "A".repeat(5_000_000) +
      "\n";

    const { value, ms } = within(() => parseUnifiedDiff(patch));

    expect(ms).toBeLessThan(CATASTROPHE_MS);
    expect(value[0]?.lines[0]?.text).toHaveLength(5_000_000);
  });

  it("input_with_no_diff_markers_is_REFUSED_with_a_typed_error", () => {
    // A NEGATIVE case, not an edge case (`rules/testing.md` § 4.1), and it asserts the SPECIFIC
    // typed error rather than merely that something threw.
    //
    // I wrote this expecting zero files and measured a `TypeError` instead — the consumer already
    // fails fast here. Recorded as the contract because it is the better behaviour: 200KB of noise
    // is not a patch, and returning an empty array would let a caller render "no changes" for
    // input that was never a diff.
    expect(() => parseUnifiedDiff("A".repeat(200_000))).toThrow(TypeError);
    expect(() => parseUnifiedDiff("A".repeat(200_000))).toThrow(
      /did not parse as a unified diff/,
    );
  });

  it("an_empty_patch_returns_nothing_instead_of_throwing_and_that_asymmetry_is_deliberate", () => {
    // Measured alongside the case above, and the pair is the point: `""` returns `[]` while noise
    // throws. Not an inconsistency — `diff.ts:49` short-circuits on a blank patch, because "there
    // is nothing to show" and "this is not a patch" are different facts and a caller acts on them
    // differently. Pinned so a future simplification cannot quietly collapse them.
    expect(parseUnifiedDiff("")).toEqual([]);
    expect(parseUnifiedDiff("   \n  \n")).toEqual([]);
  });

  it("a_truncated_patch_ending_mid_hunk_does_not_throw", () => {
    // Truncation is what a pipe that closed early produces, so it is ordinary rather than exotic.
    const { value } = within(() =>
      parseUnifiedDiff(
        "diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1,1 +1,1 @@\n-x",
      ),
    );

    expect(value).toHaveLength(1);
    expect(value[0]?.lines).toHaveLength(1);
  });
});
