import { describe, expect, it } from "vitest";

import { CostMeter } from "./cost-meter.js";
import { renderFrame } from "../../tests/fixtures/helpers.js";
import { stripAnsi } from "../format/ansi.js";

// T2.3 (plan m5-metrics-surface, ADRs D2/D3): honest cost display.
describe("CostMeter", () => {
  it("renders_approx_cost_by_default", async () => {
    const frame = await renderFrame(<CostMeter costUsd={1.234} />);
    expect(stripAnsi(frame)).toContain("cost ~$1.23");
  });

  it("approx_false_drops_marker", async () => {
    const frame = await renderFrame(
      <CostMeter costUsd={1.234} approx={false} />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("cost $1.23");
    expect(plain).not.toContain("~");
  });

  it("sub_cent_never_renders_zero_dollars", async () => {
    const frame = await renderFrame(<CostMeter costUsd={0.004} />);
    const plain = stripAnsi(frame);
    expect(plain).toContain("<$0.01");
    expect(plain).not.toContain("$0.00");
  });

  it("zero_renders_exact_zero", async () => {
    const frame = await renderFrame(<CostMeter costUsd={0} />);
    const plain = stripAnsi(frame);
    expect(plain).toContain("$0.00");
    expect(plain).not.toContain("~");
  });

  it("snapshot_cost_meter", async () => {
    const frame = await renderFrame(<CostMeter costUsd={1234.5} />);
    expect(stripAnsi(frame)).toContain("~$1,234.50");
    expect(frame).toMatchSnapshot("cost-meter");
  });

  it("invalid_cost_throws_typed", () => {
    expect(() => CostMeter({ costUsd: -0.01 })).toThrow(TypeError);
    expect(() => CostMeter({ costUsd: -0.01 })).toThrow(
      "CostMeter: costUsd must be a finite number >= 0",
    );
    expect(() => CostMeter({ costUsd: Number.NaN })).toThrow(TypeError);
  });
});
