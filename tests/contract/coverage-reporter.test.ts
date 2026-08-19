/**
 * B-048 — the coverage gate can only verify a threshold it can READ.
 *
 * `coverage_gate.py` looks for four fixed paths, the first being
 * `coverage/coverage-summary.json`. `vitest.config.ts` declared a coverage block with a provider,
 * an include and thresholds — and no `reporter` — so the default set shipped: `text`, `html`,
 * `clover`, `json`. Those are real reports under names the gate does not know, so it emitted
 * "the threshold was NOT verified" on every validation run and nothing blocked.
 *
 * ## What this test is NOT for
 *
 * It does not protect the coverage NUMBER. `vitest.config.ts` declares thresholds of 90 on all
 * four metrics and CI runs `pnpm test:coverage`, which fails the job when one is missed — so the
 * number was enforced all along, at a stricter floor than the Squad gate's 80. Measured
 * 2026-08-19: statements 98.51%, branches 95.23%, functions 93.42%, lines 98.51%.
 *
 * It protects the CONTRACT WITH THE GATE, which is what actually regressed, and it reads the
 * config rather than the filesystem so it cannot depend on whether a `--coverage` run happened
 * first (a flaky test is a bug — `rules/testing.md` § 3).
 */
import { describe, expect, it } from "vitest";

import config from "../../vitest.config.js";

const reporters = (): readonly string[] => {
  const coverage = config.test?.coverage;
  if (coverage === undefined || !("reporter" in coverage)) return [];
  const reporter = coverage.reporter;
  return Array.isArray(reporter) ? (reporter as string[]) : [];
};

describe("B-048 — the coverage report is readable by the gate", () => {
  it("test_the_coverage_reporter_is_one_the_squad_gate_can_read", () => {
    expect(
      reporters(),
      "coverage_gate.py's first lookup is coverage/coverage-summary.json; without a reporter " +
        "that writes it, the gate reports WARN and verifies nothing",
    ).toContain("json-summary");
  });

  it("test_the_default_reporters_are_not_lost", () => {
    // `reporter` REPLACES vitest's default set rather than extending it. The tempting one-line
    // fix — `reporter: ["text", "json-summary"]` — silently deletes the HTML report people open
    // locally and the clover.xml other tools consume, and nothing else in this repo would fail.
    expect(reporters()).toContain("html");
    expect(reporters()).toContain("clover");
  });
});
