import { Text } from "ink";
import { render } from "ink-testing-library";
import { act } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { WelcomeBanner } from "./welcome-banner.js";
import type { WelcomeBannerProps } from "./welcome-banner.js";

// M12 T1.1 (plan m12-animated-banner, ADRs D1-D2): the animated-reveal
// oracle suite. Fake timers (the gemini useSnowfall precedent proves ink +
// vi.useFakeTimers determinism) + getter-shadow for isTTY/rows (house
// renderAtColumns idiom — itl's fake Stdout has NO isTTY, so the gate is
// closed by default and every static-era test above is untouched).

const REVEAL_PROPS: WelcomeBannerProps = {
  name: "Theo TUI",
  version: "1.0",
  tagline: "AI in your terminal",
  hints: ["h1 hint row"],
};

/** Mounts the banner with stdout getters shadowed BEFORE the banner's
 * first render: a probe element mounts first, the shadow lands on the
 * instance, and a keyed rerender remounts the banner so its mount-time
 * gate (D2 evaluate-once) sees the shadowed values. */
function mountGated(
  tty: { isTTY?: boolean; rows?: number },
  props: WelcomeBannerProps,
) {
  const instance = render(<Text>probe</Text>);
  Object.defineProperty(instance.stdout, "isTTY", {
    get: () => tty.isTTY ?? false,
    configurable: true,
  });
  Object.defineProperty(instance.stdout, "rows", {
    get: () => tty.rows ?? 30,
    configurable: true,
  });
  instance.rerender(<WelcomeBanner {...props} key="gated" />);
  return instance;
}

const TICK = 80;
const PHASES = 12;

describe("WelcomeBanner animated reveal (M12)", () => {
  // React requires an explicit opt-in for act() outside react-dom test
  // environments (ink has no test renderer preset).
  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("animated_under_non_tty_is_byte_identical_to_static", () => {
    // Oracle a (EC-3): two LIVE renders, never a recorded string.
    const a = render(<WelcomeBanner {...REVEAL_PROPS} animated />);
    const b = render(<WelcomeBanner {...REVEAL_PROPS} />);
    const identical = a.lastFrame() === b.lastFrame();
    expect(identical).toBe(true);
    expect(a.lastFrame()).toContain("h1 hint row");
    a.unmount();
    b.unmount();
  });

  it("reveal_converges_to_static_bytes", () => {
    // Oracle b: gate open, advance past the full script — byte-equal.
    vi.useFakeTimers();
    const animated = mountGated(
      { isTTY: true, rows: 30 },
      { ...REVEAL_PROPS, animated: true },
    );
    act(() => {
      vi.advanceTimersByTime(PHASES * TICK + TICK);
    });
    const staticRender = render(<WelcomeBanner {...REVEAL_PROPS} />);
    const identical = animated.lastFrame() === staticRender.lastFrame();
    expect(identical).toBe(true);
    animated.unmount();
    staticRender.unmount();
  });

  it("mid_reveal_frame_differs_from_final", () => {
    // Oracle c: an intermediate phase withholds content the final has.
    vi.useFakeTimers();
    const instance = mountGated(
      { isTTY: true, rows: 30 },
      { ...REVEAL_PROPS, animated: true },
    );
    act(() => {
      vi.advanceTimersByTime(3 * TICK);
    });
    const mid = instance.lastFrame() ?? "";
    expect(mid).not.toContain("h1 hint row");
    act(() => {
      vi.advanceTimersByTime(PHASES * TICK);
    });
    const final = instance.lastFrame() ?? "";
    expect(final).toContain("h1 hint row");
    expect(mid).not.toBe(final);
    instance.unmount();
  });

  it("reduced_motion_env_forces_static_path", () => {
    // Oracle d: THEOKIT_TUI_NO_MOTION (any non-empty value) wins.
    vi.useFakeTimers();
    vi.stubEnv("THEOKIT_TUI_NO_MOTION", "1");
    const instance = mountGated(
      { isTTY: true, rows: 30 },
      { ...REVEAL_PROPS, animated: true },
    );
    expect(instance.lastFrame()).toContain("h1 hint row");
    expect(vi.getTimerCount()).toBe(0);
    instance.unmount();
  });

  it("below_min_dims_renders_static_immediately", () => {
    // Oracle e (codex skip-below-breakpoint shape): rows below MIN.
    vi.useFakeTimers();
    const instance = mountGated(
      { isTTY: true, rows: 10 },
      { ...REVEAL_PROPS, animated: true },
    );
    expect(instance.lastFrame()).toContain("h1 hint row");
    expect(vi.getTimerCount()).toBe(0);
    instance.unmount();
  });

  it("unmount_mid_reveal_leaves_no_timers", () => {
    // Oracle f (EC-2): teardown mid-script — no dangling interval, no
    // React error AFTER unmount (the spy arms post-unmount: mount-time
    // act() advisories from itl's non-act render are environment noise,
    // not the teardown contract).
    vi.useFakeTimers();
    const instance = mountGated(
      { isTTY: true, rows: 30 },
      { ...REVEAL_PROPS, animated: true },
    );
    act(() => {
      vi.advanceTimersByTime(2 * TICK);
    });
    instance.unmount();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => {
      vi.advanceTimersByTime(PHASES * TICK);
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("mid_reveal_frame_matches_snapshot", () => {
    // M12 T2.1: the ONE new snapshot — a deterministic mid-reveal frame
    // (fake timers make phase 4 exact), anchored by the partial name.
    vi.useFakeTimers();
    const instance = mountGated(
      { isTTY: true, rows: 30 },
      { ...REVEAL_PROPS, animated: true },
    );
    act(() => {
      vi.advanceTimersByTime(4 * TICK);
    });
    const frame = instance.lastFrame() ?? "";
    // phase 4/12 of "Theo TUI" (8 chars) ⇒ ceil(8·4/12) = 3 chars shown.
    expect(frame).toContain("The");
    expect(frame).not.toContain("Theo TUI");
    expect(frame).toMatchSnapshot("banner-mid-reveal");
    instance.unmount();
  });

  it("gate_is_evaluated_once_dims_shrink_mid_reveal", () => {
    // Oracle g (D2 pin): dims shrinking mid-reveal do NOT abort the run.
    vi.useFakeTimers();
    const instance = mountGated(
      { isTTY: true, rows: 30 },
      { ...REVEAL_PROPS, animated: true },
    );
    act(() => {
      vi.advanceTimersByTime(3 * TICK);
    });
    Object.defineProperty(instance.stdout, "rows", {
      get: () => 5,
      configurable: true,
    });
    instance.rerender(<WelcomeBanner {...REVEAL_PROPS} animated key="gated" />);
    // Immediately after the shrink the reveal is STILL mid-flight (a
    // re-evaluated gate would snap to the full static frame here — this
    // assert kills that mutant).
    expect(instance.lastFrame()).not.toContain("h1 hint row");
    act(() => {
      vi.advanceTimersByTime(PHASES * TICK + TICK);
    });
    const staticRender = render(<WelcomeBanner {...REVEAL_PROPS} />);
    const identical = instance.lastFrame() === staticRender.lastFrame();
    expect(identical).toBe(true);
    instance.unmount();
    staticRender.unmount();
  });
});
