import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B-095 — proves the SYNC HAPPENS, not that the script exists.
 *
 * The manual step this replaces was correct on every release so far because someone remembered.
 * A test asserting only "the two agree today" would pass against a script that does nothing, since
 * they agree today for the old reason. So each case starts from a DISAGREEMENT and asserts the
 * script closes it.
 *
 * Runs against a throwaway tree rather than the repository, so a failure cannot rewrite
 * `src/index.ts` under the suite that is reading it.
 */
const SCRIPT = fileURLToPath(new URL("../../scripts/sync-version.mjs", import.meta.url));

function sandbox(manifestVersion: string, entryVersion: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "sync-version-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "probe", version: manifestVersion }),
  );
  writeFileSync(
    join(dir, "src", "index.ts"),
    entryVersion === null
      ? "export const NOT_THE_LINE = 1;\n"
      : `// leading comment\nexport const VERSION = "${entryVersion}";\nexport const AFTER = 2;\n`,
  );
  return dir;
}

const run = (dir: string): { status: number; stdout: string } => {
  try {
    const stdout = execFileSync("node", [SCRIPT], {
      cwd: dir,
      encoding: "utf8",
    });
    return { status: 0, stdout };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: e.status ?? -1,
      stdout: `${e.stdout ?? ""}${e.stderr ?? ""}`,
    };
  }
};

describe("sync-version (B-095)", () => {
  it("rewrites_a_stale_constant_to_match_the_manifest", () => {
    const dir = sandbox("9.9.9", "0.0.1");
    expect(run(dir).status).toBe(0);
    expect(readFileSync(join(dir, "src", "index.ts"), "utf8")).toContain(
      'export const VERSION = "9.9.9";',
    );
  });

  it("leaves_the_rest_of_the_file_untouched", () => {
    // The rewrite is a line replacement, not a regeneration — everything around it survives.
    //
    // NOT a second detector, and measured as such: with the write removed entirely this case stays
    // GREEN, because "nothing was clobbered" is true of a script that does nothing. It guards the
    // opposite failure — over-writing — and only `rewrites_a_stale_constant_…` proves the write
    // happens at all (mutation: write removed -> 1 failed | 3 passed; restored -> 4 passed).
    const dir = sandbox("9.9.9", "0.0.1");
    run(dir);
    const after = readFileSync(join(dir, "src", "index.ts"), "utf8");
    expect(after).toContain("// leading comment");
    expect(after).toContain("export const AFTER = 2;");
  });

  it("is_a_noop_when_they_already_agree", () => {
    const dir = sandbox("1.2.3", "1.2.3");
    const result = run(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("already 1.2.3");
  });

  it("fails_loudly_when_the_constant_line_is_gone_rather_than_writing_nothing", () => {
    // A silent no-op here would recreate the drift this closes: the release would proceed, the
    // constant would stay wrong, and only CI would notice — which is the whole complaint.
    const dir = sandbox("1.2.3", null);
    const result = run(dir);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/no `export const VERSION/);
  });
});
