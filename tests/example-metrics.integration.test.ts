import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// T3.2 wiring pillar (a): the metrics demo is a human-runnable caller.
it(
  "metrics_example_renders_and_exits_cleanly_when_piped",
  { timeout: 30000 },
  () => {
    const out = execFileSync("pnpm", ["exec", "tsx", "examples/metrics.tsx"], {
      encoding: "utf8",
      // Kills the child at the deadline (sync call); minimal env per the M2
      // review lesson.
      timeout: 30000,
      env: {
        PATH: process.env["PATH"] ?? "",
        HOME: process.env["HOME"] ?? "",
        FORCE_COLOR: "1",
      },
    });
    // Frames carry ANSI (FORCE_COLOR=1) — strip before anchoring.
    // eslint-disable-next-line no-control-regex
    const plain = out.replace(/\u001B\[[0-9;]*m/g, "");
    expect(plain).toMatch(/\d+% (left|used)/);
    expect(plain).toContain("~$");
    expect(plain).toContain("█");
  },
);
