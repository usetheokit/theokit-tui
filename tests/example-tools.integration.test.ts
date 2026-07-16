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
      // Kills the child at the deadline — the it-level timeout cannot
      // interrupt a synchronous execFileSync (review tests-3). Minimal env
      // mirrors the example-chat smoke (review dom-testing-3).
      timeout: 30000,
      env: {
        PATH: process.env["PATH"] ?? "",
        HOME: process.env["HOME"] ?? "",
        FORCE_COLOR: "1",
      },
    });
    // M26 parity: the `⏺` status bullet, the `name(args)` header, and the `⎿`
    // result-tree connector all render in the piped scene.
    expect(out).toContain("⏺");
    expect(out).toContain("Bash");
    expect(out).toContain("(pnpm install)");
    expect(out).toContain("⎿");
    expect(out).toContain("… +");
    expect(out).toContain("exited");
  },
);
