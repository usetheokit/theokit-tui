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
