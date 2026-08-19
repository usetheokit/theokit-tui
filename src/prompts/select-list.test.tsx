import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "../../tests/renderer/itl-adapter.js";
import { SelectList } from "./select-list.js";
import { windowFor } from "./select-list-model.js";
import type { SelectListItem } from "./select-list-model.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";
import { stripAnsi } from "../format/ansi.js";

// M22 T1.1 — the SelectList component driven through the itl-adapter (OUR
// renderer + InputSource + FocusProvider). Deterministic keyboard oracle.

const items: SelectListItem[] = [
  { value: "apple", label: "apple", description: "a fruit" },
  { value: "apricot", label: "apricot", description: "" },
  { value: "banana", label: "banana", description: "" },
];

describe("SelectList component (M22 T1.1)", () => {
  it("renders_items_with_the_active_marker_and_counter", async () => {
    const app = render(
      createElement(SelectList, { items, onSubmit: () => {} }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("❯ apple"); // first row active
    expect(frame).toContain("banana");
    expect(frame).toContain("(1/3)");
    app.unmount();
  });

  it("down_arrow_moves_the_selection", async () => {
    const app = render(
      createElement(SelectList, { items, onSubmit: () => {} }),
    );
    await app.flush();
    app.stdin.write("\x1b[B"); // down
    await app.flush();
    expect(app.lastFrame()).toContain("❯ apricot");
    expect(app.lastFrame()).toContain("(2/3)");
    app.unmount();
  });

  it("up_arrow_wraps_to_the_last_row", async () => {
    const app = render(
      createElement(SelectList, { items, onSubmit: () => {} }),
    );
    await app.flush();
    app.stdin.write("\x1b[A"); // up from row 0 → wraps to last
    await app.flush();
    expect(app.lastFrame()).toContain("❯ banana");
    expect(app.lastFrame()).toContain("(3/3)");
    app.unmount();
  });

  it("multi_select_space_toggles_off_as_well_as_on", async () => {
    const app = render(
      createElement(SelectList, { items, multi: true, onSubmit: () => {} }),
    );
    await app.flush();
    app.stdin.write(" "); // toggle apple ON
    await app.flush();
    expect(app.lastFrame()).toContain("1 selected");
    app.stdin.write(" "); // toggle apple OFF
    await app.flush();
    expect(app.lastFrame()).toContain("0 selected");
    app.unmount();
  });

  it("multi_select_renders_the_small_circle_checkbox_glyph", async () => {
    // The multi-select checkbox is the small ○ (empty) / ● (selected) circle —
    // NOT the bulky ◯ / ◉ LARGE CIRCLE, which reads as cramped in a dense list.
    const app = render(
      createElement(SelectList, { items, multi: true, onSubmit: () => {} }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("○ apple"); // unselected → small empty circle
    expect(app.lastFrame()).not.toContain("◯"); // never the LARGE CIRCLE
    app.stdin.write(" "); // select apple
    await app.flush();
    expect(app.lastFrame()).toContain("● apple"); // selected → small filled circle
    expect(app.lastFrame()).not.toContain("◉"); // never the LARGE FISHEYE
    app.unmount();
  });

  it("typing_filters_the_list", async () => {
    const app = render(
      createElement(SelectList, { items, onSubmit: () => {} }),
    );
    await app.flush();
    app.stdin.write("ap"); // prefix "ap"
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("apple");
    expect(frame).toContain("apricot");
    expect(frame).not.toContain("❯ banana");
    app.unmount();
  });

  it("backspace_shrinks_the_filter_and_restores_matches", async () => {
    const app = render(
      createElement(SelectList, { items, onSubmit: () => {} }),
    );
    await app.flush();
    app.stdin.write("xyz"); // no matches
    await app.flush();
    expect(app.lastFrame()).toContain("(0/0)");
    app.stdin.write("\x7f\x7f\x7f"); // backspace ×3 → filter empty
    await app.flush();
    expect(app.lastFrame()).toContain("apple");
    expect(app.lastFrame()).toContain("(1/3)");
    app.unmount();
  });

  it("enter_with_no_matches_submits_nothing", async () => {
    const chosen: string[][] = [];
    const app = render(
      createElement(SelectList, { items, onSubmit: (v) => chosen.push(v) }),
    );
    await app.flush();
    app.stdin.write("zzz"); // no matches
    await app.flush();
    app.stdin.write("\r");
    expect(chosen).toEqual([[]]);
    app.unmount();
  });

  it("enter_submits_the_selected_value_single", async () => {
    const chosen: string[][] = [];
    const app = render(
      createElement(SelectList, {
        items,
        onSubmit: (v) => chosen.push(v),
      }),
    );
    await app.flush();
    app.stdin.write("\x1b[B"); // down → apricot
    await app.flush();
    app.stdin.write("\r"); // enter
    expect(chosen).toEqual([["apricot"]]);
    app.unmount();
  });

  it("marker_survives_a_monochrome_theme_degrade_ladder", async () => {
    // Under a no-color theme the accent color is stripped, but the ❯ glyph
    // (the affordance) still marks the active row (M6 degrade-as-data).
    const app = render(
      createElement(TheoTUIProvider, {
        theme: themes["no-color"],
        children: createElement(SelectList, { items, onSubmit: () => {} }),
      }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("❯ apple");
    app.unmount();
  });

  it("multi_select_toggles_with_space_and_submits_the_set", async () => {
    const chosen: string[][] = [];
    const app = render(
      createElement(SelectList, {
        items,
        multi: true,
        onSubmit: (v) => chosen.push(v),
      }),
    );
    await app.flush();
    app.stdin.write(" "); // toggle apple
    await app.flush();
    app.stdin.write("\x1b[B"); // down → apricot
    await app.flush();
    app.stdin.write("\x1b[B"); // down → banana
    await app.flush();
    app.stdin.write(" "); // toggle banana
    await app.flush();
    expect(app.lastFrame()).toContain("2 selected");
    app.stdin.write("\r"); // enter
    expect(chosen[0]?.sort()).toEqual(["apple", "banana"]);
    app.unmount();
  });
});

// B-021 T1.3 — the public prop fails naming its OWN component.
//
// `SelectListProps.window` is public (`select-list.tsx:27`) and was passed to `deriveSelectList`
// unvalidated, so a consumer passing 0 got a menu that rendered nothing while both arrows claimed
// rows. `windowFor` now refuses it — but without a guard here the message would name `windowFor`,
// a model function the caller never called. That is the failure `agent-timeline.tsx:62` identified
// and `UsagePanel` was corrected for in B-025.
describe("SelectList window validation (B-021)", () => {
  const invalid = [0, -1, 2.5, Number.NaN];

  for (const window of invalid) {
    it(`test_a_window_of_${String(window)}_is_refused_naming_SelectList`, () => {
      // Called as a function, which is how this package tests boundary guards placed before hooks
      // (the F10 idiom). Rendering would send the throw to ink's error boundary instead.
      const refuse = () =>
        SelectList({ items, onSubmit: () => undefined, window });

      expect(refuse).toThrow(TypeError);
      expect(refuse).toThrow("SelectList: window");
    });
  }

  it("test_the_error_names_SelectList_not_windowFor", () => {
    let message = "";
    try {
      SelectList({ items, onSubmit: () => undefined, window: 0 });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain("SelectList");
    // The whole point: not the model function the caller never called.
    expect(message).not.toContain("windowFor");
    expect(message).toContain("0");
  });
});

// B-021 review F-dom-1 — ADR D1 justifies crashing the app with "the guard reports through
// `reportGuardFailure`, so the failure leaves a durable record". That was asserted by NOTHING:
// mutating the call to a plain `throw` left all 1589 tests green. It is verbatim the defect review
// caught in B-025, re-committed one slice later by a plan citing B-025 as prior art.
describe("the SelectList guard leaves a record (B-021 review)", () => {
  it("test_a_refused_window_reaches_the_sink", () => {
    const records: string[] = [];
    const realWrite = process.stderr.write;
    process.stderr.write = ((chunk: unknown): boolean => {
      const text = String(chunk);
      if (text.startsWith("[theokit/tui]")) {
        records.push(text);
        return true;
      }
      return realWrite.call(process.stderr, text as never);
    }) as typeof process.stderr.write;

    try {
      expect(() =>
        SelectList({ items, onSubmit: () => undefined, window: 0 }),
      ).toThrow(TypeError);
    } finally {
      process.stderr.write = realWrite;
    }

    // The throw is half the contract; the durable record is the half ADR D1 rests on.
    expect(records.join("")).toContain("SelectList: window");
  });
});

// B-022 — the menu says what the scrubber says.
//
// `SelectList` rendered a bare `▲` while `view.hiddenBefore` sat unused in the same view object.
// `WindowedList` renders `▲ {hiddenBefore}` from the identical model. The package documented the
// divergence at the moment it created it (`windowed-list.tsx:109`: "SelectList renders a bare ▲ and
// throws away the hiddenBefore it computed in the same view object, and a boolean cannot be turned
// back into a number").
//
// U-10 replaced the booleans with counts for exactly that reason. One view adopted the improvement;
// the other kept consuming the boolean derived FROM the number it discards.
//
// A count is MORE useful in a menu than in a scrubber, not less: a menu is filtered, so the number
// of hidden matches changes as the user types, and that is how they learn whether narrowing works
// (ADR D1).
describe("SelectList hidden-row counts (B-022)", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    value: `item-${String(i)}`,
    label: `item-${String(i)}`,
  }));

  it("test_a_windowed_menu_shows_the_hidden_count_below", async () => {
    const app = render(
      createElement(SelectList, { items: many, window: 4, onSubmit: () => {} }),
    );
    await app.flush();
    const frame = app.lastFrame() ?? "";
    app.unmount();

    // Selection starts at the top: nothing above, eight below a window of four over twelve items.
    expect(frame).toContain("▼ 8");
  });

  it("test_no_arrow_is_rendered_when_nothing_is_hidden", async () => {
    const app = render(
      createElement(SelectList, {
        items: many.slice(0, 3),
        window: 10,
        onSubmit: () => {},
      }),
    );
    await app.flush();
    const frame = app.lastFrame() ?? "";
    app.unmount();

    // A count of zero renders no arrow at all — never `▲ 0`, which would be noise claiming meaning.
    expect(frame).not.toContain("▲");
    expect(frame).not.toContain("▼");
  });

  it("test_the_count_shrinks_as_the_filter_narrows_the_list", async () => {
    // The case that makes a count worth more in a menu than in a scrubber: it tells the user
    // whether typing is working.
    //
    // REVIEW FIX (F-tests-3 / F-xval-7). This test did not test its own name. It used a window of
    // four and a filter matching three items, so after typing NOTHING was hidden and no arrow
    // rendered at all — it then asserted `not.toContain("▼ 8")`, which observes an ABSENT arrow.
    // Absence is not a shrunken count, and a mutant rendering a constant survived it.
    //
    // A window of two keeps an arrow on both sides of the filter, so the assertion can be what the
    // name claims: a number that goes DOWN.
    const app = render(
      createElement(SelectList, { items: many, window: 2, onSubmit: () => {} }),
    );
    await app.flush();
    expect(app.lastFrame() ?? "").toContain("▼ 10");

    app.stdin.write("item-1");
    await app.flush();
    const filtered = app.lastFrame() ?? "";
    app.unmount();

    // "item-1" matches item-1, item-10 and item-11 — three matches, one of them hidden by a
    // window of two. The count SHRANK, from ten to one, and is still there to be read.
    expect(filtered).toContain("▼ 1");
    expect(filtered).not.toContain("▼ 10");
  });

  // The upper edge (B-022, added by review — F-arch-1 / F-tests-1 / F-dom-2 / F-wire-1 / F-xval-2,
  // one defect found independently by all five reviewers).
  //
  // Every test above leaves the selection at row 0, where `hiddenBefore` is 0 and the `▲` branch is
  // never entered — so half of this slice was pinned by nothing, and reverting `▲ {hiddenBefore}` to
  // the pre-B-022 bare `▲` left the whole suite green. `windowed-list.test.tsx:48-55` has had this
  // test since it was written; this component copied the rendering idiom and left it behind.
  //
  // Assertions here check WHOLE TRIMMED ROWS and their POSITION, not substrings and not membership.
  // Both weaker forms were tried and both let real mutants through: `toContain` on the frame passes
  // for `▲ 30` where `▲ 3` is expected, and membership in a row array is blind to an arrow rendered
  // on the wrong side of the list, or rendered twice (F-tests-6, F-tests-8, F-arch-14).
  //
  // Model values, measured: windowFor(12, 6, 4) -> 3 above / 5 below; windowFor(12, 11, 4) -> 8 / 0.

  /** Trimmed rows — the unit every assertion here compares, so `▲ 3` is a whole row or it is not. */
  const rowsOf = (frame: string): string[] =>
    frame.split("\n").map((line) => line.trim());

  /** Where a row sits, and `-1` when it is absent. Position is what membership cannot see. */
  const indexOf = (frame: string, row: string): number =>
    rowsOf(frame).indexOf(row);

  /** How many rows start with a marker — an arrow rendered twice is a defect membership misses. */
  const countStartingWith = (frame: string, marker: string): number =>
    rowsOf(frame).filter((line) => line.startsWith(marker)).length;

  describe("the upper edge (B-022 review fix)", () => {
    it("test_a_scrolled_menu_shows_the_hidden_count_above_and_below", async () => {
      // Arrange
      const app = render(
        createElement(SelectList, {
          items: many,
          window: 4,
          onSubmit: () => {},
        }),
      );
      await app.flush();

      // Act — six steps down lands on item-6, with rows hidden on BOTH sides.
      for (let i = 0; i < 6; i++) {
        app.stdin.write("\u001B[B");
        await app.flush();
      }
      const frame = app.lastFrame() ?? "";
      app.unmount();

      // Assert — both edges, with DIFFERENT numbers. That difference is what makes the test able
      // to fail: a rendering that swapped the two counts, or emitted a constant, or dropped the
      // interpolation, produces something other than this pair.
      // Position, not membership. A mutant that renders the two arrows on the wrong sides of the
      // list — each pointing at nothing — satisfies membership and survived it (F-tests-8).
      const above = indexOf(frame, "▲ 3");
      const below = indexOf(frame, "▼ 5");
      const firstItem = indexOf(frame, "item-4");

      expect(above).toBeGreaterThanOrEqual(0);
      expect(below).toBeGreaterThanOrEqual(0);
      expect(above).toBeLessThan(firstItem);
      expect(below).toBeGreaterThan(firstItem);
      // And exactly one of each: a spurious second `▲ 99` beside the right one also survived.
      expect(countStartingWith(frame, "▲")).toBe(1);
      expect(countStartingWith(frame, "▼")).toBe(1);
    });

    it("a_bad_initial_selection_reports_and_throws_like_a_bad_window", async () => {
      // B-054 review (F-3) — the guard `window` already had, for the prop this slice added.
      // Measured before it existed: NaN rendered zero rows and a `(NaN/12)` counter, and 2.5
      // rendered no selection marker, with nothing reported. The B-021 `window: 0` shape, one prop
      // over.
      //
      // It throws rather than degrading, because that is this package's contract:
      // `reportGuardFailure` returns `never` and 37 test files rest on it.
      // Called as a FUNCTION, not through `render` — the shape `window: 0` already uses at :209,
      // because the guard runs before any hook and throws synchronously there.
      for (const bad of [Number.NaN, 2.5, -1]) {
        expect(() =>
          SelectList({
            items: many,
            window: 4,
            initialSelectionIndex: bad,
            onSubmit: () => undefined,
          }),
        ).toThrow(/initialSelectionIndex must be a non-negative integer/);
      }
    });

    it("test_the_last_row_hides_everything_above_and_nothing_below", async () => {
      // Arrange
      const app = render(
        createElement(SelectList, {
          items: many,
          window: 4,
          initialSelectionIndex: 11,
          onSubmit: () => {},
        }),
      );
      await app.flush();

      const frame = app.lastFrame() ?? "";
      app.unmount();

      // B-054 — this arrives at the last row by PROP, not by up-arrow wrap-around. Measured before
      // the change: the two mutants "wrap becomes clamp" and "delete the upArrow branch" had
      // IDENTICAL kill sets of four tests, so this rendering assertion died whenever the key layer
      // did and could not fail for rendering reasons alone. `up_arrow_wraps_to_the_last_row` (:47)
      // keeps that key-layer coverage; this test no longer duplicates it.
      //
      // Assert — the mirror of the very first test in this block. Together the two pin the rule
      // rather than one example: eight hidden above here, eight hidden BELOW there, and the arrow
      // that carries the count changes with the edge.
      // Above the rows, exactly once, and with nothing below — the mirror of the test above.
      // (Row 0 is the `filter:` chrome, so the arrow sits at 1; asserted relatively, not by index.)
      expect(indexOf(frame, "▲ 8")).toBeLessThan(indexOf(frame, "❯ item-11"));
      expect(indexOf(frame, "▲ 8")).toBeGreaterThanOrEqual(0);
      expect(countStartingWith(frame, "▲")).toBe(1);
      expect(frame).not.toContain("▼");
    });

    it("test_the_rendered_counts_are_the_model_counts", async () => {
      // The rule, against the model rather than a remembered number: the original assertions only
      // ever saw the one configuration where `hiddenAfter` was 8, so a literal `8` survived them.
      //
      // SCOPE, stated rather than denied (F-arch-8). Comparing the frame to `windowFor` pins the
      // RENDERING WIRING and nothing about the arithmetic: mutate `hiddenAfter` inside `windowFor`
      // and this test stays green, because expectation and frame move together. The arithmetic is
      // pinned by `select-list-model.test.ts` (13 failures on that mutant) and by the two
      // hard-coded tests above — which a later DRY pass must NOT delete as redundant with this one.
      // They are the only assertions in this file that do not move when the model does.
      //
      // Positions: `hiddenBefore` over these steps is {0, 1, 3, 5, 8}. `steps 4` is the boundary of
      // exactly one hidden row, whose absence let a `> 1` guard mutant survive the whole suite; and
      // `steps 11` is the only position where `hiddenAfter` is 0, without which the zero branch
      // below is unreachable (F-tests-5, F-tests-9).
      for (const steps of [0, 4, 6, 8, 11]) {
        const app = render(
          createElement(SelectList, {
            items: many,
            window: 4,
            onSubmit: () => {},
          }),
        );
        await app.flush();
        for (let i = 0; i < steps; i++) {
          app.stdin.write("\u001B[B");
          await app.flush();
        }
        const frame = app.lastFrame() ?? "";
        app.unmount();

        const view = windowFor(many.length, steps, 4);

        // Explicit branches: `toContain(cond ? x : "")` degenerates to `toContain("")`, which
        // passes against any string at all (F-tests-7).
        if (view.hiddenBefore > 0) {
          expect(rowsOf(frame)).toContain(`▲ ${String(view.hiddenBefore)}`);
          expect(countStartingWith(frame, "▲")).toBe(1);
        } else {
          expect(frame).not.toContain("▲");
        }
        if (view.hiddenAfter > 0) {
          expect(rowsOf(frame)).toContain(`▼ ${String(view.hiddenAfter)}`);
          expect(countStartingWith(frame, "▼")).toBe(1);
        } else {
          expect(frame).not.toContain("▼");
        }
      }
    });
  });
});

// B-022 D2 — the snapshot the item asked for, which did not exist.
//
// The item's DoD says "the snapshot for `SelectList` is updated in the same commit, so the visual
// change is a reviewable diff". There was no snapshot: `src/prompts/__snapshots__` held only
// `windowed-list.test.tsx.snap`, and `git log --all` shows one for this component never existed.
// The plan repeated the assumption without checking it.
//
// So this CANNOT show the B-022 change — a snapshot created now has nothing to diff against. It is
// added anyway, following the sibling's idiom, so the NEXT change to this component is reviewable
// the way the item wanted this one to be. Saying that plainly is better than presenting a new file
// as though it demonstrated a diff.
describe("SelectList layout (B-022 D2)", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    value: `item-${String(i)}`,
    label: `item-${String(i)}`,
  }));

  it("windowed_menu_layout", async () => {
    const app = render(
      createElement(SelectList, { items: many, window: 4, onSubmit: () => {} }),
    );
    await app.flush();
    const frame = app.lastFrame() ?? "";
    app.unmount();

    expect(stripAnsi(frame)).toMatchSnapshot("select-list-windowed");
  });

  it("scrolled_menu_layout", async () => {
    // REVIEW FIX (F-arch-5). The two original snapshots both rendered at selection 0, so the `▲`
    // row appeared in NEITHER and they killed none of the upper-edge mutants. The reference
    // component's snapshot (`windowed-list-centred`) pins both edges; this one now does too.
    const app = render(
      createElement(SelectList, { items: many, window: 4, onSubmit: () => {} }),
    );
    await app.flush();
    for (let i = 0; i < 6; i++) {
      app.stdin.write("\u001B[B");
      await app.flush();
    }
    const frame = app.lastFrame() ?? "";
    app.unmount();

    expect(stripAnsi(frame)).toMatchSnapshot("select-list-scrolled");
  });

  it("short_menu_layout", async () => {
    const app = render(
      createElement(SelectList, {
        items: many.slice(0, 3),
        onSubmit: () => {},
      }),
    );
    await app.flush();
    const frame = app.lastFrame() ?? "";
    app.unmount();

    // The no-overflow case, so the diff between the two snapshots IS the chrome this item changed.
    expect(stripAnsi(frame)).toMatchSnapshot("select-list-short");
  });
});
