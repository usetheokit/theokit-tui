/**
 * B-102 — the first tests this script has had, on the day it let two failures reach CI.
 *
 * `gate-scope.mjs` runs on every `pnpm lint`, every `pnpm typecheck`, and both CI matrix jobs. Its
 * B-084 contract — the scope line prints only on success, and zero inspected is a failure — was
 * pinned by nothing. Two of these tests are regression guards for that contract rather than for
 * the behaviour being added, and they are here because the person adding the behaviour had already
 * misread the script twice today.
 *
 * Every fixture builds its own repository in a temp directory. A test that read THIS repository
 * would pass or fail on whatever files happen to be untracked while it runs.
 *
 * DETECTION POWER, measured rather than predicted: making `unInspectedSourceFiles` return `[]`
 * gives 6 pass / 1 fail; restored, 7 pass. One, and it is the right one — the other six pin
 * behaviour the mutation does not touch, which is what a regression guard is for.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "gate-scope.mjs");

/** A repository with one committed file, so `git ls-files` has something to say. */
function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "gate-scope-"));
  const git = (...args) =>
    spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
      },
    });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "tracked.ts"), "export const a = 1;\n");
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "initial");
  return root;
}

/**
 * Run gate-scope over a fake gate.
 *
 * The gate is `node -e`, so the test controls its stdout and exit status exactly — no dependency
 * on eslint or tsc being installed, and no chance of measuring their behaviour instead of this
 * script's.
 */
function runGate({
  cwd,
  label = "lint",
  stdout = JSON.stringify({ summary: { changed: 0, unchanged: 0 }, diagnostics: [] }),
  exitCode = 0,
  files = [],
}) {
  return spawnSync(
    process.execPath,
    [
      SCRIPT,
      label,
      process.execPath,
      "-e",
      `process.stdout.write(${JSON.stringify(stdout)}); process.exit(${String(exitCode)})`,
      "--",
      ...files,
    ],
    { cwd, encoding: "utf8" },
  );
}

const ONE_RESULT = JSON.stringify({
  summary: { changed: 0, unchanged: 1, errors: 0, warnings: 0 },
  diagnostics: [],
  command: "lint",
});

// B-109 — the lint gate is Biome now, and Biome's JSON reporter is a DIFFERENT SHAPE from
// ESLint's. ESLint emits an array of per-file results, so `.length` was the file count. Biome
// emits `{ summary: { changed, unchanged, ... }, diagnostics: [...] }`, where the count is
// `changed + unchanged` and `diagnostics.length` is the number of PROBLEMS — a number that is
// zero on a clean run. Counting the wrong field would make every green run report "inspected
// nothing" and, under RULE 2, fail the build.
const BIOME_CLEAN = JSON.stringify({
  summary: { changed: 0, unchanged: 3, errors: 0, warnings: 0 },
  diagnostics: [],
  command: "lint",
});

test("the lint counter reads Biome's summary, not its diagnostics array", () => {
  const root = makeRepo();

  const r = runGate({ cwd: root, stdout: BIOME_CLEAN, files: ["src/tracked.ts"] });

  assert.equal(r.status, 0, "a clean Biome run must pass");
  assert.match(
    r.stdout,
    /3 files inspected/,
    "changed + unchanged is the inspected set; diagnostics.length is 0 on a clean run",
  );
});

test("a passing gate names untracked source files of the same kind", () => {
  const root = makeRepo();
  writeFileSync(join(root, "src", "brand-new.ts"), "export const b = 2;\n");

  const r = runGate({
    cwd: root,
    stdout: ONE_RESULT,
    files: ["src/tracked.ts"],
  });

  assert.equal(r.status, 0, "reporting must not change the verdict (ADR D1)");
  assert.match(r.stdout, /1 files inspected/);
  assert.match(
    r.stdout + r.stderr,
    /brand-new\.ts/,
    "the file the gate never saw must be named — this is the whole item",
  );
});

test("an untracked file of a different kind is not named", () => {
  const root = makeRepo();
  writeFileSync(join(root, "notes.md"), "# not source to this gate\n");

  const r = runGate({
    cwd: root,
    stdout: ONE_RESULT,
    files: ["src/tracked.ts"],
  });

  assert.equal(r.status, 0);
  assert.doesNotMatch(
    r.stdout + r.stderr,
    /notes\.md/,
    "extensions are derived from the list handed in, never configured (ADR D2)",
  );
});

test("an ignored file is not named", () => {
  const root = makeRepo();
  writeFileSync(join(root, ".gitignore"), "generated/\n");
  mkdirSync(join(root, "generated"), { recursive: true });
  writeFileSync(join(root, "generated", "out.ts"), "export const c = 3;\n");

  const r = runGate({
    cwd: root,
    stdout: ONE_RESULT,
    files: ["src/tracked.ts"],
  });

  assert.doesNotMatch(r.stdout + r.stderr, /out\.ts/);
});

test("a clean tree prints only the inspected count", () => {
  const root = makeRepo();

  const r = runGate({
    cwd: root,
    stdout: ONE_RESULT,
    files: ["src/tracked.ts"],
  });

  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 files inspected/);
  assert.doesNotMatch(r.stdout + r.stderr, /not inspected/);
});

test("a failing gate prints no scope claim and no blind spot", () => {
  // B-084 RULE 1, pinned for the first time. A gate announcing what it examined immediately
  // before failing invites the failure to be read as partial.
  const root = makeRepo();
  writeFileSync(join(root, "src", "brand-new.ts"), "export const b = 2;\n");

  const r = runGate({
    cwd: root,
    stdout: "boom",
    exitCode: 1,
    files: ["src/tracked.ts"],
  });

  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout, /files inspected/);
  assert.doesNotMatch(r.stdout + r.stderr, /brand-new\.ts/);
});

test("zero inspected still fails", () => {
  // B-084 RULE 2, pinned for the first time. A set of zero is indistinguishable from a gate that
  // did not run.
  const root = makeRepo();

  const r = runGate({
    cwd: root,
    stdout: JSON.stringify({ summary: { changed: 0, unchanged: 0 }, diagnostics: [] }),
    files: [],
  });

  assert.equal(r.status, 1);
  assert.match(r.stderr, /INSPECTED NOTHING/);
});

test("outside a repository the gate behaves as before", () => {
  // ADR D3 — a diagnostic that breaks a passing build because git is missing has made things
  // worse than the situation it reports on.
  const root = mkdtempSync(join(tmpdir(), "gate-scope-nogit-"));
  writeFileSync(join(root, "loose.ts"), "export const d = 4;\n");

  const r = runGate({ cwd: root, stdout: ONE_RESULT, files: ["loose.ts"] });

  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 files inspected/);
});
