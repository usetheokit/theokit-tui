/**
 * B-035 — the suite has one wait budget, and this stops a sixth copy of it.
 *
 * `2000` is not arbitrary-but-fine: it is the exact bound measured EXPIRING on a CORRECT frame at
 * load 26 (`chat-composer.test.tsx > slash_command_menu_still_works_unchanged`, B-033). B-020,
 * B-033 and B-034 each replaced one or two copies as they failed; five more were still carrying it,
 * latent for exactly the reason the fixed ones failed. Two of the five already imported the shared
 * module and kept the literal beside it — so this was never "they did not know".
 *
 * `tests/fixtures/wait-for.ts` owns the number. Its `WAIT_BUDGET_MS` is exported, in its own words,
 * "so a helper that cannot use `waitFor` itself still shares the number rather than inventing a
 * fourth one" — which is the case here: these helpers pump the renderer with `app.flush()` or
 * `tick()` between attempts, and `waitFor` sleeps. Sharing the loop would change what advances the
 * frame; sharing the number is the fix.
 *
 * WHAT THIS CHECK CANNOT SEE, stated rather than implied: it matches a `timeoutMs` DEFAULT that is
 * a numeric literal. A sixth copy under a different parameter name is out of its reach.
 *
 * THE SPAWN BUDGETS, declared rather than silently kept: 30 occurrences of `timeout: 30000` across
 * 17 files, almost all in `tests/examples/*`, each on a test that spawns `pnpm exec tsx`. They are
 * NOT measured. They are not failing either, and changing 30 files on the hypothesis that the
 * degrade matrix's 2621 ms figure transfers is the over-reach B-034's scope section refused.
 * Measuring them is a followup. The count below is asserted so a 31st cannot appear silently.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const REPO = new URL("../../", import.meta.url);

/**
 * Where a literal budget is allowed, each for a stated reason.
 *
 * `wait-for.ts` OWNS the number. `wait-for.test.ts` passes 50 ms deliberately, to assert the
 * timeout message — a test of the helper cannot wait the real budget to prove it times out.
 *
 * The two PTY helpers are a FINDING, not an oversight, and they are why this scan was worth
 * writing. B-035 enumerated FIVE copies; the scan found SEVEN. The two extra
 * (`pty-e2e.integration.test.ts:53`, `approval-pty-e2e.integration.test.ts:52`) carry
 * `timeoutMs = 5000` and wait on a spawned PTY PROCESS rather than a rendered frame — a different
 * measurement domain, where the frame budget would be the wrong number to share. They are declared
 * here for the same reason as the 30 spawn budgets below: unmeasured, not failing, and changing
 * them on the hypothesis that a frame figure transfers to a process is the over-reach B-034's scope
 * section refused.
 */
const EXEMPT = new Set([
  // This file QUOTES the literals it bans, in order to explain them. Same reason
  // `no-ptbr.test.ts` is on its own allowlist.
  //
  // It became necessary only after `git add`: the scan reads `git ls-files`, so the file was
  // invisible to itself while untracked and the first green run meant nothing. That is the same
  // index-scoped dynamic B-051 introduced deliberately and B-023 was caught by — a local run
  // before staging does not cover the new file, which is usually the only one worth covering.
  "tests/lint/one-wait-budget.test.ts",
  "tests/fixtures/wait-for.ts",
  "tests/fixtures/wait-for.test.ts",
  "tests/renderer/pty-e2e.integration.test.ts",
  "tests/renderer/approval-pty-e2e.integration.test.ts",
]);

function tracked(): string[] {
  return execFileSync("git", ["ls-files"], {
    cwd: REPO.pathname,
    encoding: "utf8",
  })
    .split("\n")
    .filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"));
}

function scan(
  pattern: RegExp,
  options: { includeExempt?: boolean } = {},
): string[] {
  const hits: string[] = [];
  for (const rel of tracked()) {
    if (!options.includeExempt && EXEMPT.has(rel)) continue;
    const source = readFileSync(new URL(rel, REPO), "utf8");
    source.split("\n").forEach((line, index) => {
      if (pattern.test(line))
        hits.push(`${rel}:${String(index + 1)}: ${line.trim()}`);
    });
  }
  return hits;
}

describe("the suite has one wait budget", () => {
  it("test_no_test_file_carries_its_own_wait_budget", () => {
    const offenders = scan(/\btimeoutMs\s*[=:]\s*\d/);

    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `These carry their own wait budget instead of tests/fixtures/wait-for.ts's:\n\n` +
            offenders.map((o) => `  ${o}`).join("\n") +
            `\n\n2000 is the exact bound measured expiring on a CORRECT frame at load 26 (B-033).\n` +
            `Import WAIT_BUDGET_MS — the loop can stay, only the number moves.\n`,
    ).toEqual([]);
  });

  it("test_the_pty_budgets_are_declared_not_silent", () => {
    // The exemptions above are a declaration, and a declaration that drifts from the tree is worse
    // than none. If a PTY helper stops carrying its own budget, or a third appears, this fails and
    // the header must be re-read.
    const hits = scan(/\btimeoutMs\s*[=:]\s*\d/, {
      includeExempt: true,
    }).filter((h) => h.includes("pty-e2e"));

    expect(hits.length).toBe(2);
    expect(hits.every((h) => h.includes("5000"))).toBe(true);
  });

  it("test_the_spawn_budgets_are_declared_not_silent", () => {
    // The header says 30 across 17 files and that they are unmeasured. A declaration that drifts
    // from the tree is worse than none, so the count is asserted rather than written once.
    const hits = scan(/\btimeout:\s*30_?000\b/);
    const files = new Set(hits.map((h) => h.split(":")[0]));

    expect(hits.length).toBe(30);
    expect(files.size).toBe(17);
  });
});
