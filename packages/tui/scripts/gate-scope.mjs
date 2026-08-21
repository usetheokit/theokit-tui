#!/usr/bin/env node
/**
 * B-084 — run a gate, then state HOW MUCH IT INSPECTED, but only if it passed.
 *
 * ## The defect this closes
 *
 * Six gates across three repositories reported PASS over the wrong set, by different mechanisms:
 * a language never enabled, a file list scoped to the index, callers counted inside a nested
 * checkout, an error path returning success. The common denominator is not bugs — it is that
 * **a gate that inspected zero items and a gate that inspected all of them emit the same verdict.**
 *
 * `depcruise` and `vitest` already state their scope ("285 modules, 1119 dependencies cruised";
 * "156 files, 1709 tests"). Three gates did not, and `typecheck` printed nothing at all on success.
 * So this is not a new convention — it is the convention two of five gates already follow.
 *
 * ## Two rules, and the second is the one with teeth
 *
 * 1. The scope line prints ONLY on success. A gate announcing "examined 352 files" immediately
 *    before failing invites the failure to be read as partial, and turns the count into an excuse.
 * 2. An inspected set of ZERO fails, loudly. That is what catches "the language was never enabled"
 *    and "the new file was untracked" — the two shapes where a gate is green because it looked at
 *    nothing.
 *
 * ## Why a script and not `&&` in the npm script
 *
 * Because the count has to come from THE GATE'S OWN VIEW. `git ls-files '*.ts' | wc -l` returns
 * 425 here, `tsc` checks 352, `eslint` lints 355 — three different questions with three different
 * answers, and substituting one for another is precisely the class of error this closes.
 *
 * Getting the count out of the tool means capturing its output, and capturing it with a shell pipe
 * would take the exit status of the LAST command in the pipe. A sibling repository shipped exactly
 * that bug — `pnpm typecheck | tail -3` under `set -e` without `pipefail`, reporting `tail`'s
 * status, which is always 0. A gate wrapper that eats the exit code is worse than no wrapper.
 */

import { spawnSync } from "node:child_process";

const [, , label, ...command] = process.argv;
if (label === undefined || command.length === 0) {
  console.error("gate-scope: usage: gate-scope <label> <command> [args...]");
  process.exit(2);
}

/** How each gate's own output reveals what it looked at. Counting, never guessing. */
const counters = {
  typecheck: (stdout) =>
    stdout.split("\n").filter((l) => l !== "" && !l.includes("node_modules")).length,
  // Biome's JSON reporter: `{ summary: { changed, unchanged, ... }, diagnostics: [...] }`.
  // The inspected set is `changed + unchanged`; `diagnostics` counts PROBLEMS and is empty on a
  // clean run, so counting it would make every green run trip RULE 2 below.
  lint: (stdout) => {
    try {
      const report = JSON.parse(stdout);
      const summary = report?.summary;
      if (summary === undefined) return null;
      return (summary.changed ?? 0) + (summary.unchanged ?? 0);
    } catch {
      return null;
    }
  },
};

/**
 * B-102 — source files this gate's INPUT never contained.
 *
 * The scope line answers "how much did it inspect" (B-084). It cannot answer "of what". Measured
 * twice on 2026-08-20: `pnpm lint` printed "354 files inspected", exited 0, and CI went red on a
 * file that was on disk and not in the index. `lint` builds its list from `git ls-files`, so an
 * unstaged file is not in it — correct, reproducible (B-051), and invisible.
 *
 * The extensions are DERIVED from the list handed in rather than configured, so this and the npm
 * script's globs can never disagree. A second definition of "source file" is B-055 starting over.
 *
 * Reports; never fails (ADR D1). A file nobody staged is not part of the repository, and a gate
 * that is red during ordinary work is a gate people learn to route around.
 *
 * Any git failure returns [] — in a tarball checkout there is no repository, and a diagnostic that
 * breaks a passing build because its own instrument is missing has made things worse.
 */
function unInspectedSourceFiles(inspected) {
  const extensions = new Set(
    inspected
      .map((f) => f.slice(f.lastIndexOf(".")))
      .filter((e) => e.length > 1 && e.startsWith(".")),
  );
  if (extensions.size === 0) return [];

  const listed = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
    encoding: "utf8",
    shell: false,
  });
  if (listed.error || listed.status !== 0) return [];

  const handed = new Set(inspected);
  return listed.stdout
    .split("\n")
    .filter((f) => f !== "" && !handed.has(f))
    .filter((f) => extensions.has(f.slice(f.lastIndexOf("."))));
}

const result = spawnSync(command[0], command.slice(1), {
  encoding: "utf8",
  shell: false,
});

if (result.error) {
  console.error(`gate-scope: ${label}: could not run ${command[0]}: ${result.error.message}`);
  process.exit(2);
}

// The gate's own stderr always reaches the user; its stdout is consumed for counting, so anything
// it wrote that is NOT the machine-readable payload is re-emitted on failure below.
if (result.stderr !== "") process.stderr.write(result.stderr);

const status = result.status ?? 1;
if (status !== 0) {
  // RULE 1: no scope claim accompanies a failure. The gate's own output is what the reader needs.
  process.stdout.write(result.stdout);
  process.exit(status);
}

const count = (counters[label] ?? (() => null))(result.stdout);
if (count === null) {
  console.error(`gate-scope: ${label}: passed, but its output could not be counted`);
  process.exit(2);
}

// RULE 2: zero inspected is a failure, not a pass.
if (count === 0) {
  console.error(
    `gate-scope: ${label}: PASSED HAVING INSPECTED NOTHING — a set of zero is indistinguishable ` +
      `from a gate that did not run (B-084). Check the file list this gate is given.`,
  );
  process.exit(1);
}

console.log(`${label}: ${String(count)} files inspected`);

// The gap, stated only when there is one. In the steady state this prints nothing.
const missed = unInspectedSourceFiles(command.slice(command.indexOf("--") + 1));
if (missed.length > 0) {
  const shown = missed.slice(0, 5).join(", ");
  const rest = missed.length > 5 ? `, and ${String(missed.length - 5)} more` : "";
  console.log(
    `${label}: ${String(missed.length)} untracked source file(s) NOT inspected — ` +
      `${shown}${rest}. This gate reads the index; stage them to have them checked.`,
  );
}
