import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

// B-051 — `pnpm gates` has been red since v0.54.0, which is also the first version that never
// reached npm. `format:check` is the first link of `gates` (package.json:63) and `prepublishOnly`
// runs `gates` (package.json:64), so nothing downstream of it has executed in any publish attempt
// since.
//
// Two properties are pinned here, and the second is the one that lasts. Reformatting 24 files is a
// one-off; a gate that reads UNTRACKED files goes red again for reasons that have nothing to do
// with the code. `prettier --check .` walks the filesystem, not the index, and
// `.pytest_cache/README.md` — untracked, absent from `.prettierignore` — was in its output. A clean
// CI checkout saw 23 files and a machine that had run pytest saw 24.
//
// This asserts the RULE (an untracked file cannot decide the gate) rather than the one directory
// that exposed it: naming `.pytest_cache` here would pass again the moment the next tool drops an
// unformatted artifact somewhere else.
//
// THERE WAS A SECOND TEST HERE, and deleting it is the point. It re-ran `prettier --check` over
// every tracked file to assert they are formatted — which is exactly what `pnpm format:check`
// already does, as the FIRST link of `pnpm gates`. A test that re-runs a gate the gate already runs
// is not a second opinion, it is the same opinion at double the cost: it took 30s idle and timed
// out at 50s under `gates`, in a suite already load-sensitive (B-034/B-035). Parsimony rung 1
// applied to my own code — the formatting regression is caught by `format:check`, and T1.3 wires
// `gates` into the cycle's validation so it is caught before a release rather than at publish.
//
// It shells out to the real `prettier` binary. A reimplementation would be a second formatter to
// keep in sync with the first, which is the defect one layer down (Rule 9, Rule 12).

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

/** Runs the gate's own command — `pnpm format:check` — and returns its exit code. */
function prettierCheckRepo(): number {
  try {
    execFileSync("pnpm", ["format:check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
    return 0;
  } catch (error) {
    const status = (error as { status?: number }).status;
    return typeof status === "number" ? status : 1;
  }
}

const scratch: string[] = [];

afterAll(() => {
  for (const path of scratch) rmSync(path, { recursive: true, force: true });
});

describe("gates are hermetic (B-051)", () => {
  it("test_an_untracked_file_cannot_turn_the_gate_red", () => {
    // Arrange — a badly formatted file that git does not know about, in a directory no rule names.
    const dir = mkdtempSync(join(REPO_ROOT, "b051-scratch-"));
    scratch.push(dir);
    writeFileSync(join(dir, "unformatted.ts"), "const   x=1;;;\n\n\n", "utf8");

    // Act — the real gate command, verbatim: `format:check` is `prettier --check .`.
    const exitCode = prettierCheckRepo();

    // Assert — the untracked file is invisible to it, so two machines agree on the result.
    expect(exitCode).toBe(0);
  }, 180_000); // the whole tree, which took 28s idle and 50s under `pnpm gates`. Measured, not guessed. // Explicit, because it exceeds the repo-wide 15s testTimeout: it runs the real formatter over
});
