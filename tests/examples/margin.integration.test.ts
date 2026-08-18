import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// Wiring smoke for the universal-margin example: it applies the margin family to
// several components between two markers. Piped stdout is the non-TTY scene.
it(
  "margin_example_shows_the_margin_family_when_piped",
  { timeout: 30000 },
  () => {
    const out = execFileSync(
      "pnpm",
      ["exec", "tsx", "examples/renderer/margin.tsx"],
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
    // Operate on the RAW output — margin adds spacing/indent at the line START,
    // outside the colored text, so no ANSI stripping is needed.
    const lines = out.split("\n");
    expect(out).toContain("top marker");
    expect(out).toContain("bottom marker");
    // Content of each demoed component renders.
    expect(out).toContain("cost");
    expect(out).toContain("wired");
    expect(out).toContain("Theo");
    // marginLeft={4} on CostMeter: the cost line starts indented four columns
    // (the four spaces precede the text's color codes).
    const costLine = lines.find((l) => l.includes("cost"));
    expect(costLine?.startsWith("    ")).toBe(true);
    // marginTop={1} on CostMeter: a blank line sits between the top marker and it.
    const iMarker = lines.findIndex((l) => l.includes("top marker"));
    expect(lines[iMarker + 1]?.trim()).toBe("");
  },
);
