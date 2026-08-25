import { Box, Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type { WelcomeBannerProps } from "../../src/branding/welcome-banner.js";
import { WelcomeBanner } from "../../src/branding/welcome-banner.js";
import { stripAnsi } from "../../src/format/ansi.js";

/**
 * usetheokit/theokit-tui#157 — the aside slot can be given a rule and a width.
 *
 * `aside` names the layout it is for in its own docstring ("Tips for getting started" / "What's
 * new"), and that layout was not reachable through it. A consumer building it had to write three
 * workarounds, one of which hard-coded this component's padding arithmetic:
 *
 *     width={(stdout?.columns ?? 100) - LOGO_COLUMNS - 6}   // 6 = paddingX + border + marginLeft
 *     flexGrow={1}                                          // or the rule stops short of the floor
 *     borderStyle="single" borderTop={false} …              // the gutter is a margin, so it cannot
 *                                                           // draw the rule itself
 *
 * Every one of those five cells in the 6 is a decision inside `WelcomeBanner`, and nothing on
 * either side of the boundary tested it — so changing this box's padding would have broken that
 * consumer silently, at some widths and not others.
 *
 * These tests therefore pin LAYOUT, not implementation: containment across a width sweep, and the
 * rule reaching both borders with each column in turn the taller one. A single width would not
 * have caught the defect, which is a one-or-two-cell overhang that only appears at some sizes.
 */

/**
 * ink-testing-library hard-codes columns=100 through a PROTOTYPE getter on its fake Stdout; an
 * own-property getter on the instance shadows it, and a rerender re-reads it.
 */
function renderAtColumns(columns: number, props: WelcomeBannerProps): string {
  const instance = render(<WelcomeBanner {...props} />);
  Object.defineProperty(instance.stdout, "columns", { get: () => columns });
  instance.rerender(<WelcomeBanner {...props} key="recolumned" />);
  const frame = stripAnsi(instance.lastFrame() ?? "");
  instance.unmount();
  return frame;
}

const rows = (frame: string): string[] => frame.split("\n").filter((line) => line.trim() !== "");

/** The rows between the top and bottom border — the ones the divider has to cross. */
const interiorRows = (frame: string): string[] => rows(frame).slice(1, -1);

/** A five-row wordmark: taller than the two-row panel below, which is the direction that broke. */
const TALL_ART = [
  "█".repeat(24),
  "█".repeat(24),
  "█".repeat(24),
  "█".repeat(24),
  "█".repeat(24),
].join("\n");

const SHORT_ART = ["█".repeat(24), "█".repeat(24)].join("\n");

const PANEL = (
  <>
    <Text>Tips for getting started</Text>
    <Text>/help for commands</Text>
  </>
);

const TALL_PANEL = (
  <>
    <Text>Tips for getting started</Text>
    <Text>/help for commands</Text>
    <Text>@ to mention a file</Text>
    <Text>esc interrupts</Text>
    <Text>/init writes AGENTS.md</Text>
  </>
);

const WIDTH_SWEEP = [30, 40, 60, 80, 120] as const;

describe("#157 — asideDivider draws the column rule", () => {
  it("test_the_rule_is_drawn_between_the_two_columns", () => {
    const frame = renderAtColumns(80, {
      name: "TheoCode",
      art: SHORT_ART,
      aside: PANEL,
      asideDivider: true,
    });
    const first = interiorRows(frame)[0] ?? "";

    expect(
      [...first].filter((glyph) => glyph === "│"),
      "an interior row should carry three verticals — the two frame sides and the column rule",
    ).toHaveLength(3);
  });

  it("test_without_the_flag_there_is_no_rule", () => {
    // Anti-vacuity: the assertion above passes for free if the component always drew a rule, and
    // the flag would then not be additive at all.
    const frame = renderAtColumns(80, { name: "TheoCode", art: SHORT_ART, aside: PANEL });
    const first = interiorRows(frame)[0] ?? "";

    expect([...first].filter((glyph) => glyph === "│")).toHaveLength(2);
  });

  it("test_the_rule_spans_every_row_when_the_ART_column_is_the_taller_one", () => {
    // The failure the consumer worked around with a cross-axis `flexGrow`: with a five-row wordmark
    // beside a two-row panel, a rule that only measures the panel stops three rows above the floor.
    const frame = renderAtColumns(80, {
      name: "TheoCode",
      art: TALL_ART,
      aside: PANEL,
      asideDivider: true,
    });
    const interior = interiorRows(frame);

    expect(interior.length, "the art column must be the taller one for this to test anything").toBe(
      5,
    );
    expect(
      interior.filter((row) => [...row].filter((glyph) => glyph === "│").length === 3).length,
      "the rule stopped short of the bottom border while the art column ran on past it",
    ).toBe(interior.length);
  });

  it("test_the_rule_spans_every_row_when_the_ASIDE_column_is_the_taller_one", () => {
    // The other direction, so a rule sized to the art alone cannot pass either.
    const frame = renderAtColumns(80, {
      name: "TheoCode",
      art: SHORT_ART,
      aside: TALL_PANEL,
      asideDivider: true,
    });
    const interior = interiorRows(frame);

    expect(
      interior.length,
      "the aside column must be the taller one for this to test anything",
    ).toBe(5);
    expect(
      interior.filter((row) => [...row].filter((glyph) => glyph === "│").length === 3).length,
      "the rule stopped short of the bottom border while the aside ran on past it",
    ).toBe(interior.length);
  });

  it("test_the_rule_sits_in_the_same_column_on_every_row", () => {
    // A rule that is present on each row but drifts is not a rule. This is what a per-row border
    // (rather than one bordered column) would produce.
    const frame = renderAtColumns(80, {
      name: "TheoCode",
      art: TALL_ART,
      aside: PANEL,
      asideDivider: true,
    });
    const columns = interiorRows(frame).map((row) => row.indexOf("│", 1));

    expect(new Set(columns).size, `the rule moved between rows: columns ${columns.join(",")}`).toBe(
      1,
    );
    expect(columns[0], "the rule was never found").toBeGreaterThan(0);
  });
});

describe("#157 — the aside fills the width left over", () => {
  /** A full-width child of the aside: its rule is exactly as wide as the slot Ink gave the panel. */
  const PANEL_WITH_RULE = (
    <>
      <Text>Tips</Text>
      <Box
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
      >
        <Text>x</Text>
      </Box>
    </>
  );

  /** Width of the `─` run inside the panel — 0 when the panel drew none. */
  const panelRuleWidth = (frame: string): number =>
    Math.max(
      0,
      ...interiorRows(frame).flatMap((row) => (row.match(/─+/g) ?? []).map((run) => run.length)),
    );

  it("test_a_full_width_child_spans_the_panel_rather_than_the_longest_tip", () => {
    // Workaround (1): the consumer computed `columns - artWidth - 6` so a rule inside the aside
    // would span the panel. Without the fill the aside measures its content, so the rule is as
    // wide as the word "Tips".
    const frame = renderAtColumns(80, {
      name: "TheoCode",
      art: SHORT_ART,
      aside: PANEL_WITH_RULE,
      asideDivider: true,
    });

    expect(
      panelRuleWidth(frame),
      "the panel shrank to its longest row, so a rule inside it cannot span the column",
    ).toBeGreaterThan("Tips".length);
  });

  it("test_the_panel_rule_reaches_the_frames_inner_edge", () => {
    // Sharper than "wider than the tip": the slot is everything left after the art column, the
    // gutter, the rule and the padding — the exact number the consumer was re-deriving.
    const frame = renderAtColumns(80, {
      name: "TheoCode",
      art: SHORT_ART,
      aside: PANEL_WITH_RULE,
      asideDivider: true,
    });
    const ruleRow = interiorRows(frame).find((row) => row.includes("─")) ?? "";

    expect(ruleRow, "no full-width child rule was rendered at all").toContain("─");
    expect(
      ruleRow.lastIndexOf("─"),
      `the panel stops short of the frame: ${JSON.stringify(ruleRow)}`,
    ).toBe(ruleRow.length - 3);
  });

  it("test_without_the_flag_the_panel_still_measures_its_content", () => {
    // Anti-vacuity for both assertions above, and the backwards-compatibility statement itself:
    // the fill arrives with the flag and not before it.
    const frame = renderAtColumns(80, {
      name: "TheoCode",
      art: SHORT_ART,
      aside: PANEL_WITH_RULE,
    });

    expect(panelRuleWidth(frame)).toBe("Tips".length);
  });
});

describe("#157 — the divided layout contains itself across the width sweep", () => {
  /** Widest rendered row, in cells. */
  const widestRow = (frame: string): number => Math.max(...rows(frame).map((row) => row.length));

  /**
   * A wordmark that leaves room for a panel at the narrow end of the sweep. `SHORT_ART` is 24
   * cells, which at 30 columns is 24 of the 26 the frame has inside its border and padding — no
   * layout fits a second column there, and that is a property of the art, not of the divider.
   */
  const SWEEP_ART = ["█".repeat(16), "█".repeat(16)].join("\n");

  for (const columns of WIDTH_SWEEP) {
    it(`test_no_row_runs_past_the_border_at_${columns}_columns`, () => {
      // A test at ONE width would not have caught the defect this closes: the consumer's
      // hard-coded gutter is correct at the width they checked and overhangs by a cell or two
      // elsewhere.
      const frame = renderAtColumns(columns, {
        name: "TheoCode",
        art: SWEEP_ART,
        tagline: "Welcome back!",
        aside: TALL_PANEL,
        asideDivider: true,
      });
      const border = rows(frame)[0] ?? "";

      expect(border, `no frame was drawn at ${columns} columns`).toContain("╭");
      expect(
        widestRow(frame),
        `content ran past the frame at ${columns} columns:\n${frame}`,
      ).toBeLessThanOrEqual(border.length);
      expect(border.length, "the frame itself exceeded the terminal").toBeLessThanOrEqual(columns);
    });
  }

  it("test_the_rule_spans_every_row_at_every_width", () => {
    // Containment alone is satisfied by a layout that dropped the rule entirely at narrow widths.
    for (const columns of WIDTH_SWEEP) {
      const frame = renderAtColumns(columns, {
        name: "TheoCode",
        art: SWEEP_ART,
        aside: TALL_PANEL,
        asideDivider: true,
      });
      const interior = interiorRows(frame);

      expect(interior.length, `no interior rows at ${columns} columns`).toBeGreaterThan(0);
      expect(
        interior.filter((row) => [...row].filter((glyph) => glyph === "│").length === 3).length,
        `the rule did not cross every row at ${columns} columns:\n${frame}`,
      ).toBe(interior.length);
    }
  });

  it("test_the_panel_wraps_instead_of_overhanging_when_the_columns_do_not_both_fit", () => {
    // The exact shape that overhangs today: a 24-cell wordmark and a 24-cell tip at 50 columns
    // leave 36 cells inside the frame for 24 + 2 + 24, so something has to give. Both columns
    // being `flexShrink: 0` meant nothing did, and the first row ran two cells past the border.
    // U-7b's rule decides which side yields: the art keeps its width and the panel wraps.
    const frame = renderAtColumns(50, {
      name: "TheoCode",
      art: SHORT_ART,
      aside: PANEL,
      asideDivider: true,
    });
    const border = rows(frame)[0] ?? "";

    expect(
      widestRow(frame),
      `the panel overhung the frame instead of wrapping:\n${frame}`,
    ).toBeLessThanOrEqual(border.length);
    expect(
      rows(frame).filter((row) => row.includes("█".repeat(24))),
      "the art was compressed to make room — U-7b says the panel is the side that yields",
    ).toHaveLength(2);
  });
});

describe("#157 — the flag is additive", () => {
  const base: WelcomeBannerProps = {
    name: "TheoCode",
    version: "0.4.7",
    tagline: "Welcome back!",
    hints: ["/help for commands"],
    aside: PANEL,
  };

  for (const columns of WIDTH_SWEEP) {
    it(`test_an_existing_aside_consumer_renders_identically_at_${columns}_columns`, () => {
      // `asideDivider` moves the panel and adds a glyph column. Every consumer that already passes
      // an `aside` must be untouched until it asks, which is why the fill could not be made
      // unconditional: measured at 60 columns with no `art`, growing the aside moves it from flush
      // right to a half-and-half split.
      const before = renderAtColumns(columns, base);
      const after = renderAtColumns(columns, { ...base, asideDivider: false });

      expect(after, `passing asideDivider={false} changed the render at ${columns}`).toBe(before);
    });
  }

  it("test_the_flag_actually_changes_something", () => {
    // Anti-vacuity for the whole describe: if `asideDivider` were inert, every assertion above
    // would hold and the feature would not exist.
    const off = renderAtColumns(80, base);
    const on = renderAtColumns(80, { ...base, asideDivider: true });

    expect(on).not.toBe(off);
  });

  it("test_the_single_column_banner_ignores_the_flag", () => {
    // There is no second column to divide, so the flag must not conjure one.
    const plain = renderAtColumns(80, { name: "TheoCode", tagline: "Welcome back!" });
    const flagged = renderAtColumns(80, {
      name: "TheoCode",
      tagline: "Welcome back!",
      asideDivider: true,
    });

    expect(flagged).toBe(plain);
  });

  it("test_it_composes_with_a_border_title", () => {
    // The titled tree is composed differently (a text row above a top-less Box), so the two
    // features have to be asserted together or the combination is untested.
    const frame = renderAtColumns(80, {
      name: "TheoCode",
      art: SHORT_ART,
      aside: PANEL,
      asideDivider: true,
      borderTitle: "TheoCode v0.4.7",
    });
    const all = rows(frame);

    expect(all[0], "the border title was lost").toContain("TheoCode v0.4.7");
    expect(
      all.filter((row) => row.trimStart().startsWith("╭")),
      "the top border doubled",
    ).toHaveLength(1);
    expect(
      interiorRows(frame).filter((row) => [...row].filter((glyph) => glyph === "│").length === 3)
        .length,
      "the rule did not cross every row under a border title",
    ).toBe(interiorRows(frame).length);
  });
});
