import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// T3.2 wiring pillar (a): the stream demo is a human-runnable caller folding
// a scripted turn through the REAL useAgentStream hook.
it(
  "stream_example_renders_and_exits_cleanly_when_piped",
  { timeout: 30000 },
  () => {
    const out = execFileSync("pnpm", ["exec", "tsx", "examples/stream.tsx"], {
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
    expect(out).toContain("inspecting the failing test"); // thinking row
    expect(out).toContain("⏺"); // tool success glyph
    expect(out).toContain("All green now.");
    // M11: timeline header slot in a production caller.
    expect(out).toContain("Theo Stream");
    expect(out.indexOf("Theo Stream")).toBeLessThan(out.indexOf("inspecting")); // streamed final message
    // M16: the per-kind tool-detail cards render their shapes (SGR codes
    // sit between gutter and sign — strip before matching).
    // eslint-disable-next-line no-control-regex
    const plainOut = out.replace(/\u001B\[[0-9;]*m/g, "");
    expect(plainOut).toMatch(/\d+ \+ added retry/); // diff kind
    expect(plainOut).toContain("stderr:"); // output kind envelope label
    expect(plainOut).toMatch(/hidden/); // preview cap trailer (ToolResult tail-retention)
  },
);
