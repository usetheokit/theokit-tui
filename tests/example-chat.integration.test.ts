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
    },
  );
});
