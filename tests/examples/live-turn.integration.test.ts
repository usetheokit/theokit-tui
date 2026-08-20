import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// M24 T5.1 wiring pillar (a): the live-turn demo is a human-runnable caller.
// Piped stdout is a non-TTY environment — the example prints one frame of all the
// live-progress surfaces (TodoList, MultiStepProgress, ThinkingBlock,
// CollapsibleBlock, AgentStreaming, Toast) and exits cleanly.
describe("examples/scenes/live-turn.tsx (T5.1)", () => {
  it(
    "live_turn_example_renders_the_surfaces_and_exits_cleanly_when_piped",
    { timeout: 30000 },
    () => {
      const raw = execFileSync(
        "pnpm",
        ["exec", "tsx", "examples/scenes/live-turn.tsx"],
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
      // Strip ANSI: the active-item glyph carries an accent color that would
      // otherwise split "◐ write the tests" mid-token.
      // eslint-disable-next-line no-control-regex
      const out = raw.replace(/\[[0-9;?]*[A-Za-z]/g, "");
      // TodoList status glyphs.
      expect(out).toContain("☑ read the spec"); // done
      expect(out).toContain("◐ write the tests"); // active
      // MultiStepProgress subagent header + counter.
      expect(out).toContain("3 subagents");
      expect(out).toContain("1 of 3");
      // CollapsibleBlock / ThinkingBlock affordance (collapsed).
      expect(out).toContain("▸");
      expect(out).toContain("Thinking");
      // Toast.
      expect(out).toContain("build finished");
      // RISK-2 end-to-end: the example calls notify(), but piped stdout is a
      // non-TTY, so no OSC-9 desktop-notify sequence leaks into the output.
      expect(raw).not.toContain("]9;"); // the OSC-9 signature
    },
  );
});
