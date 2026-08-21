#!/usr/bin/env node
/**
 * B-095 — keep `src/index.ts`'s exported `VERSION` in step with `package.json`.
 *
 * ## Why this exists
 *
 * `VERSION` is `@public`: a consumer compares it to confirm which build they are running. It was
 * maintained by hand, and `tests/contract/export-surface.test.ts` compared it to the manifest — so
 * the two could only disagree until CI said so. Measured while cutting 0.72.0: the disagreement
 * surfaced after a commit, a push, a PR and a full two-Node cycle, for a step that is mechanical.
 *
 * The complaint was never the gate. The gate is the only thing standing between a published
 * package and a `VERSION` that lies about which package it is, and deleting it would be the
 * B-080-shaped mistake of removing the sole cover for a surface.
 *
 * ## What it removes
 *
 * The PERSON. The constant was correct on every release so far because someone remembered — which
 * is a process that works exactly as long as the someone is awake. That is the failure mode a
 * sibling session named "the operator counted as part of the system": the step exists, and it is
 * a human.
 *
 * ## Why not read package.json at runtime
 *
 * Parsimony rung 2 was tried and rejected. Importing the manifest into `src/index.ts` would embed
 * it in the published bundle and couple the public entry to a file layout that only exists before
 * packaging. A build-time `define` was rejected for a different reason: the contract test reads
 * `VERSION` from SOURCE, so a substitution that happens only during bundling would leave the
 * source constant free to drift while the test compared the substituted one.
 *
 * Rewriting the source is the option where the thing under test and the thing shipped are the same
 * bytes.
 *
 * ## Why paths come from `cwd` and not from this file's own location
 *
 * The first version anchored on `import.meta.url`, which is the obvious choice and is WRONG here:
 * it made the script read this repository's manifest no matter where it ran, so it could not be
 * exercised against a throwaway tree. The tests caught it immediately — three of four red — and
 * that is the whole reason to have written them before trusting it.
 *
 * `cwd` is not a compromise for testability either: npm runs lifecycle scripts from the package
 * root, so `cwd` is exactly the directory whose manifest should win.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "package.json");
const entryPath = join(root, "src", "index.ts");

const version = JSON.parse(readFileSync(manifestPath, "utf8")).version;
if (typeof version !== "string" || version.length === 0) {
  console.error("sync-version: package.json has no usable `version`");
  process.exit(1);
}

const source = readFileSync(entryPath, "utf8");
const pattern = /^(export const VERSION = ")([^"]*)(";)$/m;
const found = pattern.exec(source);
if (found === null) {
  // Fail loud rather than write nothing: a silent no-op here is exactly the drift this closes.
  console.error(`sync-version: no \`export const VERSION = "…";\` line in ${entryPath}`);
  process.exit(1);
}

if (found[2] === version) {
  console.log(`sync-version: VERSION already ${version}`);
  process.exit(0);
}

writeFileSync(entryPath, source.replace(pattern, `$1${version}$3`));
console.log(`sync-version: VERSION ${found[2]} -> ${version}`);
