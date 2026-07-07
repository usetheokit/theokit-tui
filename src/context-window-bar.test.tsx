import { describe, expect, it } from "vitest";

import { ContextWindowBar } from "./context-window-bar.js";
import { renderFrame } from "../tests/helpers.js";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001B\[[0-9;]*m/g;
const stripAnsi = (value: string): string => value.replace(ANSI_RE, "");

const count = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

// T2.1 (plan m5-metrics-surface, ADRs D2/D4/D7): the fill gauge.
describe("ContextWindowBar", () => {
  it("renders_left_convention_with_detail", async () => {
    const frame = await renderFrame(
      <ContextWindowBar usedTokens={64_000} limitTokens={128_000} width={40} />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("50% left");
    expect(plain).toContain("(64k used / 128k)");
  });

  it("renders_used_convention", async () => {
    const frame = await renderFrame(
      <ContextWindowBar
        usedTokens={64_000}
        limitTokens={128_000}
        width={40}
        convention="used"
      />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("50% used");
    expect(plain).not.toContain("left");
  });

  it("bar_glyph_counts_match_label", async () => {
    // Label "50% left (64k used / 128k)" = 26 cols; width 37 → 10 bar cells.
    const frame = await renderFrame(
      <ContextWindowBar usedTokens={64_000} limitTokens={128_000} width={37} />,
    );
    const plain = stripAnsi(frame);
    expect(count(plain, "█")).toBe(5);
    expect(count(plain, "░")).toBe(5);
  });

  it("endpoint_honesty_99_6_percent", async () => {
    // 99.6% used must NOT read "0% left"-adjacent lies: label says 1% left and
    // the bar keeps at least one empty cell (roadmap risk 2).
    const frame = await renderFrame(
      <ContextWindowBar
        usedTokens={127_488}
        limitTokens={128_000}
        width={40}
      />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("1% left");
    expect(count(plain, "░")).toBeGreaterThanOrEqual(1);
    expect(count(plain, "█")).toBeGreaterThanOrEqual(1);
  });

  it("endpoint_honesty_tiny_usage", async () => {
    const left = stripAnsi(
      await renderFrame(
        <ContextWindowBar usedTokens={512} limitTokens={128_000} width={40} />,
      ),
    );
    expect(left).toContain("99% left");
    const used = stripAnsi(
      await renderFrame(
        <ContextWindowBar
          usedTokens={512}
          limitTokens={128_000}
          width={40}
          convention="used"
        />,
      ),
    );
    expect(used).toContain("1% used");
    expect(count(used, "█")).toBeGreaterThanOrEqual(1);
  });

  it("unknown_limit_renders_absolute_only", async () => {
    // Omission over fabrication (the codex Some(100) anti-pattern).
    const frame = await renderFrame(<ContextWindowBar usedTokens={64_000} />);
    const plain = stripAnsi(frame);
    expect(plain).toContain("64k tokens used");
    expect(plain).not.toContain("%");
    expect(plain).not.toContain("█");
  });

  it("over_limit_clamps_bar_and_stays_honest", async () => {
    const frame = await renderFrame(
      <ContextWindowBar
        usedTokens={140_000}
        limitTokens={128_000}
        width={40}
      />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("0% left");
    expect(count(plain, "░")).toBe(0); // clamped truly-full bar
    expect(count(plain, "█")).toBeGreaterThanOrEqual(3);
    expect(frame).toContain("[31m"); // error color marks the over state
  });

  it("baseline_tokens_shift_ratio", async () => {
    // codex parity: used' = max(0, 12000 − 12000) = 0 → 100% left.
    const frame = await renderFrame(
      <ContextWindowBar
        usedTokens={12_000}
        limitTokens={24_000}
        baselineTokens={12_000}
        width={40}
      />,
    );
    expect(stripAnsi(frame)).toContain("100% left");
  });

  it("warning_threshold_boundary_pair", async () => {
    // EC-11: >= 0.5 pinned on BOTH sides.
    const below = await renderFrame(
      <ContextWindowBar usedTokens={63_999} limitTokens={128_000} width={40} />,
    );
    expect(below).not.toContain("[33m");
    const at = await renderFrame(
      <ContextWindowBar usedTokens={64_000} limitTokens={128_000} width={40} />,
    );
    expect(at).toContain("[33m");
  });

  it("narrow_width_degrades_to_label_only", async () => {
    // EC-5: THE computed boundary pair — label is 26 cols for this fixture,
    // so width 30 leaves exactly 3 bar cells and width 29 leaves 2 (< 3).
    const atBoundary = stripAnsi(
      await renderFrame(
        <ContextWindowBar
          usedTokens={64_000}
          limitTokens={128_000}
          width={30}
        />,
      ),
    );
    // 50% of 3 cells rounds to 2 filled + 1 empty (review tests-2 — the
    // total-only assert also passed for 0█+3░).
    expect(count(atBoundary, "█")).toBe(2);
    expect(count(atBoundary, "░")).toBe(1);
    const below = stripAnsi(
      await renderFrame(
        <ContextWindowBar
          usedTokens={64_000}
          limitTokens={128_000}
          width={29}
        />,
      ),
    );
    expect(below).toContain("% left");
    expect(below).not.toContain("█");
    expect(below).not.toContain("used /");
  });

  it("left_label_never_100_while_used_nonzero", async () => {
    // EC-1: 1 − 5e-17 === 1 exactly — a naive formatPercent(1 − usedRatio)
    // would render "100% left" while tokens are in use.
    const frame = await renderFrame(
      <ContextWindowBar usedTokens={1} limitTokens={2e16} width={60} />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("99% left");
    expect(plain).not.toContain("100% left");
    expect(count(plain, "█")).toBeGreaterThanOrEqual(1);
  });

  it("used_plus_left_display_percents_sum_to_100", async () => {
    // EC-1 interior drift: both conventions derive from ONE display percent.
    const used = stripAnsi(
      await renderFrame(
        <ContextWindowBar
          usedTokens={42_880}
          limitTokens={128_000}
          width={40}
          convention="used"
        />,
      ),
    );
    const left = stripAnsi(
      await renderFrame(
        <ContextWindowBar
          usedTokens={42_880}
          limitTokens={128_000}
          width={40}
        />,
      ),
    );
    const usedPct = Number(/(\d+)% used/.exec(used)?.[1]);
    const leftPct = Number(/(\d+)% left/.exec(left)?.[1]);
    expect(usedPct + leftPct).toBe(100);
  });

  it("unknown_limit_ignores_baseline", async () => {
    // EC-12: the baseline is a ratio concept — absolute-only shows raw used.
    const frame = await renderFrame(
      <ContextWindowBar usedTokens={12_000} baselineTokens={5_000} />,
    );
    expect(stripAnsi(frame)).toContain("12k tokens used");
  });

  it("width_matrix_lines_fit", async () => {
    for (const w of [60, 30, 20]) {
      const frame = await renderFrame(
        <ContextWindowBar
          usedTokens={64_000}
          limitTokens={128_000}
          width={w}
        />,
      );
      for (const row of stripAnsi(frame).split("\n")) {
        expect(row.length, `width ${w}`).toBeLessThanOrEqual(w);
      }
    }
  });

  it("snapshots_empty_partial_full_narrow", async () => {
    const empty = await renderFrame(
      <ContextWindowBar usedTokens={0} limitTokens={128_000} width={40} />,
    );
    expect(stripAnsi(empty)).toContain("100% left");
    expect(count(stripAnsi(empty), "█")).toBe(0);
    expect(empty).toMatchSnapshot("context-window-bar-empty");

    // 50% sits exactly ON the warning threshold BY DESIGN (EC-11).
    const partial = await renderFrame(
      <ContextWindowBar usedTokens={64_000} limitTokens={128_000} width={40} />,
    );
    expect(stripAnsi(partial)).toContain("50% left");
    expect(partial).toContain("[33m");
    expect(partial).toMatchSnapshot("context-window-bar-partial");

    const full = await renderFrame(
      <ContextWindowBar
        usedTokens={128_000}
        limitTokens={128_000}
        width={40}
      />,
    );
    expect(stripAnsi(full)).toContain("0% left");
    expect(count(stripAnsi(full), "░")).toBe(0);
    expect(full).toMatchSnapshot("context-window-bar-full");

    const narrow = await renderFrame(
      <ContextWindowBar usedTokens={64_000} limitTokens={128_000} width={20} />,
    );
    expect(stripAnsi(narrow)).toContain("50% left");
    expect(stripAnsi(narrow)).not.toContain("█");
    expect(narrow).toMatchSnapshot("context-window-bar-narrow");
  });

  it("invalid_inputs_throw_typed_errors", () => {
    expect(() => ContextWindowBar({ usedTokens: -1 })).toThrow(TypeError);
    expect(() => ContextWindowBar({ usedTokens: -1 })).toThrow(
      "ContextWindowBar: usedTokens must be a finite number >= 0",
    );
    expect(() => ContextWindowBar({ usedTokens: 1, limitTokens: 0 })).toThrow(
      TypeError,
    );
    expect(() => ContextWindowBar({ usedTokens: Number.NaN })).toThrow(
      TypeError,
    );
    expect(() => ContextWindowBar({ usedTokens: 1, width: 1.5 })).toThrow(
      TypeError,
    );
    expect(() =>
      ContextWindowBar({ usedTokens: 1, baselineTokens: Number.NaN }),
    ).toThrow(TypeError);
  });

  it("baseline_at_or_above_limit_throws", () => {
    expect(() =>
      ContextWindowBar({
        usedTokens: 1,
        limitTokens: 128_000,
        baselineTokens: 128_000,
      }),
    ).toThrow("baselineTokens must be < limitTokens");
  });
});
