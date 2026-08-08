import { Box, Text } from "ink";
import { readFileSync } from "node:fs";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

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

  it("aside_renders_a_right_column_alongside_the_main_content", () => {
    // #5 Claude Code parity: the two-column welcome (left: name/tagline,
    // right: Tips / What's new). `aside` is the right column.
    const instance = render(
      <WelcomeBanner
        name="Theo"
        tagline="Welcome back!"
        aside={
          <>
            <Text>Tips for getting started</Text>
            <Text>Run /init to create a CLAUDE.md</Text>
          </>
        }
      />,
    );
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(frame).toContain("Welcome back!");
    expect(frame).toContain("Tips for getting started");
    // The aside sits on the SAME row as the name (two columns), not below it.
    const nameLine = stripAnsi(frame)
      .split("\n")
      .find((l) => l.includes("Theo"));
    expect(nameLine).toContain("Tips for getting started");
  });

  it("without_aside_the_layout_is_the_single_column_banner", () => {
    // Backward-compat: no aside → the name and any content stack vertically.
    const instance = render(<WelcomeBanner name="Theo" tagline="hi there" />);
    const frame = stripAnsi(instance.lastFrame() ?? "");
    instance.unmount();
    const nameLine = frame.split("\n").find((l) => l.includes("Theo"));
    expect(nameLine).not.toContain("hi there"); // stacked, not side-by-side
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

/**
 * U-7 — ASCII art alongside the right-hand aside.
 *
 * `Banner` renders art and has no `aside`; `WelcomeBanner` has the `aside` column and can only
 * render its `name` as bold text. So the one layout Claude Code actually uses — art on the left,
 * "Tips for getting started" on the right — was reachable from neither component.
 *
 * Measured from a consumer (TheoCode) that rebuilt the whole two-column welcome by hand, including
 * the responsive gating this component already does, because it needed both halves at once. The
 * docstring of `aside` even names the two headings that consumer wrote out.
 *
 * `art` degrades to the bold `name` exactly as it does in `Banner`, so the vocabulary is one.
 */
describe("U-7 — art composes with the aside", () => {
  const ART = " _____\n|_   _|\n  |_|";

  it("test_art_renders_in_place_of_the_bold_name", () => {
    const frame = stripAnsi(renderBanner({ name: "TheoCode", art: ART }));

    expect(frame).toContain("|_   _|");
  });

  it("test_art_and_aside_render_together", () => {
    const frame = stripAnsi(
      renderBanner({
        name: "TheoCode",
        art: ART,
        aside: <Text>Tips for getting started</Text>,
      }),
    );

    expect(frame).toContain("|_   _|");
    expect(frame).toContain("Tips for getting started");
  });

  it("test_absent_art_still_degrades_to_the_bold_name", () => {
    // Anti-vacuity floor: the existing single-column behaviour must be untouched.
    const frame = stripAnsi(renderBanner({ name: "TheoCode" }));

    expect(frame).toContain("TheoCode");
  });

  it("test_the_version_still_shows_on_the_degrade_path", () => {
    const frame = stripAnsi(
      renderBanner({ name: "TheoCode", version: "0.1.0" }),
    );

    expect(frame).toContain("v0.1.0");
  });
});

/**
 * U-7b — art keeps its width when an aside is present.
 *
 * U-7 let `art` and `aside` coexist, but the two-column branch grows the main content with
 * `flexGrow={1}` and reserves nothing for the art. Ink then compresses the art column, so a wordmark
 * wider than whatever the aside leaves over gets broken across lines and the tagline and hints are
 * pushed out of the frame.
 *
 * Found by consuming it: TheoCode adopted `WelcomeBanner` on the strength of U-7 and had to revert,
 * because its ~38-column wordmark rendered shattered. Shipping the prop without this is shipping the
 * feature for single-column layouts only, which is the one case that already worked.
 *
 * `bannerArtWidth` already exists for exactly this measurement — it counts display cells, so CJK and
 * wide glyphs are handled.
 */
describe("U-7b — art is not compressed by the aside", () => {
  // The real shape that broke: a 34-cell wordmark beside a 45-cell hints panel. Together with the
  // border, padding and gutter they exceed a common terminal, which is where the compression starts.
  const WIDE_ART = ["█".repeat(34), "█".repeat(34), "█".repeat(34)].join("\n");
  const REAL_ASIDE = (
    <>
      <Text>Tips for getting started</Text>
      <Text>/help · @ mention a file · esc interrupts</Text>
    </>
  );

  it("test_every_art_line_survives_intact_beside_an_aside", () => {
    const frame = stripAnsi(
      renderAtColumns(60, {
        name: "X",
        art: WIDE_ART,
        tagline: "welcome-line",
        aside: REAL_ASIDE,
      }),
    );

    // Each art row must appear at its full width; a compressed column breaks them into fragments.
    const fullRows = frame
      .split("\n")
      .filter((line) => line.includes("█".repeat(34)));
    expect(
      fullRows.length,
      "the art column was compressed by the aside — rows came back shorter than the art itself",
    ).toBe(3);
  });

  it("test_the_tagline_survives_beside_the_art_and_aside", () => {
    const frame = stripAnsi(
      renderAtColumns(60, {
        name: "X",
        art: WIDE_ART,
        tagline: "welcome-line",
        aside: REAL_ASIDE,
      }),
    );

    expect(
      frame,
      "the tagline was pushed out of the frame when art and aside shared the box",
    ).toContain("welcome-line");
  });

  it("test_a_single_column_art_banner_is_unchanged", () => {
    // Anti-vacuity floor: the layout that already worked must not regress.
    const frame = stripAnsi(
      renderBanner({ name: "X", art: WIDE_ART, tagline: "welcome-line" }),
    );

    expect(frame).toContain("welcome-line");
    expect(
      frame.split("\n").filter((l) => l.includes("█".repeat(34))).length,
    ).toBe(3);
  });
});

/**
 * U-7c — the frame contains its own content.
 *
 * U-7 added `art` and U-7b stopped the aside compressing it, and adoption still failed: the box caps
 * itself at MAX_WIDTH (60 cells), which was sized for the single-column banner. A two-column layout
 * needs art + gutter + aside, so with a real aside the content simply ran past the right border.
 *
 * This asserts CONTAINMENT, not presence — and that distinction is the finding. The consumer's own
 * suite passed on the overflowing version, because every string it looked for was there; the text
 * was just outside the frame. A presence test cannot see a layout defect.
 */
describe("U-7c — content stays inside the border", () => {
  const ART = ["█".repeat(34), "█".repeat(34), "█".repeat(34)].join("\n");
  const ASIDE = (
    <>
      <Text>Tips for getting started</Text>
      <Text>/help · @ mention a file · esc interrupts</Text>
    </>
  );

  /** Widest rendered row, in cells. */
  const widestRow = (frame: string): number =>
    Math.max(
      ...stripAnsi(frame)
        .split("\n")
        .map((line) => line.length),
    );

  it("test_no_row_runs_past_the_border_when_an_aside_is_present", () => {
    const frame = renderAtColumns(120, {
      name: "TheoCode",
      art: ART,
      tagline: "welcome-line",
      aside: ASIDE,
    });
    const rows = stripAnsi(frame)
      .split("\n")
      .filter((l) => l.trim().length > 0);
    const border = rows.find((l) => l.includes("╭")) ?? "";

    expect(
      widestRow(frame),
      "content ran past the frame: the box capped itself at MAX_WIDTH, which was sized for the " +
        "single-column banner and cannot hold art + gutter + aside",
    ).toBeLessThanOrEqual(border.length);
  });

  it("test_the_single_column_banner_still_respects_the_max_width", () => {
    // Anti-vacuity floor: the cap exists for the one-column layout and must survive.
    const frame = renderAtColumns(200, {
      name: "TheoCode",
      tagline: "welcome-line",
    });

    expect(widestRow(frame)).toBeLessThanOrEqual(60);
  });
});
