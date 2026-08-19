import { Box, Text } from "ink";
import type { ReactNode } from "react";

import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";
import { windowFor } from "./select-list-model.js";
import { reportGuardFailure } from "../status/guard-sink.js";

/** No selection. Rendering then marks no row active. */
const NO_SELECTION = -1;

const DEFAULT_WINDOW = 7;

export interface WindowedListProps extends LayoutMarginProps {
  /** The rows, newest last. Each renders as exactly ONE line (see ADR D5). */
  rows: readonly string[];
  /**
   * Index of the active row, or absent for none. Out-of-range values clamp, matching
   * {@link windowFor}.
   */
  selected?: number;
  /** Visible rows. Finite integer >= 1; default 7. */
  window?: number;
  /**
   * Rendered above the window. A SLOT rather than a prop set, because a header is where a product
   * names its own gesture — "Esc for older", "Enter to edit" — and this package must not put those
   * words in its mouth (ADR D1). Absent renders no header at all.
   */
  header?: ReactNode;
}

/**
 * One row is one line.
 *
 * The hidden-row counts are reported in ROWS, so a row carrying a newline would render as two
 * terminal lines and "7 visible, 12 above" would stop describing what the user sees — which is the
 * one thing this component exists to get right (ADR D5).
 */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The window guard, extracted so the component body stays under the repo's complexity ceiling.
 *
 * This guard predates `windowFor`'s own. It was written because `windowFor` did NOT validate —
 * measured then, `window = 0` returned a `windowStart` PAST the selection and `window = -1`
 * returned `hiddenBefore 11` + `hiddenAfter 10` for a list of 20, counts contradicting the total.
 *
 * B-021 fixed that at the source, so the original justification no longer holds. This guard stays
 * for the reason `agent-timeline.tsx:62` gives: a component naming ITSELF sends the caller to the
 * code they wrote, where `windowFor`'s message names a model function they never called. Unlike
 * `SelectList` it does not report through the sink — the honest residue of B-021, left rather than
 * papered over.
 */
function assertWindow(window: number): void {
  if (typeof window !== "number" || !Number.isInteger(window) || window < 1) {
    reportGuardFailure(
      "WindowedList",
      new TypeError(
        `WindowedList: window must be a finite integer >= 1 — got ${String(window)}`,
      ),
    );
  }
}

/**
 * B-026 — the guard `window` had and `selected` did not.
 *
 * `windowFor` clamps with `Math.min(Math.max(selectionIndex, 0), count - 1)`, and every comparison
 * against `NaN` is false, so `clampedIndex` and `windowStart` both become `NaN` and
 * `rows.slice(NaN, NaN)` returns `[]`. The list rendered EMPTY — no error, no log, nothing on
 * screen — and no test written alongside this component asked. An adversarial probe did.
 *
 * Out-of-range integers are NOT rejected: clamping them is the documented behaviour, and `-1` is
 * the no-selection sentinel. What is refused is a value that is not an integer at all, because
 * that is the one the arithmetic cannot express and silently answers with nothing.
 */
function assertSelected(selected: number): void {
  if (typeof selected !== "number" || !Number.isInteger(selected)) {
    reportGuardFailure(
      "WindowedList",
      new TypeError(
        `WindowedList: selected must be an integer (or ${String(NO_SELECTION)} for none) — got ${String(selected)}`,
      ),
    );
  }
}

/** One row of the window. Extracted for the same reason as the guard. */
function WindowedRow({
  row,
  active,
  accent,
}: {
  row: string;
  active: boolean;
  accent: { color?: string };
}) {
  return (
    <Text {...(active ? accent : { dimColor: true })}>
      {active ? "❯ " : "  "}
      {oneLine(row)}
    </Text>
  );
}

/**
 * A centred window over a list of rows, with the hidden rows reported as COUNTS.
 *
 * Presentational: it captures no input, requires no handler, and renders no copy of its own. Reach
 * for {@link SelectList} instead when the user must filter and choose; reach for this when
 * something else owns the keys and this only has to show where you are.
 *
 * The counts are the point: a boolean cannot be turned back into a number, so the model carries
 * `hiddenBefore` / `hiddenAfter` alongside the `overflowUp` / `overflowDown` derived from them, and
 * this component renders the numbers.
 */
export function WindowedList({
  rows,
  selected = NO_SELECTION,
  window = DEFAULT_WINDOW,
  header,
  ...margin
}: WindowedListProps) {
  // Boundary guards FIRST — the F10 idiom `CostMeter` and `ContextWindowBar` use.
  assertWindow(window);
  assertSelected(selected);

  const theme = useTheoTheme();
  const mono = isMonochrome(theme);
  const accent = mono ? {} : { color: theme.accent };

  if (rows.length === 0) {
    return null;
  }

  const view = windowFor(rows.length, selected, window, "centred");
  const visible = rows.slice(view.windowStart, view.windowStart + window);
  const active = selected === NO_SELECTION ? NO_SELECTION : view.clampedIndex;

  return (
    <Box flexDirection="column" {...pickMargin(margin)}>
      {header === undefined ? null : <Box>{header}</Box>}
      {view.hiddenBefore > 0 ? (
        <Text dimColor>▲ {view.hiddenBefore}</Text>
      ) : null}
      {visible.map((row, index) => (
        <WindowedRow
          key={`${String(view.windowStart + index)}:${row}`}
          row={row}
          active={view.windowStart + index === active}
          accent={accent}
        />
      ))}
      {view.hiddenAfter > 0 ? <Text dimColor>▼ {view.hiddenAfter}</Text> : null}
    </Box>
  );
}
