import { describe, expect, it } from "vitest";

import {
  composerShortcutsFor,
  footerHintFor,
  selectSurface,
  windowFor,
} from "../src/index.js";

/**
 * Adversarial inputs over the pure exported surface.
 *
 * WHY THIS FILE EXISTS. Six components shipped in one session, each with tests whose detection
 * power was verified by mutation — and every one of those tests was written by the author of the
 * code, exercising the inputs that author had designed for. Not one asked what happens when the
 * numbers are wrong. A probe with inputs nobody chose found an empty frame on `-1`, `NaN` and
 * `Infinity` across four components in minutes (B-025), and a NaN selection blanking a list
 * (B-026).
 *
 * So the assertions here are INVARIANTS — "this can never be true" — rather than examples. An
 * example test agrees with the implementation by construction; an invariant can disagree with it.
 *
 * Scope is deliberately the PURE surface. Components are covered by their own suites, and the
 * render-time hole is B-025's to close: a throw during a React render becomes an empty frame, so
 * asserting component behaviour here would be asserting React's swallow rather than ours.
 */

describe("adversarial: windowFor never contradicts its own inputs", () => {
  /**
   * Scoped to windows the function is DOCUMENTED to accept — a finite integer >= 1. The invariant
   * is asserted strictly there, with no tolerance and no sampling.
   *
   * Hostile windows (0, negative, fractional, NaN, Infinity) are NOT asserted here, and that is a
   * scope decision rather than a pass: `windowFor` returns incoherent counts for them — measured,
   * `windowFor(20, 10, -1, "centred")` reports 11 hidden before and 10 after in a list of 20 — and
   * that is B-021, filed with its own Definition of Done. Asserting it here would leave a red test
   * standing in for an item, and tuning a threshold until it passed would be worse: a number chosen
   * to make a test green is a test that has stopped measuring anything.
   */
  const VALID_WINDOWS = [1, 2, 3, 7, 50, 1000];

  it("reported_counts_exactly_account_for_the_list", () => {
    const violations: string[] = [];
    for (const count of [0, 1, 2, 5, 20, 1000]) {
      for (const selected of [-5, -1, 0, 1, 3, 19, 999]) {
        for (const window of VALID_WINDOWS) {
          for (const anchor of ["trailing", "centred"] as const) {
            const view = windowFor(count, selected, window, anchor);
            const visible = Math.min(window, count);
            const total = view.hiddenBefore + visible + view.hiddenAfter;
            if (total !== count) {
              violations.push(
                `count=${String(count)} selected=${String(selected)} window=${String(window)} ${anchor}: ${String(view.hiddenBefore)}+${String(visible)}+${String(view.hiddenAfter)} = ${String(total)}, expected ${String(count)}`,
              );
            }
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it("no_field_is_ever_negative_fractional_or_NaN", () => {
    const violations: string[] = [];
    for (const count of [0, 1, 5, 20]) {
      for (const selected of [-5, -1, 0, 3, 999]) {
        for (const window of VALID_WINDOWS) {
          const view = windowFor(count, selected, window, "centred");
          for (const [name, value] of [
            ["hiddenBefore", view.hiddenBefore],
            ["hiddenAfter", view.hiddenAfter],
            ["windowStart", view.windowStart],
            ["clampedIndex", view.clampedIndex],
          ] as const) {
            if (!Number.isInteger(value) || value < 0) {
              violations.push(
                `count=${String(count)} selected=${String(selected)} window=${String(window)}: ${name}=${String(value)}`,
              );
            }
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it("the_window_never_opens_past_the_selection_it_is_centring_on", () => {
    const violations: string[] = [];
    for (const count of [1, 5, 20, 1000]) {
      for (const selected of [0, 1, 3, 19, 999]) {
        for (const window of VALID_WINDOWS) {
          const view = windowFor(count, selected, window, "centred");
          if (view.windowStart > view.clampedIndex) {
            violations.push(
              `count=${String(count)} selected=${String(selected)} window=${String(window)}: start=${String(view.windowStart)} > clamped=${String(view.clampedIndex)}`,
            );
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });
});

describe("adversarial: pure derivations never invent output", () => {
  it("composerShortcutsFor_never_grows_the_list_or_malforms_a_row", () => {
    const violations: string[] = [];
    const junk: unknown[] = [
      {},
      { shell: true },
      { shell: false },
      { shell: 1 },
      { shell: "yes" },
      { nonsense: true },
      Object.create(null),
    ];
    for (const caps of junk) {
      const rows = composerShortcutsFor(caps as never);
      if (rows.length > 15) violations.push(`grew to ${String(rows.length)}`);
      for (const row of rows) {
        if (typeof row.keys !== "string" || typeof row.description !== "string") {
          violations.push(`malformed ${JSON.stringify(row)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("footerHintFor_never_emits_a_dangling_or_doubled_separator", () => {
    const violations: string[] = [];
    const junk: unknown[] = [
      {},
      { shortcuts: true },
      { agents: true },
      { shortcuts: true, agents: true },
      { shortcuts: false, agents: false },
      { shortcuts: 1 },
      { shortcuts: "" },
      Object.create(null),
    ];
    for (const affordances of junk) {
      const hint = footerHintFor(affordances as never);
      if (
        hint.startsWith("·") ||
        hint.endsWith("·") ||
        hint.includes("··") ||
        hint.trim() !== hint
      ) {
        violations.push(JSON.stringify(hint));
      }
    }
    expect(violations).toEqual([]);
  });

  it("selectSurface_never_renders_without_a_claimant", () => {
    const violations: string[] = [];
    const sets = [
      [],
      [{ name: "", when: () => true, render: () => null }],
      [{ name: "a", when: () => false, render: () => null }],
      [
        { name: "dup", when: () => true, render: () => null },
        { name: "dup", when: () => true, render: () => null },
      ],
    ];
    for (const layers of sets) {
      const selected = selectSurface(layers, {});
      if (selected.layer === null && selected.render() !== null) {
        violations.push("no claimant but rendered something");
      }
    }
    expect(violations).toEqual([]);
  });
});
