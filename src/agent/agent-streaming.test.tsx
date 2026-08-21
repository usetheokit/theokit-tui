import { Box, Text } from "ink";
import { render } from "ink-testing-library";
import type { ReactElement } from "react";
import { act } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderFrame } from "../../tests/fixtures/helpers.js";
import { formatElapsed } from "../format/format.js";
import { TheoTUIProvider } from "../theme/theme.js";
import { AgentStreaming } from "./agent-streaming.js";

/** The sparkle's static frame — motion is off in a non-TTY test env. */
const SPARKLE_FRAME_0 = "✳";

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
  it("streaming_renders_sparkle_and_default_thought", async () => {
    // #44: the working glyph is the Claude Code sparkle (✳), not a braille spinner.
    const frame = await renderFrame(<AgentStreaming />);
    expect(frame).toContain(SPARKLE_FRAME_0);
    expect(frame).not.toContain("⠋"); // no braille
    expect(frame).toContain("Thinking…");
  });

  it("streaming_renders_thought_subject", async () => {
    const frame = await renderFrame(<AgentStreaming thought="Analyzing the failure" />);
    expect(frame).toContain("Analyzing the failure");
    expect(frame).not.toContain("Thinking…");
  });

  it("streaming_suffix_exact_with_elapsed", async () => {
    const frame = await renderFrame(<AgentStreaming showCancelHint elapsedSeconds={125} />);
    expect(frame).toContain("(2m 5s · esc to interrupt)");
  });

  it("streaming_suffix_exact_without_elapsed", async () => {
    const frame = await renderFrame(<AgentStreaming showCancelHint />);
    expect(frame).toContain("(esc to interrupt)");
  });

  it("streaming_suffix_with_tokens_is_claude_code_shaped", async () => {
    // #1 Claude Code parity: `✳ Searching… (27s · 47k tokens · esc to interrupt)`.
    const frame = await renderFrame(
      <AgentStreaming thought="Searching" showCancelHint elapsedSeconds={27} tokens={47_000} />,
    );
    expect(frame).toContain("(27s · 47k tokens · esc to interrupt)");
  });

  it("token_direction_down_prefixes_a_down_arrow", async () => {
    // #44: `↓ 30.6k tokens` (context shrinking) / `↑` (growing).
    const frame = await renderFrame(
      <AgentStreaming showCancelHint tokens={30_600} tokenDirection="down" />,
    );
    expect(frame).toContain("↓ 30.6k tokens");
  });

  it("token_direction_up_prefixes_an_up_arrow", async () => {
    const frame = await renderFrame(
      <AgentStreaming showCancelHint tokens={47_000} tokenDirection="up" />,
    );
    expect(frame).toContain("↑ 47k tokens");
  });

  it("no_token_direction_renders_the_bare_count", async () => {
    const frame = await renderFrame(<AgentStreaming showCancelHint tokens={47_000} />);
    expect(frame).toContain("47k tokens");
    expect(frame).not.toContain("↓");
    expect(frame).not.toContain("↑");
  });

  it("streaming_no_suffix_without_hint", async () => {
    const frame = await renderFrame(<AgentStreaming elapsedSeconds={5} tokens={47_000} />);
    expect(frame).not.toContain("esc to interrupt");
    expect(frame).not.toContain("tokens");
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
    expect(call).toThrow("formatElapsed: seconds must be a finite number >= 0 — got -1");
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
        <AgentStreaming thought="Reading files" showCancelHint elapsedSeconds={12} />
      </Box>,
    );
    expect(frame).toMatchSnapshot("agent-streaming");
  });
});

// M6 T2.1: the spinner color follows theme.toolStatus.running.
describe("AgentStreaming — running token (M6 T2.1)", () => {
  it("spinner_color_follows_running_token", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={{ toolStatus: { running: { color: "cyan" } } }}>
        <AgentStreaming />
      </TheoTUIProvider>,
    );
    expect(frame).toContain("[36m");
  });
});

// Merged from agent-streaming.animated.test.tsx (ADR 0003): the qualifier segment
// said WHICH cases the file covered, not HOW it runs. That is a describe()
// block, and splitting it across files hid it from anyone reading the base.
const PHRASE_INTERVAL_MS = 2000;
const SHIMMER_PULSE_MS = 600;

/** Mount with stdout.isTTY shadowed BEFORE the streaming indicator's render, so
 * its per-render motion gate sees a real TTY. */
