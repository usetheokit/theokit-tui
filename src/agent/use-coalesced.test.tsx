import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCoalesced } from "./use-coalesced.js";

afterEach(cleanup);

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** A clock the test owns, so nothing here depends on wall time. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 1000;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}

function Probe({
  compute,
  value,
  windowMs,
  now,
  screenReader,
}: {
  compute: () => string;
  value: unknown;
  windowMs: number;
  now: () => number;
  screenReader?: boolean;
}) {
  const shown = useCoalesced(compute, value, {
    windowMs,
    now,
    ...(screenReader === undefined ? {} : { screenReader }),
  });
  return <Text>{shown}</Text>;
}

// B-009 (plan b009-frame-budget-hook, ADRs D1-D4): coalescing bound to the existing budget.
describe("useCoalesced", () => {
  it("changes_inside_one_window_produce_one_recomputation", async () => {
    const clock = fakeClock();
    const compute = vi.fn(() => "v");
    const app = render(
      <Probe compute={compute} value={1} windowMs={100} now={clock.now} />,
    );
    await tick();
    app.rerender(
      <Probe compute={compute} value={2} windowMs={100} now={clock.now} />,
    );
    app.rerender(
      <Probe compute={compute} value={3} windowMs={100} now={clock.now} />,
    );
    await tick();
    // The clock never advanced, so every change fell inside the first window.
    expect(compute).toHaveBeenCalledTimes(1);
  });

  // D4 / EC-1 — a budget created during render is NEW every render, its `lastPaintAt` is always
  // undefined, and `shouldPaintNow` therefore always returns true. The throttle would silently do
  // nothing, and a single-render test could not tell. This needs two renders to fail.
  it("the_budget_survives_a_rerender_and_still_coalesces", async () => {
    const clock = fakeClock();
    const compute = vi.fn(() => "v");
    const app = render(
      <Probe compute={compute} value={1} windowMs={100} now={clock.now} />,
    );
    await tick();
    clock.advance(10);
    app.rerender(
      <Probe compute={compute} value={2} windowMs={100} now={clock.now} />,
    );
    await tick();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  // D4 / EC-2 — callers pass an inline arrow, whose identity changes every render. Keying on it
  // would recompute every render, which is no throttle at all.
  it("a_new_compute_identity_with_an_unchanged_key_does_not_recompute", async () => {
    const clock = fakeClock();
    let calls = 0;
    const app = render(
      <Probe
        compute={() => {
          calls += 1;
          return "a";
        }}
        value={1}
        windowMs={100}
        now={clock.now}
      />,
    );
    await tick();
    app.rerender(
      <Probe
        compute={() => {
          calls += 1;
          return "b";
        }}
        value={1}
        windowMs={100}
        now={clock.now}
      />,
    );
    await tick();
    expect(calls).toBe(1);
  });

  it("screen_reader_mode_passes_every_update_through", async () => {
    const clock = fakeClock();
    const compute = vi.fn(() => "v");
    const app = render(
      <Probe
        compute={compute}
        value={1}
        windowMs={100}
        now={clock.now}
        screenReader
      />,
    );
    await tick();
    app.rerender(
      <Probe
        compute={compute}
        value={2}
        windowMs={100}
        now={clock.now}
        screenReader
      />,
    );
    await tick();
    // Coalescing drops intermediate states, which is exactly what a screen reader must announce.
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("a_zero_window_never_coalesces", async () => {
    const clock = fakeClock();
    const compute = vi.fn(() => "v");
    const app = render(
      <Probe compute={compute} value={1} windowMs={0} now={clock.now} />,
    );
    await tick();
    app.rerender(
      <Probe compute={compute} value={2} windowMs={0} now={clock.now} />,
    );
    await tick();
    expect(compute).toHaveBeenCalledTimes(2);
  });

  // D3 — coalescing without a trailing update drops the LAST change in a window: the final token
  // of a stream, the closing state of a turn. Everything looks right until the stream stops.
  it("the_last_change_is_delivered_by_a_trailing_update", async () => {
    const clock = fakeClock();
    const app = render(
      <Probe compute={() => "first"} value={1} windowMs={20} now={clock.now} />,
    );
    await tick();
    app.rerender(
      <Probe compute={() => "last"} value={2} windowMs={20} now={clock.now} />,
    );
    // Nothing further arrives; only the trailing update can deliver "last".
    clock.advance(30);
    await new Promise((r) => setTimeout(r, 40));
    expect(app.lastFrame()).toContain("last");
  });
});
