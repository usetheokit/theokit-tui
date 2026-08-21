import { Text } from "ink";
import { render } from "ink-testing-library";
import { act } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useTurnElapsed } from "./use-turn-elapsed.js";

// M14 T1.1 (plan m14-status-bar, ADR D2): the turn-elapsed driver script —
// fake timers (M12 idiom). The hook is the lib-shipped ticking source for
// AgentStreaming.elapsedSeconds; AgentStreaming itself stays timer-free
// (its M3 contract, untouched).

function Probe({ active }: { active: boolean }) {
  const elapsed = useTurnElapsed(active);
  return <Text>{`elapsed:${elapsed}`}</Text>;
}

/** act-wrapped mount — itl's render fires the hook effect outside act
 * otherwise (review r2-F6: stderr noise masks real warnings). */
function mountProbe(active: boolean) {
  let instance!: ReturnType<typeof render>;
  act(() => {
    instance = render(<Probe active={active} />);
  });
  return instance;
}

describe("useTurnElapsed (M14 T1.1)", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("inactive_renders_zero", () => {
    vi.useFakeTimers();
    const instance = mountProbe(false);
    expect(instance.lastFrame()).toContain("elapsed:0");
    expect(vi.getTimerCount()).toBe(0);
    instance.unmount();
  });

  it("active_ticks_once_per_second", () => {
    vi.useFakeTimers();
    const instance = mountProbe(true);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(instance.lastFrame()).toContain("elapsed:3");
    instance.unmount();
  });

  it("deactivation_freezes_then_reactivation_resets", () => {
    // EC-2: turn 2 starts at 0 — never where turn 1 stopped.
    vi.useFakeTimers();
    const instance = mountProbe(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(instance.lastFrame()).toContain("elapsed:5");
    act(() => {
      instance.rerender(<Probe active={false} />);
    });
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(instance.lastFrame()).toContain("elapsed:0"); // inactive === 0
    act(() => {
      instance.rerender(<Probe active={true} />);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(instance.lastFrame()).toContain("elapsed:2");
    expect(instance.lastFrame()).not.toContain("elapsed:7");
    instance.unmount();
  });

  it("unmount_mid_turn_leaves_no_timers", () => {
    vi.useFakeTimers();
    const instance = mountProbe(true);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    instance.unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rapid_toggle_does_not_leak_intervals", () => {
    vi.useFakeTimers();
    const instance = mountProbe(true);
    act(() => {
      instance.rerender(<Probe active={false} />);
    });
    act(() => {
      instance.rerender(<Probe active={true} />);
    });
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      instance.rerender(<Probe active={false} />);
    });
    expect(vi.getTimerCount()).toBe(0);
    instance.unmount();
  });
});
