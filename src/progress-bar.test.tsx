import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { ProgressBar } from "./progress-bar.js";

const strip = (v: string): string =>
  // Full ANSI strip incl. ESC, so adjacent color runs (filled + empty) join.
  // eslint-disable-next-line no-control-regex
  v.replace(/\[[0-9;]*m/g, "");

describe("ProgressBar", () => {
  it("renders_filled_and_empty_cells_plus_the_percent_label", async () => {
    const frame = strip(
      await renderFrame(<ProgressBar percent={50} width={10} />),
    );
    // 50% of 10 cells = 5 filled + 5 empty, then " 50%".
    expect(frame).toContain("█████░░░░░ 50%");
  });

  it("zero_percent_is_all_empty", async () => {
    const frame = strip(
      await renderFrame(<ProgressBar percent={0} width={8} />),
    );
    expect(frame).toContain("░░░░░░░░ 0%");
  });

  it("hundred_percent_is_all_filled", async () => {
    const frame = strip(
      await renderFrame(<ProgressBar percent={100} width={8} />),
    );
    expect(frame).toContain("████████ 100%");
  });

  it("clamps_out_of_range_percent", async () => {
    const over = strip(
      await renderFrame(<ProgressBar percent={150} width={4} />),
    );
    expect(over).toContain("████ 100%");
    const under = strip(
      await renderFrame(<ProgressBar percent={-20} width={4} />),
    );
    expect(under).toContain("░░░░ 0%");
  });

  it("show_percent_false_hides_the_label", async () => {
    const frame = strip(
      await renderFrame(
        <ProgressBar percent={50} width={4} showPercent={false} />,
      ),
    );
    expect(frame).not.toContain("%");
  });

  it("accepts_custom_fill_and_empty_chars", async () => {
    const frame = strip(
      await renderFrame(
        <ProgressBar percent={50} width={4} fullChar="━" emptyChar="╱" />,
      ),
    );
    expect(frame).toContain("━━╱╱");
  });

  it("invalid_percent_throws_typed_error", () => {
    expect(() =>
      // @ts-expect-error — deliberately invalid (negative case)
      ProgressBar({ percent: "nope" }),
    ).toThrow(TypeError);
  });

  it("accepts_margin_props", async () => {
    const raw = await renderFrame(<ProgressBar percent={50} marginTop={2} />);
    expect(raw.split("\n")[0]?.trim()).toBe("");
  });
});
