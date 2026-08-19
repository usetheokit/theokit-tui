import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// B-051 — the gate must read the git INDEX, not the filesystem.
//
// `prettier --check .` and `eslint .` both walk the tree, so their result depended on whatever
// untracked files a machine happened to carry: a `.pytest_cache/README.md` made a clean CI checkout
// see 23 dirty files and a developer machine see 24. Both scripts now pipe `git ls-files`.
//
// THE FIRST VERSION OF THIS FILE PROVED THAT BEHAVIOURALLY, AND WAS THE WRONG TEST TWICE OVER.
//
// It ran the real gate — 25s and 33s of CPU, spawning prettier and eslint over 400 files — INSIDE
// the test suite. Measured: with these two tests present, `pnpm gates` failed 3 of 3 runs, twice
// with `[vitest-worker]: Timeout calling "onTaskUpdate"` while every test passed, once with an
// unrelated typing race. With them removed, the suite exited 0 twice in a row. They were not
// detecting the instability this repository was chasing; they were causing it.
//
// And what they asserted was not ours to assert. That `git ls-files` omits untracked files is
// git's documented contract, and `rules/testing.md` § 4 says third-party behaviour is not our
// suite's job. Our contract is narrower and exactly this: the scripts are index-scoped. That is a
// property of the command line, so it is read from the command line.
//
// The runtime behaviour was measured once, by hand, and is recorded in
// `knowledge-base/implementations/b051-gates-green-implementation.md`: with a dirty untracked file
// present the index-scoped command exits 0 and the tree-walking one exits 1.

const scripts = (
  JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as {
    scripts: Record<string, string>;
  }
).scripts;

describe("gates are hermetic (B-051)", () => {
  it.each(["format:check", "lint"])(
    "test_%s_reads_the_git_index_not_the_filesystem",
    (script) => {
      // Arrange / Act
      const command = scripts[script];

      // Assert — the source of the file list is the index. A revert to `prettier --check .` or
      // `eslint .` fails here, which is the whole reason this test exists.
      expect(command).toBeDefined();
      expect(command).toContain("git ls-files");
      expect(command).not.toMatch(/(?:prettier|eslint)[^|]*\s\.\s*$/);
    },
  );
});
