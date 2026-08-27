import { Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type { WelcomeBannerProps } from "../../src/branding/welcome-banner.js";
import { WelcomeBanner } from "../../src/branding/welcome-banner.js";
import { stripAnsi } from "../../src/format/ansi.js";

/**
 * usetheokit/theokit-tui#158 — the UNDIVIDED two-column banner stays inside its border.
 *
 * #157 gave the divided panel `flexShrink: 1` and pinned containment for it. The undivided path
 * kept `flexShrink={0}` on both columns, so at any width where art + gutter + aside does not fit,
 * Yoga had nothing to shrink and laid the row out wider than its container — the aside just ran
 * past the right border.
 *
 * The text was all still present while the frame was visibly broken, which is why a presence-based
 * consumer suite stayed green. These tests measure the FRAME, and they sweep: the overhang is one
 * or two cells at some widths and absent at others, so a single width proves nothing. U-7c asserted
 * exactly this property at 120 columns, where this content happens to fit.
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
const widestRow = (frame: string): number => Math.max(...rows(frame).map((row) => row.length));

/** The exact reproduction from the issue: a 24-cell wordmark beside a 24-cell tip. */
const ART = ["█".repeat(24), "█".repeat(24)].join("\n");

const ASIDE = (
  <>
    <Text>Tips for getting started</Text>
    <Text>/help for commands</Text>
  </>
);

const WIDTH_SWEEP = [40, 50, 60, 80, 120];

describe("#158 — the undivided aside yields instead of overflowing", () => {
  for (const columns of WIDTH_SWEEP) {
    it(`test_no_row_runs_past_the_border_at_${columns}_columns`, () => {
      const frame = renderAtColumns(columns, { name: "TheoCode", art: ART, aside: ASIDE });
      expect(widestRow(frame)).toBeLessThanOrEqual(columns);
    });
  }

  it("test_every_interior_row_still_closes_with_the_right_border", () => {
    // Width alone would pass on a frame whose long row simply lost its closing `│` — the
    // measured symptom at 50 columns was "2 cells past, no closing".
    const frame = renderAtColumns(50, { name: "TheoCode", art: ART, aside: ASIDE });
    const interior = rows(frame).slice(1, -1);
    expect(interior.length).toBeGreaterThan(0);
    for (const row of interior) {
      expect(row.trimEnd().endsWith("│")).toBe(true);
    }
  });

  it("test_the_art_keeps_its_full_width_when_the_aside_yields", () => {
    // Anti-vacuity, and U-7b's actual rule: the panel is the side that wraps. A fix that let
    // BOTH columns shrink would pass containment while shattering the wordmark — the exact
    // regression #5 was filed for.
    const frame = renderAtColumns(50, { name: "TheoCode", art: ART, aside: ASIDE });
    expect(rows(frame).some((row) => row.includes("█".repeat(24)))).toBe(true);
  });

  it("test_the_aside_text_survives_the_wrap", () => {
    // Yielding means wrapping, not truncating: the tip is still readable, just across more rows.
    const frame = renderAtColumns(50, { name: "TheoCode", art: ART, aside: ASIDE });
    const flattened = frame.replaceAll(/[│\s]+/g, " ");
    for (const word of ["Tips", "getting", "started", "/help", "commands"]) {
      expect(flattened).toContain(word);
    }
  });
});
