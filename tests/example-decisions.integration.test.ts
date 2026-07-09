import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// M23 T4.1 wiring pillar (a): the decision round-trip demo is a human-runnable
// caller. Piped stdout is a non-TTY environment — the example prints the first
// decision frame (ApprovalPrompt composing a DiffViewer preview + the
// once/always/reject choice bar) and exits cleanly (ADR-D8-style non-TTY exit).
describe("examples/decisions.tsx (T4.1)", () => {
  it(
    "decisions_example_renders_the_first_surface_and_exits_cleanly_when_piped",
    { timeout: 30000 },
    () => {
      const out = execFileSync(
        "pnpm",
        ["exec", "tsx", "examples/decisions.tsx"],
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
      // ApprovalPrompt title + the composed DiffViewer preview (no forwarded
      // patch prop — the app composes the child).
      expect(out).toContain("Apply this edit?");
      expect(out).toContain("retries: 5"); // the diff rendered inside the approval
      // The once/always/reject choice bar (default triad) with its active marker.
      expect(out).toContain("Allow once");
      expect(out).toContain("Allow always");
      expect(out).toContain("Reject");
      expect(out).toContain("❯"); // the active-choice marker survives
    },
  );
});
