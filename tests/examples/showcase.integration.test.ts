import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { stripAnsi } from "../../src/format/ansi.js";

// Showcase smoke: the all-primitives example plays its scripted turn and
// exits cleanly when piped (ink7 single-final-frame contract) — one assert
// per composed surface, ANSI-stripped where SGR sits inside the shape.
it("showcase_example_renders_every_surface_when_piped", { timeout: 45000 }, () => {
  const out = execFileSync("pnpm", ["exec", "tsx", "examples/scenes/showcase.tsx"], {
    encoding: "utf8",
    timeout: 45000,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      FORCE_COLOR: "1",
    },
  });

  const plain = stripAnsi(out);
  // Banner (static path in pipes) — printed exactly once.
  expect(plain).toContain("Theo TUI Showcase");
  expect(plain.split("Theo TUI Showcase").length - 1).toBe(1);
  // Markdown reply: rendered shapes, not markers.
  expect(plain).not.toContain("**");
  expect(plain).not.toContain("```");
  expect(plain).toContain("const backoff = attempt * 250;");
  // Tool cards, one per kind.
  expect(plain).toMatch(/\d+ \+ const backoff = attempt \* 250;/); // diff
  expect(plain).toContain("stderr:"); // output envelope
  expect(plain).toMatch(/more lines/); // preview cap trailer
  // Metrics + status bar.
  expect(plain).toContain("% left");
  expect(plain).toContain("theo-demo-1");
  expect(plain).toContain("idle");
});
