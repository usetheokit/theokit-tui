import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// T3.2 wiring pillar (a): the theme showcase is a human-runnable caller for
// the built-in themes.
it("themes_example_renders_both_palettes", { timeout: 30000 }, () => {
  const out = execFileSync("pnpm", ["exec", "tsx", "examples/components/themes.tsx"], {
    encoding: "utf8",
    // Kills the child at the deadline (sync call); minimal env per the M2
    // review lesson.
    timeout: 30000,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      FORCE_COLOR: "1",
    },
  });
  // Dark accent (cyan) and light accent (blue) both present — the two
  // palettes actually rendered.
  expect(out).toContain("[36m");
  expect(out).toContain("[34m");
  expect(out).toContain("dark (default)");
  expect(out).toContain("light");
});
