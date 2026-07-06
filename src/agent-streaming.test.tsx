import { Box } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { AgentStreaming, formatElapsed } from "./agent-streaming.js";

/** cli-spinners `dots` frame[0] — deterministic at renderFrame's 0ms tick. */
const DOTS_FRAME_0 = "⠋";

describe("formatElapsed — pure helper (T2.1, ADR D4)", () => {
  it("format_elapsed_renders_seconds_under_a_minute", () => {
    expect(formatElapsed(0)).toBe("0s");
    expect(formatElapsed(59)).toBe("59s");
  });

  it("format_elapsed_renders_minutes_and_seconds", () => {
    expect(formatElapsed(60)).toBe("1m 0s");
    expect(formatElapsed(61)).toBe("1m 1s");
    expect(formatElapsed(125)).toBe("2m 5s");
  });

  it("format_elapsed_renders_hours", () => {
    expect(formatElapsed(3600)).toBe("1h 0m 0s");
    expect(formatElapsed(3661)).toBe("1h 1m 1s");
  });

  it("format_elapsed_rejects_negative_and_non_finite", () => {
    const call = () => formatElapsed(-1);
    expect(call).toThrow(TypeError);
    expect(call).toThrow("got -1");
    expect(() => formatElapsed(Number.NaN)).toThrow(TypeError);
    expect(() => formatElapsed(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it("format_elapsed_floors_fractional_seconds", () => {
    // EC-4: Date.now() diffs produce fractional seconds.
    expect(formatElapsed(59.9)).toBe("59s");
    expect(formatElapsed(60.2)).toBe("1m 0s");
  });

  it("format_elapsed_hour_cutoff_from_below", () => {
    // tests-5: off-by-one in the minutes<60 branch would yield "0h 59m 59s".
    expect(formatElapsed(3599)).toBe("59m 59s");
  });

  it("format_elapsed_has_no_days_unit", () => {
    // EC-11: pinned so nobody adds "1d" without an ADR.
    expect(formatElapsed(86400)).toBe("24h 0m 0s");
  });
});

describe("AgentStreaming — live indicator (T2.1, ADR D4)", () => {
  it("streaming_renders_spinner_and_default_thought", async () => {
    const frame = await renderFrame(<AgentStreaming />);
    expect(frame).toContain(DOTS_FRAME_0);
    expect(frame).toContain("Thinking…");
  });

  it("streaming_renders_thought_subject", async () => {
    const frame = await renderFrame(
      <AgentStreaming thought="Analyzing the failure" />,
    );
    expect(frame).toContain("Analyzing the failure");
    expect(frame).not.toContain("Thinking…");
  });

  it("streaming_suffix_exact_with_elapsed", async () => {
    const frame = await renderFrame(
      <AgentStreaming showCancelHint elapsedSeconds={125} />,
    );
    expect(frame).toContain("(esc to cancel, 2m 5s)");
  });

  it("streaming_suffix_exact_without_elapsed", async () => {
    const frame = await renderFrame(<AgentStreaming showCancelHint />);
    expect(frame).toContain("(esc to cancel)");
    expect(frame).not.toContain(",");
  });

  it("streaming_no_suffix_without_hint", async () => {
    const frame = await renderFrame(<AgentStreaming elapsedSeconds={5} />);
    expect(frame).not.toContain("esc to cancel");
    expect(frame).not.toContain("5s");
  });

  it("streaming_thought_with_newline_stays_single_line", async () => {
    const frame = await renderFrame(<AgentStreaming thought={"a\nb"} />);
    expect(frame.split("\n")).toHaveLength(1);
  });

  it("empty_thought_falls_back_to_default", async () => {
    // EC-3 resolved: || not ?? — a contentless thought renders the default.
    const frame = await renderFrame(<AgentStreaming thought="" />);
    expect(frame).toContain("Thinking…");
  });

  it("streaming_invalid_elapsed_throws_even_without_hint", () => {
    // tests-3: the boundary claim in the JSDoc, pinned — validation must not
    // be hint-gated (direct invocation, M0 EC-1 idiom).
    const call = () => AgentStreaming({ elapsedSeconds: -1 });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      "formatElapsed: seconds must be a finite number >= 0 — got -1",
    );
  });

  it("streaming_stays_one_line_at_narrow_width", async () => {
    // dom-frontend-1 regression: the suffix used to word-wrap at 30 cols.
    const frame = await renderFrame(
      <Box width={30}>
        <AgentStreaming
          thought="running the full suite again"
          showCancelHint
          elapsedSeconds={3723}
        />
      </Box>,
    );
    expect(frame.split("\n")).toHaveLength(1);
  });

  it("streaming_frame_matches_snapshot", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <AgentStreaming
          thought="Reading files"
          showCancelHint
          elapsedSeconds={12}
        />
      </Box>,
    );
    expect(frame).toMatchSnapshot("agent-streaming");
  });
});
