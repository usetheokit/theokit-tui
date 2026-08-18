import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// M25 T5.1 wiring pillar (a): the parity-polish demo is a human-runnable caller.
// Piped stdout is a non-TTY environment — the example prints one frame of the
// Markdown table, the intra-line diff, and the ExpandableOutput affordance and
// exits cleanly. OSC-8 / terminal-title escapes are suppressed off-TTY.
describe("examples/renderer/parity-polish.tsx (T5.1)", () => {
  it(
    "parity_polish_example_renders_the_surfaces_and_exits_cleanly_when_piped",
    { timeout: 30000 },
    () => {
      const raw = execFileSync(
        "pnpm",
        ["exec", "tsx", "examples/renderer/parity-polish.tsx"],
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
      // eslint-disable-next-line no-control-regex
      const out = raw.replace(/\[[0-9;?]*[A-Za-z]/g, "");
      // Markdown table grid.
      expect(out).toContain("┌"); // bordered table
      expect(out).toContain("surface");
      expect(out).toContain("intra-line diff");
      // DiffViewer.
      expect(out).toContain("const retries = 5;");
      // ExpandableOutput affordance.
      expect(out).toContain("ctrl+r to expand");
      // Non-TTY guard: no OSC-8 hyperlink sequence leaks (osc8Link degraded to
      // plain text; setTerminalTitle no-op).
      expect(raw).not.toContain("]8;;"); // the OSC-8 signature
      expect(raw).not.toContain("]0;"); // the OSC-0 title signature
      expect(out).toContain("docs"); // the link text still renders
    },
  );
});
