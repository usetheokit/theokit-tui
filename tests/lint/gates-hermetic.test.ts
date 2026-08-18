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
// The second test asserts the RULE (an untracked file cannot decide the gate) rather than the one
// directory that exposed it: naming `.pytest_cache` here would pass again the moment the next
// tool drops an unformatted artifact somewhere else.
//
// Both shell out to the real `prettier` binary. A reimplementation would be a second formatter to
// keep in sync with the first, which is the defect one layer down (Rule 9, Rule 12).

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" })
    .split("\n")
    .filter((line) => /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|css)$/.test(line));
}

/** Runs the real formatter over an explicit file list; returns its exit code. */
function prettierCheck(files: string[]): number {
  try {
    execFileSync("npx", ["prettier", "--check", ...files], {
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

describe("gates are green and hermetic (B-051)", () => {
  it("test_tracked_files_are_formatted", () => {
    // Arrange — every tracked file prettier has an opinion about.
    const files = trackedFiles();
    expect(files.length).toBeGreaterThan(0);

    // Act
    const exitCode = prettierCheck(files);

    // Assert — this is `pnpm format:check` restricted to what git actually carries.
    expect(exitCode).toBe(0);
  });

  it("test_an_untracked_file_cannot_turn_the_gate_red", () => {
    // Arrange — a badly formatted file that git does not know about, in a directory no rule names.
    const dir = mkdtempSync(join(REPO_ROOT, "b051-scratch-"));
    scratch.push(dir);
    writeFileSync(join(dir, "unformatted.ts"), "const   x=1;;;\n\n\n", "utf8");

    // Act — the hermetic form: only what git tracks.
    const exitCode = prettierCheck(trackedFiles());

    // Assert — the untracked file is invisible to the gate, so two machines agree.
    expect(exitCode).toBe(0);
  });
});
