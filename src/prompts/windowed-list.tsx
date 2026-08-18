import { Box, Text } from "ink";
import type { ReactNode } from "react";

import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";
import { windowFor } from "./select-list-model.js";

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
 * `windowFor` does not validate: measured, `window = 0` returns a `windowStart` PAST the selection
 * and `window = -1` returns `hiddenBefore 11` + `hiddenAfter 10` for a list of 20 — counts that
 * contradict the total. A view built on that would state a falsehood in numbers, which is worse
 * than rendering nothing, so this refuses at the boundary and names the component (ADR D4).
 */
function assertWindow(window: number): void {
  if (typeof window !== "number" || !Number.isInteger(window) || window < 1) {
    throw new TypeError(
      `WindowedList: window must be a finite integer >= 1 — got ${String(window)}`,
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
 * The counts are the point. `SelectList` renders a bare `▲` and throws away the `hiddenBefore` it
 * computed in the same view object, and a boolean cannot be turned back into a number.
 */
export function WindowedList({
  rows,
  selected = NO_SELECTION,
  window = DEFAULT_WINDOW,
  header,
  ...margin
}: WindowedListProps) {
  // Boundary guard FIRST — the F10 idiom `CostMeter` and `ContextWindowBar` use.
  assertWindow(window);

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
