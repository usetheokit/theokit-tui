import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// B-051 — the gate must read the git INDEX, not the filesystem, and it must fail CLOSED.
//
// Two defects, both measured. `prettier --check .` and `eslint .` walked the tree, so their result
// depended on whatever untracked files a machine carried — a clean CI checkout saw 23 dirty files
// and a developer machine saw 24. And the first repair introduced a worse one: `git ls-files |
// xargs tool` runs under `sh -c` with no `pipefail`, so git's exit 128 is discarded and xargs still
// invokes the tool once with zero arguments. Measured outside a git repo: the pipeline exited 0
// having inspected nothing.
//
// TWO EARLIER VERSIONS OF THIS FILE WERE THE WRONG TEST, and the sequence is worth keeping.
//
// The first ran the real gate over 400 files — 25s and 33s of CPU inside a load-sensitive suite.
// Measured: `pnpm gates` failed 3 of 3 runs with those tests present, twice with
// `[vitest-worker]: Timeout calling "onTaskUpdate"` while every test passed, and exited 0 twice in
// a row without them. It was causing the instability it sat beside.
//
// The second asserted the COMMAND STRING instead, and review broke it in one line: replacing
// `git ls-files` with `git ls-files --others --cached` satisfies every assertion while
// reintroducing the untracked files the gate exists to exclude. A guard that a one-word change
// walks past is not guarding the property it names.
//
// So this runs the REAL pipeline against a THROWAWAY three-file repository in the system tmpdir.
// It is the property, executed, in milliseconds — the 400-file tree was never what made it slow.

// The gate scripts under test are the WORKSPACE ones (`format:check` runs at the root), and so is
// the node_modules/.bin the probe puts on PATH — B-109.
const REPO_ROOT = new URL("../../../../", import.meta.url).pathname;

interface Probe {
  readonly exitCode: number;
  readonly stdout: string;
}

/** Runs one of this repo's gate scripts, verbatim, inside `cwd`. */
function runGateScriptIn(script: string, cwd: string): Probe {
  const command = (
    JSON.parse(
      execFileSync(
        "node",
        ["-e", "process.stdout.write(require('fs').readFileSync('package.json','utf8'))"],
        {
          cwd: REPO_ROOT,
          encoding: "utf8",
        },
      ),
    ) as { scripts: Record<string, string> }
  ).scripts[script];

  try {
    const stdout = execFileSync(
      "sh",
      ["-c", `PATH="${REPO_ROOT}node_modules/.bin:$PATH"; ${command}`],
      { cwd, encoding: "utf8", stdio: "pipe" },
    );
    return { exitCode: 0, stdout };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: typeof e.status === "number" ? e.status : 1,
      // stderr, not just stdout: eslint reports there, and a probe that hides the reason turns a
      // diagnosable failure into a number.
      stdout: `${e.stdout ?? ""}${e.stderr ?? ""}`,
    };
  }
}

function withRepo(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "b051-gate-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    writeFileSync(join(dir, "clean.ts"), "export const x = 1;\n", "utf8");
    execFileSync("git", ["add", "clean.ts"], { cwd: dir });
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("gate format:check (B-051) — the property, executed", () => {
  const script = "format:check";
  it("test_an_untracked_file_cannot_turn_the_gate_red", () => {
    withRepo((dir) => {
      // Arrange — a badly formatted file that git does not track.
      writeFileSync(join(dir, "untracked.ts"), "const   bad=1;;;\n\n\n", "utf8");

      // Act
      const { exitCode } = runGateScriptIn(script, dir);

      // Assert — invisible to the gate, so two machines agree. This is what `--others` would break.
      expect(exitCode).toBe(0);
    });
  });

  it("test_a_tracked_file_still_turns_the_gate_red", () => {
    withRepo((dir) => {
      // Arrange — the same badly formatted content, but TRACKED. Without this, every assertion
      // above is satisfied by a gate that inspects nothing at all.
      writeFileSync(join(dir, "tracked.js"), "const   bad=1;\n\n\n", "utf8");
      execFileSync("git", ["add", "tracked.js"], { cwd: dir });

      // Act
      const { exitCode } = runGateScriptIn(script, dir);

      // Assert
      expect(exitCode).not.toBe(0);
    });
  });

  it("test_the_gate_fails_closed_outside_a_git_repository", () => {
    // Arrange — no `.git` at all: a Docker `COPY . .` context, or an exported tarball.
    const dir = mkdtempSync(join(tmpdir(), "b051-nogit-"));
    try {
      writeFileSync(join(dir, "bad.js"), "const   bad=1;\n\n\n", "utf8");

      // Act
      const { exitCode } = runGateScriptIn(script, dir);

      // Assert — non-zero. `git ls-files` exits 128 there, and without this guard the pipeline
      // reported SUCCESS having inspected nothing, because npm runs scripts without `pipefail`
      // and xargs invokes the tool even with an empty list.
      expect(exitCode).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// `lint` is NOT executed here, and saying which is executed matters more than the coverage number.
//
// Standing up a working eslint installation inside a throwaway repository turned out to be its own
// project: three attempts produced `Oops! Something went wrong! ESLint: 9.39.4` from config and
// plugin resolution under vitest's environment, none of it about the property under test. What IS
// under test is that the file list comes from the index, and `lint` gets that from the same
// pipeline shape `format:check` uses — which the block above executes end to end.
//
// So this asserts the shape, and asserts it against the specific mutation review found: `--others`
// (or `--cached` alone) reintroduces untracked files while satisfying a naive "contains git
// ls-files" check. An executed probe would be better; a shape check that names the known escape is
// what is affordable, and the difference is recorded rather than papered over.
describe("gate lint (B-051) — the shape, asserted", () => {
  const command = (
    JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    }
  ).scripts.lint;

  it("test_the_file_list_comes_from_the_index", () => {
    expect(command).toBeDefined();
    expect(command).toContain("git ls-files");
    // Review defeated the first version of this assertion with TWO commands that contain
    // `git ls-files` and are still non-hermetic — `--others` and its short form `-o`, both of which
    // list UNTRACKED files, which is the defect itself. Verified empirically by the reviewer:
    // `git ls-files -z -c -o --exclude-standard | xargs -0 prettier …` exits 123 against an
    // untracked malformed file where the shipped command exits 0.
    expect(command).not.toMatch(/(?:^|\s)(?:-o|--others)(?:\s|$)/);
  });

  it("test_the_gate_refuses_an_empty_list_rather_than_passing", () => {
    // The fail-open review measured: with no `.git`, `git ls-files` exits 128, npm runs scripts
    // without `pipefail`, and xargs invokes the tool anyway with zero files — reporting success
    // having inspected nothing. The guard is what makes the empty case a failure.
    expect(command).toContain("test -n");
  });
});
