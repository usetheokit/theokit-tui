import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// Wiring smoke for the ai-sdk adapter example: it folds ONE UIMessage[] into
// both render shapes. Piped stdout is the non-TTY environment — the scene
// prints once and exits cleanly (execFileSync throws on a non-zero exit).
it(
  "ai_sdk_example_renders_both_surfaces_when_piped",
  { timeout: 30000 },
  () => {
    const out = execFileSync("pnpm", ["exec", "tsx", "examples/ai-sdk.tsx"], {
      encoding: "utf8",
      timeout: 30000,
      env: {
        PATH: process.env["PATH"] ?? "",
        HOME: process.env["HOME"] ?? "",
        FORCE_COLOR: "1",
      },
    });
    // The glyphs and text survive in the RAW output — no ANSI stripping needed.
    // Both adapter functions are demonstrated.
    expect(out).toContain("uiMessagesToChatThread");
    expect(out).toContain("uiMessagesToAgentEvents");
    // Chat surface: the user text and the assistant reply (bullet differentiation).
    expect(out).toContain("Add a margin prop to the Button.");
    expect(out).toContain("⏺"); // the assistant bullet
    expect(out).toContain("Button now accepts the margin family.");
    // Timeline surface: the tool invocation + its result under the corner connector.
    expect(out).toContain("readFile");
    expect(out).toContain("⎿"); // the result-tree connector
    // The reasoning-only / tool-only parts produce NO chat bubble; the chat view
    // shows exactly the two text turns, so "Reading Button.tsx" (a reasoning
    // part) appears once, in the timeline.
    expect(out.split("Reading Button.tsx").length - 1).toBe(1);
  },
);