function mountGated(isTTY: boolean, node: ReactElement) {
  const instance = render(<Text>probe</Text>);
  Object.defineProperty(instance.stdout, "isTTY", {
    get: () => isTTY,
    configurable: true,
  });
  act(() => {
    instance.rerender(node);
  });
  return instance;
}

describe("AgentStreaming animation (M24 T5.1)", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // NOTE: ink-spinner runs its own animation timer, so getTimerCount() is never
  // 0 here — the oracle is BEHAVIOR: advance time and assert the phrase does (or
  // does not) change, which is what the phrase-cycler contract actually promises.

  it("static_without_phrases_does_not_cycle", () => {
    const instance = mountGated(true, <AgentStreaming thought="working" />);
    expect(instance.lastFrame()).toContain("working");
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS * 3));
    expect(instance.lastFrame()).toContain("working"); // unchanged (no opt-in)
    act(() => instance.unmount());
  });

  it("phrase_cycler_advances_round_robin_on_the_interval", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "");
    const instance = mountGated(
      true,
      <AgentStreaming phrases={["Thinking", "Cooking", "Reticulating"]} />,
    );
    expect(instance.lastFrame()).toContain("Thinking"); // phrase[0]
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS));
    expect(instance.lastFrame()).toContain("Cooking"); // phrase[1]
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS));
    expect(instance.lastFrame()).toContain("Reticulating"); // phrase[2]
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS));
    expect(instance.lastFrame()).toContain("Thinking"); // wraps round-robin
    act(() => instance.unmount());
  });

  it("does_not_cycle_when_NO_MOTION_is_set", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "1");
    const instance = mountGated(true, <AgentStreaming phrases={["Thinking", "Cooking"]} />);
    expect(instance.lastFrame()).toContain("Thinking"); // static first phrase
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS * 3));
    expect(instance.lastFrame()).toContain("Thinking"); // reduced-motion → no cycle
    expect(instance.lastFrame()).not.toContain("Cooking");
    act(() => instance.unmount());
  });

  it("does_not_cycle_on_a_non_tty", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "");
    const instance = mountGated(false, <AgentStreaming phrases={["Thinking", "Cooking"]} />);
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS * 3));
    expect(instance.lastFrame()).toContain("Thinking"); // piped → no cycle
    expect(instance.lastFrame()).not.toContain("Cooking");
    act(() => instance.unmount());
  });

  it("empty_phrases_falls_back_to_thinking", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "");
    const instance = mountGated(true, <AgentStreaming phrases={[]} />);
    expect(instance.lastFrame()).toContain("Thinking…");
    act(() => instance.unmount());
  });

  it("a_single_phrase_does_not_cycle", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "");
    const instance = mountGated(true, <AgentStreaming phrases={["Only one"]} />);
    expect(instance.lastFrame()).toContain("Only one");
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS * 3));
    expect(instance.lastFrame()).toContain("Only one"); // nothing to cycle
    act(() => instance.unmount());
  });

  // Shimmer oracle: dimColor emits the SGR `\x1b[2m`; without the cancel hint the
  // primary line is the only possible dim source, so its presence/absence pins the
  // pulse. (review HIGH-2 — shimmer shipped untested.)
  const DIM = "\x1b[2m";

  it("shimmer_pulses_the_primary_line_dim_under_a_tty", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "");
    const instance = mountGated(true, <AgentStreaming thought="working" shimmer />);
    expect(instance.lastFrame()).not.toContain(DIM); // on=false at mount
    act(() => vi.advanceTimersByTime(SHIMMER_PULSE_MS));
    expect(instance.lastFrame()).toContain(DIM); // pulsed on
    act(() => vi.advanceTimersByTime(SHIMMER_PULSE_MS));
    expect(instance.lastFrame()).not.toContain(DIM); // pulsed back off
    act(() => instance.unmount());
  });

  it("shimmer_never_dims_under_reduced_motion", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "1");
    const instance = mountGated(true, <AgentStreaming thought="working" shimmer />);
    act(() => vi.advanceTimersByTime(SHIMMER_PULSE_MS * 4));
    expect(instance.lastFrame()).not.toContain(DIM); // motion off → never pulses
    act(() => instance.unmount());
  });

  it("shimmer_does_not_dim_on_a_non_tty", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "");
    const instance = mountGated(false, <AgentStreaming thought="working" shimmer />);
    act(() => vi.advanceTimersByTime(SHIMMER_PULSE_MS * 4));
    expect(instance.lastFrame()).not.toContain(DIM); // piped → never pulses
    act(() => instance.unmount());
  });
});
