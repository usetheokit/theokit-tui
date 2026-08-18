import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
