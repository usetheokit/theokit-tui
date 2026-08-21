import { describe, expect, it } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
import { stripAnsi } from "../format/ansi.js";
import { ProgressActivity } from "./progress-activity.js";

describe("ProgressActivity (compaction-style progress)", () => {
  it("reproduces_the_two_line_compaction_look", async () => {
    // ✳ Compacting conversation… (7m 3s · ↑ 24.6k tokens)
    // ██░░… 10%
    const frame = stripAnsi(
      await renderFrame(
        <ProgressActivity
          label="Compacting conversation…"
          percent={10}
          elapsedSeconds={423}
          tokens={24_600}
          tokenDirection="up"
        />,
      ),
    );
    const lines = frame.split("\n").filter((l) => l.trim() !== "");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("✳");
    expect(lines[0]).toContain("Compacting conversation…");
    expect(lines[0]).toContain("(7m 3s · ↑ 24.6k tokens)");
    expect(lines[1]).toContain("10%");
  });

  it("meta_is_optional", async () => {
    const frame = stripAnsi(await renderFrame(<ProgressActivity label="Indexing…" percent={0} />));
    const lines = frame.split("\n").filter((l) => l.trim() !== "");
    expect(lines[0]).toContain("Indexing…");
    expect(lines[0]).not.toContain("(");
    expect(lines[1]).toContain("0%");
  });

  it("down_arrow_for_shrinking_context", async () => {
    const frame = stripAnsi(
      await renderFrame(
        <ProgressActivity label="Compacting…" percent={50} tokens={12_000} tokenDirection="down" />,
      ),
    );
    expect(frame).toContain("↓ 12k tokens");
  });

  it("invalid_tokens_throws_typed_error", () => {
    expect(() => ProgressActivity({ label: "x", percent: 0, tokens: -1 })).toThrow(TypeError);
  });

  it("accepts_margin_props", async () => {
    const raw = await renderFrame(<ProgressActivity label="x" percent={0} marginTop={2} />);
    expect(raw.split("\n")[0]?.trim()).toBe("");
  });
});
