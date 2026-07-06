import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// T3.2 wiring pillar (a): the tools demo is a human-runnable caller — this
// smoke keeps it CI-covered (M1 F-tests-8 precedent).
it(
  "tools_example_renders_and_exits_cleanly_when_piped",
  { timeout: 30000 },
  () => {
    const out = execFileSync("pnpm", ["exec", "tsx", "examples/tools.tsx"], {
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "1", CI: "" },
    });
    expect(out).toContain("✓");
    expect(out).toContain("… +");
    expect(out).toContain("exited");
  },
);
