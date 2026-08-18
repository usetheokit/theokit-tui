import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";

import { renderFrame } from "./helpers.js";

// B-020 T1.1 — a frame assertion must not depend on the wall clock.
//
// THE DEFECT. `renderFrame` awaited `setTimeout(resolve, 0)` and then read the frame, and its own
// docstring named what that rests on: the 0 ms tick had to land BEFORE ink-spinner's first ~80 ms
// interval. `setTimeout(0)` does not fire in 0 ms — it fires when the event loop reaches it — so
// under contention the animation advances first.
//
// Measured 2026-08-18: `npm test` at default workers failed 3 files under load 13-24, and a
// different single file on another run, while `--maxWorkers=2` on an idle machine passed
// 145/1564. Each failing file passed in isolation and the failing SET differed between runs: the
// signature of a race, not of a defect in any one test.
//
// WHAT THIS FILE DOES NOT DO, stated because the first draft tried and failed. It does not
// reproduce the race synchronously. Blocking the event loop after `render()` does NOT reproduce
// it: the pending `setTimeout(0)` expired earlier than the 80 ms interval, so node's timers phase
// runs it first no matter how long the block lasted. The real trigger is the worker PROCESS being
// descheduled by the OS, during which real time passes and the loop is free to service the
// interval — which cannot be forced from inside the process being descheduled. Recording that is
// better than shipping a test that appears to reproduce a race and actually reproduces nothing.
//
// WHAT IT ASSERTS INSTEAD is the invariant that makes the race impossible: the frame is produced
// under FROZEN time. Under the old helper this is false, so the mutation gate holds — reverting to
// `setTimeout(0)` turns this red — and unlike a load-dependent test it fails the same way on every
// machine.

/** Records whether time was frozen at the moment ink rendered it. */
let frozenDuringRender: boolean | undefined;

function TimeProbe(): React.ReactElement {
  frozenDuringRender = vi.isFakeTimers();
  return <Text>probe</Text>;
}

describe("renderFrame determinism (B-020 T1.1)", () => {
  it("test_the_frame_is_produced_under_frozen_time", async () => {
    frozenDuringRender = undefined;
    const frame = await renderFrame(<TimeProbe />);

    expect(frame).toContain("probe");
    // The property every one of the 35 callers silently relies on: nothing animated can advance
    // between render and read, because no time passes.
    expect(frozenDuringRender).toBe(true);
  });

  it("test_real_timers_are_restored_after_the_helper_returns", async () => {
    await renderFrame(<Text>plain</Text>);
    // A helper that left fake timers installed would corrupt every test running after it in the
    // same file — a failure mode worse than the one being fixed.
    expect(vi.isFakeTimers()).toBe(false);
  });

  it("test_real_timers_are_restored_even_when_the_render_throws", async () => {
    function Boom(): React.ReactElement {
      throw new TypeError("Boom: deliberate");
    }

    await renderFrame(<Boom />).catch(() => {
      // ink's ErrorBoundary may surface this; either way the helper must have cleaned up.
    });

    expect(vi.isFakeTimers()).toBe(false);
  });
});
