import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Review F-tests-8: the TTFATT demo is the milestone's wiring pillar-a caller —
// a fresh non-TTY subprocess proves it renders all roles + the streamed reply
// and exits 0 (composer intentionally unmounted without a TTY — ADR D8).
describe("examples/chat.tsx (T4.2)", () => {
  it(
    "chat_example_streams_and_exits_cleanly_when_piped",
    { timeout: 30000 },
    () => {
      const out = execFileSync("pnpm", ["exec", "tsx", "examples/chat.tsx"], {
        encoding: "utf8",
        env: {
          PATH: process.env["PATH"] ?? "",
          HOME: process.env["HOME"] ?? "",
          FORCE_COLOR: "1",
        },
      });
      expect(out).toContain(">");
      expect(out).toContain("✦");
      expect(out).toContain("·");
      expect(out).toContain("appended in place.");
      // M11: banner in the header slot — present, ABOVE the thread, once.
      expect(out).toContain("Theo TUI");
      expect(out.indexOf("Theo TUI")).toBeLessThan(
        out.indexOf("What ships in M1?"),
      );
      // M13: the markdown assistant message renders SHAPES, not markers —
      // the fence CONTENT is present, the ** and ``` markers are not.
      expect(out).not.toContain("**");
      expect(out).not.toContain("```");
      expect(out).toContain("npm install @theokit/tui");
      expect(out).toContain("M1 highlights");
      const bannerCount = out.split("Theo TUI").length - 1;
      expect(bannerCount).toBe(1);
    },
  );
});
