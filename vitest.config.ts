import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // Determinism root (plan ADR D2 + EC-5): pin the color-detection inputs so
    // local terminals and CI runners produce byte-identical frames.
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
