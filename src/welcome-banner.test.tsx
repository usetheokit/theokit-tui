import { Box, Text } from "ink";
import { readFileSync } from "node:fs";
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

import { TheoTUIProvider, themes } from "./theme.js";
import { WelcomeBanner } from "./welcome-banner.js";
import type { WelcomeBannerProps } from "./welcome-banner.js";

// T1.1 (plan m9-welcome-banner, ADRs D1-D5): the banner unit suite — house
// static-component shape (boundary pairs, width sweep, batched snapshots,
// typed negatives, token assert) per blueprint Corner 1.

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001B\[[0-9;]*m/g;
const stripAnsi = (value: string): string => value.replace(ANSI_RE, "");

const nonEmptyLines = (frame: string): string[] =>
  stripAnsi(frame)
    .split("\n")
    .filter((line) => line.trim() !== "");

function renderBanner(props: WelcomeBannerProps): string {
  const instance = render(<WelcomeBanner {...props} />);
  const frame = instance.lastFrame() ?? "";
  instance.unmount();
  return frame;
}

/** EC-2 harness: ink-testing-library hard-codes columns=100 via a
 * PROTOTYPE getter on its fake Stdout — an own-property getter on the
 * instance shadows it, and a rerender re-reads it (useStdout hands the
 * same instance to the component). */
function renderAtColumns(columns: number, props: WelcomeBannerProps): string {
  const instance = render(<WelcomeBanner {...props} />);
  Object.defineProperty(instance.stdout, "columns", {
    get: () => columns,
  });
  instance.rerender(<WelcomeBanner {...props} key="recolumned" />);
  const frame = instance.lastFrame() ?? "";
  instance.unmount();
  return frame;
}

function catchError(run: () => void): Error {
  try {
    run();
  } catch (thrown) {
    return thrown as Error;
  }
  throw new Error("expected a throw");
}

describe("WelcomeBanner", () => {
  it("banner_renders_name_version_tagline_hints", () => {
    const frame = renderBanner({
      name: "Theo",
      version: "1.0.0",
      tagline: "AI in your terminal",
      hints: ["/help for commands", "esc to cancel"],
    });
    expect(frame).toContain("Theo");
    expect(frame).toContain("v1.0.0");
    expect(frame).toContain("AI in your terminal");
    expect(frame).toContain("/help for commands");
    expect(frame).toContain("esc to cancel");
    // Review F1: the hints margin gap is BEHAVIOR, not just a snapshot pin —
    // exactly one blank content row sits between the tagline and the first
    // hint (the marginTop={1} line renders as a border-only row).
    const rawLines = stripAnsi(frame).split("\n");
    const taglineIdx = rawLines.findIndex((l) => l.includes("AI in your"));
    const hintIdx = rawLines.findIndex((l) => l.includes("/help"));
    expect(hintIdx - taglineIdx).toBe(2);
    const gapRow = rawLines[taglineIdx + 1] ?? "";
    expect(gapRow.replace(/[│\s]/g, "")).toBe("");
  });

  it("version_absent_renders_no_vundefined_and_no_empty_meta_line", () => {
    const frame = renderBanner({ name: "Theo" });
    expect(frame).not.toContain("vundefined");
    // top border, name row, bottom border — nothing else (EC-11).
    const lines = nonEmptyLines(frame);
    expect(lines).toHaveLength(3);
  });

  it("hints_empty_array_renders_zero_lines_and_zero_margin_gap", () => {
    // EC-8: [] must be byte-identical to undefined — no line, no margin gap.
    const rawEmpty = renderBanner({ name: "T", hints: [] });
    const rawUndef = renderBanner({ name: "T" });
    expect(rawEmpty).toBe(rawUndef);
    const withEmpty = nonEmptyLines(rawEmpty);
    const withUndef = nonEmptyLines(rawUndef);
    expect(withEmpty).toEqual(withUndef);
  });

  it("tagline_splits_on_newline_one_text_per_line", () => {
    const frame = renderBanner({ name: "T", tagline: "line one\nline two" });
    expect(frame).toContain("line one");
    expect(frame).toContain("line two");
    // border ×2 + name + 2 tagline lines
    const lines = nonEmptyLines(frame);
    expect(lines).toHaveLength(5);
  });

  it("children_render_inside_the_box", () => {
    const instance = render(
      <WelcomeBanner name="T">
        <Text>extra row</Text>
      </WelcomeBanner>,
    );
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(frame).toContain("extra row");
    const lines = nonEmptyLines(frame);
    // child row sits BEFORE the bottom border line.
    const childIndex = lines.findIndex((line) => line.includes("extra row"));
    expect(childIndex).toBe(lines.length - 2);
  });

  it("width_floor_boundary_pair_border_at_24_plain_at_23", () => {
    // Under the DEFAULT theme (provider-less fallback — EC-6).
    const at = renderAtColumns(24, { name: "Theo", version: "1.0.0" });
    expect(at).toContain("╭");
    const below = renderAtColumns(23, { name: "Theo", version: "1.0.0" });
    expect(below).not.toContain("╭");
    expect(below).not.toContain("│");
    expect(below).toContain("Theo v1.0.0");
    // Review F2: the plain rung TRUNCATES too — a long name must not exceed
    // columns nor wrap into extra rows.
    const longFloor = renderAtColumns(23, { name: "A".repeat(80) });
    const floorLines = nonEmptyLines(longFloor);
    expect(floorLines).toHaveLength(1);
    expect((floorLines[0] ?? "").length).toBeLessThanOrEqual(23);
  });

  it("width_matrix_lines_fit", () => {
    const longProps: WelcomeBannerProps = {
      name: "A very long product name for the matrix",
      version: "10.20.30",
      tagline: "a tagline that is long enough to threaten the budget",
      hints: ["a very long hint row that must never exceed the width"],
    };
    for (const cols of [60, 40, 24]) {
      const frame = renderAtColumns(cols, longProps);
      for (const line of stripAnsi(frame).split("\n")) {
        expect(line.length, `cols=${cols} line="${line}"`).toBeLessThanOrEqual(
          cols,
        );
      }
    }
  });

  it("width_clamps_at_60_on_wide_terminals", () => {
    const frame = renderAtColumns(120, { name: "T" });
    const top = stripAnsi(frame).split("\n")[0] ?? "";
    expect(top.length).toBe(60);
  });

  it("long_name_truncates_never_wraps", () => {
    const frame = renderAtColumns(30, { name: "A".repeat(80) });
    expect(nonEmptyLines(frame)).toHaveLength(3);
    // The composed nested-Text line truncates as ONE unit (EC-4).
    const withVersion = renderAtColumns(30, {
      name: "A".repeat(80),
      version: "1.0.0",
    });
    expect(nonEmptyLines(withVersion)).toHaveLength(3);
  });

  it("monochrome_theme_switches_border_to_single", () => {
    // D3/EC-4 — data-driven, never env.
    const mono = render(
      <TheoTUIProvider theme={themes["no-color"]}>
        <WelcomeBanner name="T" />
      </TheoTUIProvider>,
    );
    const monoFrame = mono.lastFrame() ?? "";
    mono.unmount();
    expect(monoFrame).toContain("┌");
    expect(monoFrame).not.toContain("╭");

    const color = render(<WelcomeBanner name="T" />);
    const colorFrame = color.lastFrame() ?? "";
    color.unmount();
    expect(colorFrame).toContain("╭");
    expect(colorFrame).not.toContain("┌");
  });

  it("accent_token_paints_name_and_border", () => {
    const instance = render(
      <TheoTUIProvider theme={{ accent: "magenta" }}>
        <WelcomeBanner name="T" />
      </TheoTUIProvider>,
    );
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(frame).toContain("\u001B[35m");
  });

  it("no_color_frame_contains_zero_color_class_sgr", () => {
    // EC-1 absorbed: SGR 1/2/22 styling codes ARE emitted in-process under
    // FORCE_COLOR=1 (chalk.bold at level 1) and tolerated; TRUE zero-ANSI is
    // proven by the degrade-matrix subprocess at chalk level 0.
    const instance = render(
      <TheoTUIProvider theme={themes["no-color"]}>
        <WelcomeBanner
          name="T"
          version="1.0.0"
          tagline="tag"
          hints={["hint"]}
        />
      </TheoTUIProvider>,
    );
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    // eslint-disable-next-line no-control-regex
    const colorSgr = /\u001B\[(?:3[0-8]|4[0-8]|9[0-7]|10[0-7])[;m]/;
    expect(frame).not.toMatch(colorSgr);
  });

  it("invalid_props_throw_typed_errors", () => {
    const bad: WelcomeBannerProps[] = [
      { name: "" },
      { name: "   " },
      { name: "a\nb" },
      { name: "T", version: "1\n2" },
      { name: "T", hints: ["ok", "bad\nhint"] },
      { name: "T", hints: [""] },
    ];
    for (const props of bad) {
      // House idiom (context-window-bar precedent): direct call — the
      // boundary validation runs BEFORE any hook.
      expect(() => WelcomeBanner(props), JSON.stringify(props)).toThrow(
        TypeError,
      );
    }
    // D5 — the message names the offending prop.
    const err = catchError(() => WelcomeBanner({ name: "a\nb" }));
    expect(err.message).toContain("name");
    const hintErr = catchError(() =>
      WelcomeBanner({ name: "T", hints: ["bad\nhint"] }),
    );
    expect(hintErr.message).toContain("hints");
    const versionErr = catchError(() =>
      WelcomeBanner({ name: "T", version: "1\n2" }),
    );
    expect(versionErr.message).toContain("version");
  });

  it("empty_version_renders_as_absent", () => {
    // Review F-2: no dangling " v" suffix.
    const frame = renderBanner({ name: "Theo", version: "  " });
    expect(stripAnsi(frame)).not.toMatch(/Theo v\s*$/m);
    const lines = nonEmptyLines(frame);
    expect(lines).toHaveLength(3);
  });

  it("snapshots_default_and_floor", () => {
    const full = renderAtColumns(60, {
      name: "Theo TUI",
      version: "0.9.0",
      tagline: "AI-agent primitives for the terminal",
      hints: ["/help for commands", "esc to cancel"],
    });
    // Anchors FIRST — the snapshot is a layout pin, not the oracle.
    expect(full).toContain("Theo TUI");
    expect(full).toContain("v0.9.0");
    expect(full).toContain("/help for commands");
    expect(full).toMatchSnapshot("welcome-banner-default");

    const floor = renderAtColumns(23, { name: "Theo TUI", version: "0.9.0" });
    expect(floor).toContain("Theo TUI v0.9.0");
    expect(floor).toMatchSnapshot("welcome-banner-floor-rung");
  });

  it("banner_composes_above_other_content_without_static", () => {
    // D4 pin: plain component above the thread — plus the module-source
    // assert (review tests-1): the banner never imports <Static>.
    const source = readFileSync(
      new URL("./welcome-banner.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/import\s*\{[^}]*\bStatic\b[^}]*\}/);
    const instance = render(
      <Box flexDirection="column">
        <WelcomeBanner name="T" />
        <Text>thread below</Text>
      </Box>,
    );
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    const lines = nonEmptyLines(frame);
    expect(lines.at(-1)).toContain("thread below");
  });
});

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
