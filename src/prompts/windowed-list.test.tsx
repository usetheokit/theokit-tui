import { describe, expect, it } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
import { WindowedList } from "./windowed-list.js";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001B\[[0-9;]*m/g;
const stripAnsi = (value: string): string => value.replace(ANSI_RE, "");

const rows = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `turn ${String(i)}`);

// B-003 (plan b003-history-overlay, ADRs D1-D5): the presentational windowed list.
describe("WindowedList", () => {
  it("centres_the_selection_and_counts_what_is_hidden", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <WindowedList rows={rows(20)} selected={10} window={7} />,
      ),
    );
    const lines = plain.split("\n").filter((l) => l.trim() !== "");
    // Centred, not trailing: the selection must NOT be the last visible row — that is the whole
    // difference from `SelectList`'s menu anchor.
    const last = lines.filter((l) => l.includes("turn ")).at(-1);
    expect(last).not.toContain("turn 10");
    // D2 — counts, never a bare marker. Both sides have hidden rows here.
    expect(plain).toMatch(/▲\s*7/);
    expect(plain).toMatch(/▼\s*6/);
  });

  it("shows_a_short_list_whole_with_no_hidden_counts", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <WindowedList rows={rows(3)} selected={1} window={7} />,
      ),
    );
    expect(plain).toContain("turn 0");
    expect(plain).toContain("turn 2");
    expect(plain).not.toContain("▲");
    expect(plain).not.toContain("▼");
  });

  it("clamps_to_the_head_and_reports_only_what_is_below", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <WindowedList rows={rows(20)} selected={0} window={5} />,
      ),
    );
    expect(plain).toContain("turn 0");
    expect(plain).not.toContain("▲");
    expect(plain).toMatch(/▼\s*15/);
  });

  it("clamps_to_the_tail_and_reports_only_what_is_above", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <WindowedList rows={rows(20)} selected={19} window={5} />,
      ),
    );
    expect(plain).toContain("turn 19");
    expect(plain).toMatch(/▲\s*15/);
    expect(plain).not.toContain("▼");
  });

  it("renders_nothing_for_an_empty_row_list", async () => {
    const plain = stripAnsi(await renderFrame(<WindowedList rows={[]} />));
    expect(plain.trim()).toBe("");
  });

  it("marks_no_row_active_when_there_is_no_selection", async () => {
    const plain = stripAnsi(
      await renderFrame(<WindowedList rows={rows(3)} window={7} />),
    );
    expect(plain).toContain("turn 0");
    // The active marker is the only thing that distinguishes a selected row.
    expect(plain).not.toContain("❯");
  });

  it("hidden_rows_render_as_a_number_not_a_marker", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <WindowedList rows={rows(50)} selected={25} window={3} />,
      ),
    );
    // The defect this component exists to avoid. `SelectList` used to render a bare `▲` and throw
    // the count away; it renders the counts too now, so the citation that used to sit here no
    // longer points at that code. The assertion is unchanged and still the right one: a digit must
    // be present next to each marker, whatever the sibling does.
    expect(plain).toMatch(/▲\s*\d+/);
    expect(plain).toMatch(/▼\s*\d+/);
  });

  // D4 / EC-1 — measured: windowFor(20, 10, 0) puts windowStart PAST the selection, and
  // windowFor(20, 10, -1) reports hiddenBefore 11 + hiddenAfter 10 in a list of 20. A component
  // built straight on that would state a falsehood in numbers.
  it("rejects_a_non_positive_window_with_a_typed_error_naming_itself", () => {
    expect(() =>
      WindowedList({ rows: rows(20), selected: 10, window: 0 }),
    ).toThrow(TypeError);
    expect(() =>
      WindowedList({ rows: rows(20), selected: 10, window: 0 }),
    ).toThrow("WindowedList: window must be a finite integer >= 1");
    expect(() => WindowedList({ rows: rows(20), window: -1 })).toThrow(
      TypeError,
    );
    expect(() => WindowedList({ rows: rows(20), window: 2.5 })).toThrow(
      TypeError,
    );
  });

  // D5 / EC-2 — the counts are reported in ROWS, so a row that renders as two terminal lines
  // makes "7 visible, 12 above" stop describing what the user sees.
  it("flattens_a_multi_line_row_to_one_line", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <WindowedList
          rows={["first\nsecond\tthird"]}
          selected={0}
          window={3}
        />,
      ),
    );
    const body = plain.split("\n").filter((l) => l.includes("first"));
    expect(body).toHaveLength(1);
    expect(body[0]).toContain("first second third");
  });

  it("centred_window_layout", async () => {
    expect(
      stripAnsi(
        await renderFrame(
          <WindowedList rows={rows(20)} selected={10} window={7} />,
        ),
      ),
    ).toMatchSnapshot("windowed-list-centred");
  });

  it("short_list_layout_has_no_counts", async () => {
    expect(
      stripAnsi(
        await renderFrame(<WindowedList rows={rows(3)} selected={1} />),
      ),
    ).toMatchSnapshot("windowed-list-short");
  });

  it("clamps_a_selection_past_the_end", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <WindowedList rows={rows(5)} selected={99} window={7} />,
      ),
    );
    expect(plain).toContain("turn 4");
    expect(plain).not.toContain("▲");
  });

  // B-026 — found by an adversarial probe, not by the tests written alongside this component.
  // `windowFor` clamps with Math.min(Math.max(selected, 0), count - 1), and every comparison
  // against NaN is false, so clampedIndex and windowStart become NaN and rows.slice(NaN, NaN)
  // returns []. The list rendered EMPTY: no error, no log, nothing on screen. `window` was
  // guarded and `selected` was not, which is the whole defect.
  it("rejects_a_non_integer_selection_with_a_typed_error_naming_itself", () => {
    expect(() =>
      WindowedList({ rows: rows(3), selected: Number.NaN, window: 2 }),
    ).toThrow(TypeError);
    expect(() =>
      WindowedList({ rows: rows(3), selected: Number.NaN, window: 2 }),
    ).toThrow("WindowedList: selected must be an integer");
    expect(() =>
      WindowedList({ rows: rows(3), selected: 1.5, window: 2 }),
    ).toThrow(TypeError);
    expect(() =>
      WindowedList({
        rows: rows(3),
        selected: Number.POSITIVE_INFINITY,
        window: 2,
      }),
    ).toThrow(TypeError);
  });

  it("still_accepts_the_no_selection_sentinel_and_any_integer", async () => {
    // -1 is the documented "no selection"; out-of-range integers clamp rather than throw.
    for (const selected of [-1, 0, 2, 999]) {
      const plain = stripAnsi(
        await renderFrame(
          <WindowedList rows={rows(5)} selected={selected} window={3} />,
        ),
      );
      expect(plain.trim()).not.toBe("");
    }
  });
});
