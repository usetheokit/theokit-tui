import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "../../tests/renderer/itl-adapter.js";
import { SelectList } from "./select-list.js";
import type { SelectListItem } from "./select-list-model.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";

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
