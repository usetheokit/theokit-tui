import { Text } from "ink";
import { render } from "ink-testing-library";
import type { ReactElement } from "react";
import { act } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AgentStreaming } from "./agent-streaming.js";

// M24 T5.1 — the AgentStreaming phrase-cycler / shimmer opt-ins (blueprint ADR
// D7). Fake-timer oracles + an isTTY getter-shadow (itl's fake Stdout has no
// isTTY, so the motion gate is closed by default). Deterministic round-robin (not
// random), gated on `isMotionEnabled`; byte-identical for callers who pass no
// opt-in; zero timers when reduced-motion is on.

const PHRASE_INTERVAL_MS = 2000;

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
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
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
    const instance = mountGated(
      true,
      <AgentStreaming phrases={["Thinking", "Cooking"]} />,
    );
    expect(instance.lastFrame()).toContain("Thinking"); // static first phrase
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS * 3));
    expect(instance.lastFrame()).toContain("Thinking"); // reduced-motion → no cycle
    expect(instance.lastFrame()).not.toContain("Cooking");
    act(() => instance.unmount());
  });

  it("does_not_cycle_on_a_non_tty", () => {
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "");
    const instance = mountGated(
      false,
      <AgentStreaming phrases={["Thinking", "Cooking"]} />,
    );
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
    const instance = mountGated(
      true,
      <AgentStreaming phrases={["Only one"]} />,
    );
    expect(instance.lastFrame()).toContain("Only one");
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS * 3));
    expect(instance.lastFrame()).toContain("Only one"); // nothing to cycle
    act(() => instance.unmount());
  });
});
