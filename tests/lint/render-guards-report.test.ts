/**
 * B-028 — a render-path guard that throws without leaving a record.
 *
 * B-025 shipped `reportGuardFailure` and wired exactly ONE consumer, deliberately: a mechanism
 * should have one proven consumer before it has 24. The consequence measured a session later is
 * that 20 component files still threw a typed error from a render path with no record anywhere,
 * and nothing could see them — which is why this gate exists and not only the sweep.
 *
 * `rules/error-handling.md` § 3.1 is the contract: KEEP the throw (it is the only mechanism a test
 * can observe, and 37 `toThrow` assertions rest on it) and leave one DURABLE record before it. A
 * terminal frame is repainted constantly and keeps no history, so the frame is not the record.
 *
 * WHAT THIS GATE CANNOT SEE, stated rather than implied: it matches on the sink being IMPORTED, not
 * on every throw being routed through it. A file could import the sink and still leave one throw
 * bare. The per-domain tests cover routing; a per-throw (AST) check is registered as a followup.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

/** A typed error raised from a component body. */
const THROWS_TYPED = /throw new (?:TypeError|RangeError)\(/;
const IMPORTS_SINK = /\b(?:report|record)GuardFailure\b/;

/**
 * Tracked `.tsx` under `src/`, excluding tests.
 *
 * `git ls-files` rather than a filesystem walk, for the same reason `lint` reads the index: an
 * untracked scratch component must not be able to turn a gate red (B-051).
 */
function trackedComponents(): string[] {
  const out = execFileSync("git", ["ls-files", "src"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter((p) => p.endsWith(".tsx") && !p.includes(".test."));
}

export function silentGuards(): string[] {
  return trackedComponents().filter((rel) => {
    const source = readFileSync(
      new URL(rel, new URL("../../", import.meta.url)),
      "utf8",
    );
    return THROWS_TYPED.test(source) && !IMPORTS_SINK.test(source);
  });
}

describe("every render-path guard leaves a record", () => {
  it("test_no_component_throws_without_reporting", () => {
    const offenders = silentGuards();

    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `These components throw a typed error from a render path and never reach the guard sink,\n` +
            `so the failure leaves no durable record (rules/error-handling.md § 3.1):\n\n` +
            offenders.map((f) => `  ${f}`).join("\n") +
            `\n\nEach direct throw becomes a call: reportGuardFailure returns 'never' and rethrows the\n` +
            `SAME error object, so the throw contract is unchanged.\n`,
    ).toEqual([]);
  });

  it("test_the_gate_reads_the_index_not_the_filesystem", () => {
    // Pins the git-ls-files choice. Without it the gate would be red for anyone with an untracked
    // component in their tree, which is how a gate gets removed.
    const files = trackedComponents();

    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.startsWith("src/"))).toBe(true);
    expect(files.some((f) => f.includes(".test."))).toBe(false);
  });
});
