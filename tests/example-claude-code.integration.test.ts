import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// Wiring smoke for the composed Claude Code scene: it exercises the two-column
// welcome, the notices, an AgentTimeline transcript (spaced), the working
// indicator with tokens, and the mode footer. Piped stdout is the non-TTY scene.
it(
  "claude_code_scene_renders_the_full_look_when_piped",
  { timeout: 30000 },
  () => {
    const out = execFileSync(
      "pnpm",
      ["exec", "tsx", "examples/claude-code-scene.tsx"],
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
    // Strip ANSI: the tool header splits "Search" (bold) from "(pattern:" (dim)
    // with SGR codes between them, so assert on the plain text.
    // eslint-disable-next-line no-control-regex
    const plain = out.replace(/\[[0-9;]*m/g, "");
    expect(plain).toContain("Tips for getting started"); // welcome aside
    expect(plain).toContain("!! "); // warning notice
    expect(plain).toContain("Opus 4.8 is now available!"); // info notice
    expect(plain).toContain("⏺"); // assistant / tool bullet
    expect(plain).toContain("Search(pattern:"); // tool name(args)
    expect(plain).toContain("(27s · 47k tokens · esc to interrupt)"); // working line
    expect(plain).toContain("⏵⏵ auto-accept edits on"); // mode footer
    // AgentTimeline cadence: a blank line sits between the user turn and the
    // assistant reply (the transcript breathes).
    const lines = plain.split("\n");
    const iUser = lines.findIndex((l) => l.includes("add a hello world"));
    const iReply = lines.findIndex((l) => l.includes("I'll create a hello"));
    expect(iReply - iUser).toBeGreaterThanOrEqual(2);
  },
);
