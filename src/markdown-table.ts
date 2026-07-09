import stringWidth from "string-width";

// M25 markdown-table layout (plan m25-parity-polish-audit T1.1, ADR A): the PURE
// column-width + fit-or-degrade decision for a GFM table. Binary by design (house
// rule = degrade-as-data): the bordered grid renders ONLY when the full content
// fits the budget — so no cell is ever truncated (no data loss); otherwise the
// caller degrades to aligned plain text (which the renderer wraps, still no loss).
// Width via an injected `measure` (grapheme/EAW-aware `string-width` in production).

export type ColumnAlign = "left" | "center" | "right";

export interface TableLayout {
  /** Per-column content width (the widest cell, header included). */
  widths: number[];
  /** True → the grid can't fit; render aligned plain text instead. */
  degrade: boolean;
}

/** The rendered width of a bordered grid row: `│ c │ c │` = Σwidths + 3n + 1
 * (n+1 verticals + 2n padding spaces). */
export function gridRowWidth(widths: number[]): number {
  const sum = widths.reduce((a, b) => a + b, 0);
  return sum + 3 * widths.length + 1;
}

/** Compute per-column widths and decide grid-vs-degrade against `budget` columns. */
export function computeTableLayout(
  header: readonly string[],
  rows: readonly string[][],
  budget: number,
  measure: (s: string) => number = stringWidth,
): TableLayout {
  const widths = header.map((head, col) => {
    let max = measure(head);
    for (const row of rows) {
      const cell = row[col] ?? "";
      const w = measure(cell);
      if (w > max) max = w;
    }
    return max;
  });
  return { widths, degrade: gridRowWidth(widths) > budget };
}
