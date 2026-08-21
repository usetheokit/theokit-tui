import { describe, expect, it } from "vitest";

import { Output } from "../../../src/renderer/output/output-grid.js";

// M18 T2.1 (plan m18-yoga-layout, ADR D2): the cell-grid Output — Ink's
// output.js ported (minus clips: no corpus component uses overflow). Positions
// characters on a height×width grid, preserves trailing padding rows, trims
// trailing space per row, handles wide (CJK) chars.

const noTransforms = {
  transformers: [] as ((s: string, i: number) => string)[],
};

describe("Output grid (M18 T2.1)", () => {
  it("grid_writes_char_at_position", () => {
    const out = new Output({ width: 6, height: 3 });
    out.write(2, 1, "x", noTransforms);
    const rows = out.get().output.split("\n");
    expect(rows[1]).toBe("  x");
  });

  it("grid_preserves_trailing_padding_rows", () => {
    const out = new Output({ width: 4, height: 5 });
    out.write(0, 0, "a", noTransforms);
    // The grid is 5 tall — trailing blank rows are preserved (padding/margin).
    expect(out.get().output.split("\n")).toHaveLength(5);
  });

  it("grid_trims_trailing_space_per_row", () => {
    const out = new Output({ width: 10, height: 1 });
    out.write(0, 0, "ab", noTransforms);
    expect(out.get().output).toBe("ab");
  });

  it("grid_wide_char_occupies_two_cells", () => {
    const out = new Output({ width: 6, height: 1 });
    out.write(0, 0, "你x", noTransforms);
    // "你" is 2 cells wide, so "x" lands at column 2.
    const row = out.get().output;
    expect(row.startsWith("你x")).toBe(true);
  });

  it("grid_applies_transformers_per_line", () => {
    const out = new Output({ width: 6, height: 1 });
    out.write(0, 0, "ab", {
      transformers: [(line: string) => line.toUpperCase()],
    });
    expect(out.get().output).toBe("AB");
  });

  it("grid_multiline_write_places_each_line", () => {
    const out = new Output({ width: 4, height: 3 });
    out.write(0, 0, "a\nb", noTransforms);
    const rows = out.get().output.split("\n");
    expect(rows[0]).toBe("a");
    expect(rows[1]).toBe("b");
  });

  it("grid_ignores_write_beyond_height", () => {
    // Negative case: a write past the grid height is dropped, not a crash.
    const out = new Output({ width: 4, height: 2 });
    expect(() => out.write(0, 5, "x", noTransforms)).not.toThrow();
    expect(out.get().output.split("\n")).toHaveLength(2);
  });

  it("grid_overwrite_wide_char_trailing_half_cleans_leading", () => {
    // Writing over the trailing half of a wide char must blank its leading cell
    // so the terminal never shows a half-visible wide character.
    const out = new Output({ width: 6, height: 1 });
    out.write(0, 0, "你", noTransforms);
    out.write(1, 0, "x", noTransforms);
    expect(out.get().output).toBe(" x");
  });

  it("grid_overwrite_wide_char_leading_half_cleans_trailing", () => {
    // Writing over the leading half leaves a dangling placeholder → space.
    const out = new Output({ width: 6, height: 1 });
    out.write(0, 0, "你", noTransforms);
    out.write(0, 0, "a", noTransforms);
    expect(out.get().output).toBe("a");
  });

  it("grid_blank_line_within_multiline_write", () => {
    // A blank middle line tokenizes to zero chars — placeLine returns early,
    // leaving that grid row empty.
    const out = new Output({ width: 4, height: 3 });
    out.write(0, 0, "a\n\nb", noTransforms);
    const rows = out.get().output.split("\n");
    expect(rows[0]).toBe("a");
    expect(rows[1]).toBe("");
    expect(rows[2]).toBe("b");
  });

  it("grid_empty_write_is_noop", () => {
    const out = new Output({ width: 4, height: 1 });
    out.write(0, 0, "", noTransforms);
    expect(out.get().output).toBe("");
  });
});
