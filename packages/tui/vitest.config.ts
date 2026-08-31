import { cpus } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default is os.availableParallelism(): one fork per core, each booting a full
    // test environment. Capping leaves headroom for the host, and costs no wall-clock
    // because the gain above this point was already noise when measured.
    maxWorkers: Math.max(2, cpus().length - 4),
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // Determinism root (plan ADR D2 + EC-5): pin the color-detection inputs so
    // local terminals and CI runners produce byte-identical frames.
    // NO_COLOR=""/CI="" rely on the modern "non-empty" reading of the specs +
    // FORCE_COLOR precedence; the forced-color canary test turns any future
    // upgrade regression of this pin into a red test (review F-dom-3/testing).
    env: {
      FORCE_COLOR: "1",
      NO_COLOR: "",
      CI: "",
    },
    // An empty suite is a broken gate — fail fast (rules/error-handling.md § 1).
    passWithNoTests: false,
    // B-020 D1 — a budget derived from measurement rather than inherited.
    //
    // vitest's default is 5000ms. Measured on an idle machine 2026-08-18:
    // tests/contract/package-contract.test.ts takes 3004ms — 60% of that budget with nothing else
    // running, so 2x contention exceeds it and the test reports a TIMEOUT. That is what `npm test`
    // was doing at default workers under load, and it is NOT a race: a race reports a wrong value.
    //
    // The suite already contains tests at 6101ms and 9193ms that pass, so 5000ms was never a
    // measured budget for this repository — it is simply the number vitest ships, and exactly one
    // test here sets its own.
    //
    // 15000ms is 5x the slowest default-budget test. It cannot mask a race (wrong values still
    // fail) and it costs 10 extra seconds once per genuinely hung test, against a false failure
    // paid on every loaded run.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // B-048 — declared, not defaulted, because the Squad gate reads a FILE.
      //
      // `coverage_gate.py` looks for `coverage/coverage-summary.json` first, and vitest's default
      // set (`text`, `html`, `clover`, `json`) writes none of the four names it knows. So the gate
      // reported "the threshold was NOT verified" on every validation run, and WARN does not block.
      //
      // The list REPLACES the defaults rather than extending them, so all four are named here: the
      // tempting one-line fix (`["text", "json-summary"]`) silently deletes the HTML report people
      // open locally and the clover.xml other tools consume, and nothing in this repo would fail.
      //
      // The `thresholds` below are what actually enforce coverage, at 90 — stricter than the Squad
      // gate's 80 — and CI runs `pnpm test:coverage`, so a miss fails the job. This key does not
      // add safety; it stops a gate from emitting noise nobody can act on.
      // `lcov` is what SonarCloud reads. `sonar-project.properties` already points at
      // `packages/tui/coverage/lcov.info`, and without this entry that file is never written — the
      // scanner looked for it, found nothing, and reported 0% coverage while the suite was at 90+.
      // A promise in a config file that the build does not keep is worse than no promise: the
      // number it produces looks measured.
      reporter: ["text", "html", "clover", "json", "json-summary", "lcov"],
      // Plan Global DoD: >= 90% on src/** (critical paths at 100%).
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
