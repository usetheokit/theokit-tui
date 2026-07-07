import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// M8 T2.1: the GATED path of the live-agent demo — env deliberately excludes
// any OpenRouter key, so the run is deterministic (no network) and pins the
// instructive scene + clean exit.
it(
  "live_example_gated_path_renders_instructions_when_keyless",
  { timeout: 30000 },
  () => {
    const out = execFileSync(
      "pnpm",
      ["exec", "tsx", "examples/live-agent-tui.tsx"],
      {
        encoding: "utf8",
        timeout: 30000,
        env: {
          PATH: process.env["PATH"] ?? "",
          HOME: process.env["HOME"] ?? "",
          FORCE_COLOR: "1",
        },
      },
    );
    expect(out).toContain("OPENROUTER_API_KEY");
    expect(out).toContain("Theo TUI");
    expect(out).toContain("╭"); // the gate is a SCENE, not a crash
    expect(out).toContain("exiting cleanly");
  },
);
