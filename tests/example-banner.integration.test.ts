import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// T2.2 wiring pillar (a): the banner demo is a human-runnable caller — and
// piped stdout IS the EC-2 non-TTY environment (columns undefined → the
// width fallback path runs by construction).
it(
  "banner_example_renders_and_exits_cleanly_when_piped",
  { timeout: 30000 },
  () => {
    const out = execFileSync("pnpm", ["exec", "tsx", "examples/banner.tsx"], {
      encoding: "utf8",
      // Kills the child at the deadline (sync call — it-level timeout can't);
      // minimal env per the M2 review lesson (dom-testing-3).
      timeout: 30000,
      env: {
        PATH: process.env["PATH"] ?? "",
        HOME: process.env["HOME"] ?? "",
        FORCE_COLOR: "1",
      },
    });
    expect(out).toContain("Theo TUI");
    expect(out).toContain("v0."); // real VERSION renders
    expect(out).not.toContain("vundefined"); // EC-11
    expect(out).toContain("/help");
    // Pipe fallback width 60 > floor → border present; FORCE_COLOR=1 keeps
    // the dark theme → round corners (plan D3/EC-3).
    expect(out).toContain("╭");
    expect(out).toContain("cwd: ~/projects/demo"); // children slot
  },
);
