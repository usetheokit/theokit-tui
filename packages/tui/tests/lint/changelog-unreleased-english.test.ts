/**
 * B-027 — the language rule for new CHANGELOG entries stops being a comment.
 *
 * `no-ptbr.test.ts` exempts `CHANGELOG.md`, and that exemption is correct: entries for a RELEASED
 * version are immutable under Unbreakable Rule 6, so a gate that forced a translation would rewrite
 * the record of what shipped. What had no mechanism at all was the other half — that NEW entries be
 * English — and it was written only inside the comment granting the exemption that disables its
 * enforcement.
 *
 * Measured 2026-08-19: the entries for 0.54.0, 0.55.0, 0.56.0, 0.57.0, 0.58.0, 0.59.0 and 0.60.0
 * are Portuguese. Seven consecutive releases, written by an author who had read the rule. The two
 * entries after them are English because their author happened to write English, not because
 * anything checked — the drift stopped by accident and could resume the same way.
 *
 * This gate reads ONLY the `[Unreleased]` section, which is the part that is still mutable.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type Offender, scanText } from "./no-ptbr.test.js";

// The CHANGELOG is a REPOSITORY artifact and stays at the workspace root (B-109): `cycle-release`
// derives the next version from its `[Unreleased]` section, so there is exactly one of them.
const CHANGELOG = new URL("../../../../CHANGELOG.md", import.meta.url);

/**
 * The body between `## [Unreleased]` and the next `## [` heading.
 *
 * The boundary is the heading, not the end of file: everything after the next `## [` is a released
 * version, and reaching it is the one thing this gate must never do. An absent section yields an
 * empty string — the normal state right after a release, and not a failure. Emptiness at release
 * time is `changelog_section_nonempty.py`'s question, and giving one fact two owners is how two
 * gates drift apart.
 */
export function unreleasedBody(changelog: string): string {
  const start = changelog.search(/^## \[Unreleased\]\s*$/m);
  if (start === -1) return "";
  const after = changelog.slice(start);
  const nextHeading = after.slice(1).search(/^## \[/m);
  return nextHeading === -1 ? after : after.slice(0, nextHeading + 1);
}

/** Offenders in the unreleased body, with line numbers relative to the WHOLE file. */
export function scanUnreleased(changelog: string): Offender[] {
  const body = unreleasedBody(changelog);
  // No empty-body guard: `scanText` already returns [] for an empty string, and a redundant line
  // is a line no mutant can kill — measured, then removed rather than given a test that proves
  // nothing.
  const offset = changelog.slice(0, changelog.indexOf(body)).split("\n").length - 1;
  return scanText("CHANGELOG.md", body).map((o) => ({
    ...o,
    line: o.line + offset,
  }));
}

const RELEASED_PT = `# Changelog

## [Unreleased]

- **A gate that reads only the unreleased section.**

## [0.60.0] - 2026-08-18

### Added

- **\`CLEAR_SCREEN_AND_SCROLLBACK\`.** O item foi registrado esperando ser morto, e a medicao
  mostrou o contrario.
`;

const UNRELEASED_PT = `# Changelog

## [Unreleased]

- **Isto nao deveria passar no gate.** A medicao mostrou que sete releases sairam assim.

## [0.60.0] - 2026-08-18

- **Something that shipped, in English.**
`;

describe("the [Unreleased] section is written in English", () => {
  it("test_a_portuguese_unreleased_entry_is_reported", () => {
    const offenders = scanUnreleased(UNRELEASED_PT);

    expect(offenders.length).toBeGreaterThan(0);
    // The line number is relative to the whole file, so a reader can jump to it.
    const line = UNRELEASED_PT.split("\n")[offenders[0]!.line - 1];
    expect(line).toContain("nao deveria passar");
  });

  it("test_a_portuguese_released_entry_is_left_alone", () => {
    // Rule 6 — the whole reason CHANGELOG.md is exempt from the repository-wide sweep. This
    // fixture's Portuguese is real text from the shipped 0.60.0 entry.
    expect(RELEASED_PT).toContain("O item foi registrado");

    expect(scanUnreleased(RELEASED_PT)).toEqual([]);
  });

  it("test_an_empty_or_absent_unreleased_section_passes", () => {
    // The normal state immediately after a release. A gate that failed here would be red on every
    // freshly-cut tree.
    expect(
      scanUnreleased("# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n- x\n"),
    ).toEqual([]);
    expect(scanUnreleased("# Changelog\n\n## [1.0.0] - 2026-01-01\n\n- x\n")).toEqual([]);
  });

  it("test_the_repositorys_unreleased_section_is_english", () => {
    const changelog = readFileSync(CHANGELOG, "utf8");

    expect(scanUnreleased(changelog)).toEqual([]);
  });

  it("test_the_boundary_stops_at_the_next_released_heading", () => {
    // Without this, an extraction that ran to end-of-file would pass every test above and sweep
    // seven immutable releases the first time someone wrote a Portuguese entry in [Unreleased].
    const body = unreleasedBody(RELEASED_PT);

    expect(body).toContain("[Unreleased]");
    expect(body).not.toContain("0.60.0");
  });
});
