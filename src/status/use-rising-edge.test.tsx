import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRisingEdge } from "./use-rising-edge.js";

afterEach(cleanup);

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** A caller's own vocabulary — the hook must not know these words. */
const LEVELS = ["calm", "busy", "urgent"] as const;

function Probe({
  level,
  onRise,
  levels = LEVELS,
}: {
  level: string;
  onRise: (l: string) => void;
  levels?: readonly string[];
}) {
  useRisingEdge(level, levels, onRise);
  return <Text>{level}</Text>;
}

// B-011 (plan b011-rising-edge, ADRs D1-D3): fire only when it gets worse.
describe("useRisingEdge", () => {
  it("a_rise_fires_once_and_a_repeat_fires_nothing", async () => {
    const onRise = vi.fn();
    const app = render(<Probe level="calm" onRise={onRise} />);
    await tick();
    app.rerender(<Probe level="urgent" onRise={onRise} />);
    await tick();
    app.rerender(<Probe level="urgent" onRise={onRise} />);
    await tick();
    expect(onRise).toHaveBeenCalledTimes(1);
    expect(onRise).toHaveBeenCalledWith("urgent");
  });

  it("the_first_observed_level_never_fires", async () => {
    const onRise = vi.fn();
    // Even starting at the WORST level: there is no previous level to have risen from, and firing
    // here would warn about a state the user has not entered.
    render(<Probe level="urgent" onRise={onRise} />);
    await tick();
    expect(onRise).not.toHaveBeenCalled();
  });

  it("a_fall_fires_nothing_and_a_later_rise_fires_again", async () => {
    const onRise = vi.fn();
    const app = render(<Probe level="calm" onRise={onRise} />);
    await tick();
    app.rerender(<Probe level="urgent" onRise={onRise} />);
    await tick();
    // Recovery is good news and needs no announcement — announcing it trains the user to dismiss
    // the channel the bad news arrives on.
    app.rerender(<Probe level="calm" onRise={onRise} />);
    await tick();
    expect(onRise).toHaveBeenCalledTimes(1);
    // Re-arming: a problem that comes back must be visible again.
    app.rerender(<Probe level="urgent" onRise={onRise} />);
    await tick();
    expect(onRise).toHaveBeenCalledTimes(2);
  });

  it("a_skipped_level_still_fires_once", async () => {
    const onRise = vi.fn();
    const app = render(<Probe level="calm" onRise={onRise} />);
    await tick();
    app.rerender(<Probe level="urgent" onRise={onRise} />);
    await tick();
    expect(onRise).toHaveBeenCalledTimes(1);
  });

  // D2 / EC-1 — validated in the RENDER body, so the throw is synchronous. React does not surface
  // an effect throw as a rejection: measured on B-001, where renderFrame resolved with an EMPTY
  // frame. A test against an effect throw would pass vacuously, which is the silent failure this
  // ADR exists to prevent.
  it("an_unknown_level_throws_naming_the_hook", () => {
    expect(() =>
      Probe({ level: "catastrophic", onRise: () => undefined }),
    ).toThrow(TypeError);
    expect(() =>
      Probe({ level: "catastrophic", onRise: () => undefined }),
    ).toThrow('useRisingEdge: level "catastrophic" is not in the ordering');
  });

  it("an_inline_callback_does_not_cause_a_repeat_fire", async () => {
    let calls = 0;
    const app = render(
      <Probe
        level="calm"
        onRise={() => {
          calls += 1;
        }}
      />,
    );
    await tick();
    app.rerender(
      <Probe
        level="urgent"
        onRise={() => {
          calls += 1;
        }}
      />,
    );
    await tick();
    // A fresh arrow every render must not re-run the effect.
    app.rerender(
      <Probe
        level="urgent"
        onRise={() => {
          calls += 1;
        }}
      />,
    );
    await tick();
    expect(calls).toBe(1);
  });

  // EC-2 — callers pass an array literal, which is a new array every render.
  it("a_fresh_ordering_array_with_the_same_levels_does_not_refire", async () => {
    const onRise = vi.fn();
    const app = render(
      <Probe
        level="calm"
        onRise={onRise}
        levels={["calm", "busy", "urgent"]}
      />,
    );
    await tick();
    app.rerender(
      <Probe
        level="urgent"
        onRise={onRise}
        levels={["calm", "busy", "urgent"]}
      />,
    );
    await tick();
    app.rerender(
      <Probe
        level="urgent"
        onRise={onRise}
        levels={["calm", "busy", "urgent"]}
      />,
    );
    await tick();
    expect(onRise).toHaveBeenCalledTimes(1);
  });
});
