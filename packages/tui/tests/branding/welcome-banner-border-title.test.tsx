import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type { WelcomeBannerProps } from "../../src/branding/welcome-banner.js";
import { WelcomeBanner } from "../../src/branding/welcome-banner.js";
import { stripAnsi } from "../../src/format/ansi.js";

// #155 and the border-title feature.
//
// Two gaps a consumer hit while bringing a coding agent to visual parity with Claude Code:
//
//   1. `version` rendered ONLY when `art` was absent — the ternary picked art OR name+version, and
//      nothing in the prop's docstring said the two were exclusive. A consumer passing both got a
//      silently inert prop and had to smuggle the version into `tagline`.
//   2. There was no way to write a label into the top border, which is the most recognisable trait
//      of the banner this component is modelled on:
//          ╭─── Claude Code v2.1.236 ────────────────────╮
//      Ink has no border label, so a consumer wanting it had to hand-roll the whole box — which is
//      what this component exists to stop.

const ART = ["▀█▀ █ █ █▀▀ █▀█", " █  █▀█ █▀▀ █ █", " ▀  ▀ ▀ ▀▀▀ ▀▀▀"].join("\n");

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

const rows = (frame: string): string[] => frame.split("\n").filter((l) => l.trim() !== "");

describe("#155 — `version` reaches the screen whether or not there is art", () => {
  it("test_version_renders_beside_the_name_when_there_is_no_art", () => {
    expect(renderAtColumns(80, { name: "TheoCode", version: "0.4.7" })).toContain("v0.4.7");
  });

  it("test_version_renders_WITH_art_too", () => {
    // The defect: this was the branch where a documented prop did nothing at all.
    expect(
      renderAtColumns(80, { name: "TheoCode", version: "0.4.7", art: ART }),
      "`version` is inert whenever `art` is set — the ternary picks one or the other",
    ).toContain("v0.4.7");
  });

  it("test_the_art_is_still_drawn_when_the_version_joins_it", () => {
    // Anti-vacuity: rendering the version INSTEAD of the art would satisfy the assertion above.
    const frame = renderAtColumns(80, { name: "TheoCode", version: "0.4.7", art: ART });

    expect(frame).toContain("▀█▀");
    expect(frame).toContain("v0.4.7");
  });

  it("test_no_version_still_renders_nothing", () => {
    expect(renderAtColumns(80, { name: "TheoCode", art: ART })).not.toContain(" v");
  });
});

describe("borderTitle — a label written into the top border", () => {
  const titled = { name: "TheoCode", borderTitle: "TheoCode v0.4.7" } as const;

  it("test_the_title_appears_in_the_TOP_border_row", () => {
    const first = rows(renderAtColumns(80, titled))[0] ?? "";

    expect(first, "the title is not on the border row").toContain("TheoCode v0.4.7");
    expect(first.startsWith("╭"), "the border row lost its corner").toBe(true);
    expect(first.endsWith("╮")).toBe(true);
  });

  it("test_the_border_is_not_drawn_twice", () => {
    // The Box must stop drawing its own top when the title row replaces it. Two stacked borders is
    // the obvious failure of composing a row above a bordered Box.
    const opens = rows(renderAtColumns(80, titled)).filter((l) => l.trimStart().startsWith("╭"));

    expect(opens).toHaveLength(1);
  });

  it("test_the_title_row_is_exactly_as_wide_as_the_box", () => {
    // A mismatch here is not cosmetic: it is a box with a step in its side. The row is composed
    // from the same width the Box is built with, and this is what pins that.
    const frame = rows(renderAtColumns(80, titled));
    const top = frame[0] ?? "";
    const bottom = frame.at(-1) ?? "";

    expect([...top].length).toBe([...bottom].length);
  });

  it("test_a_long_title_is_truncated_rather_than_widening_the_box", () => {
    // A box wider than the terminal wraps its own border, which is worse than a shortened label.
    const frame = rows(renderAtColumns(40, { name: "X", borderTitle: "a".repeat(200) }));
    const top = frame[0] ?? "";

    expect([...top].length).toBeLessThanOrEqual(40);
    expect(top).toContain("…");
  });

  it("test_without_a_title_the_banner_is_unchanged", () => {
    // The feature is additive: every existing consumer must render byte-identically.
    const withTitle = renderAtColumns(80, { name: "TheoCode" });

    expect(rows(withTitle)[0]).toMatch(/^╭─+╮$/);
  });

  it("test_an_empty_title_is_treated_as_absent", () => {
    // Never a dangling `╭───  ───╮`, the same rule `normalizeVersion` already applies.
    expect(rows(renderAtColumns(80, { name: "TheoCode", borderTitle: "   " }))[0]).toMatch(
      /^╭─+╮$/,
    );
  });

  it("test_it_works_with_the_two_column_layout_too", () => {
    // The aside branch returns a different tree, so it needs its own assertion — a title that
    // worked only on the single-column path would be the more likely bug.
    const frame = rows(
      renderAtColumns(120, { ...titled, art: ART, aside: null, hints: ["gpt-5.4"] }),
    );

    expect(frame[0]).toContain("TheoCode v0.4.7");
    expect(frame.filter((l) => l.trimStart().startsWith("╭"))).toHaveLength(1);
  });
});
