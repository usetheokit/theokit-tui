import { Box, Text } from "ink";

import { MIN_BAR_CELLS, renderFillBar } from "./fill-bar.js";
import { useTheoTheme } from "./theme.js";
import { assertFiniteNonNegative, formatTokens } from "./format.js";

/** Fixed row order (codex fields ∪ gemini metrics — plan ADR D2). */
const TOKEN_CATEGORIES = ["input", "output", "cached", "reasoning"] as const;

export type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

export interface TokenUsageChartProps {
  /**
   * Token counts per category. Only PRESENT keys render (absent ≠ zero — a
   * present 0 renders an empty bar + "0"). All absent → renders nothing.
   */
  usage: Partial<Record<TokenCategory, number>>;
  /** Total column budget per row (label + bar + value). Integer >= 0. Default 40. */
  width?: number;
}

interface ChartRow {
  category: TokenCategory;
  value: number;
  formatted: string;
}

function collectRows(usage: TokenUsageChartProps["usage"]): ChartRow[] {
  const rows: ChartRow[] = [];
  for (const category of TOKEN_CATEGORIES) {
    const value = usage[category];
    if (value === undefined) {
      continue;
    }
    assertFiniteNonNegative(
      value,
      `TokenUsageChart: usage.${category} must be a finite number >= 0`,
    );
    rows.push({ category, value, formatted: formatTokens(value) });
  }
  return rows;
}

/**
 * Per-category comparison bars: each bar scales to the LARGEST present
 * category (relative comparison — "where did tokens go"; total tokens is NOT
 * a limit, the gauge for that is ContextWindowBar — plan ADR D8).
 */
export function TokenUsageChart({ usage, width = 40 }: TokenUsageChartProps) {
  // Boundary guards FIRST, before hooks (F10 idiom).
  const rows = collectRows(usage);
  if (!Number.isInteger(width) || width < 0) {
    throw new TypeError(
      `TokenUsageChart: width must be an integer >= 0 — got ${String(width)}`,
    );
  }
  const theme = useTheoTheme();
  if (rows.length === 0) {
    return null;
  }

  const labelCol = Math.max(...rows.map((r) => r.category.length));
  const valueCol = Math.max(...rows.map((r) => r.formatted.length));
  const barCells = width - labelCol - valueCol - 2;
  // max === 0 (all present values 0) → every ratio is 0; 0/0 is NaN and the
  // core fail-fasts on it (EC-3 — a VALID all-zero chart must not throw).
  const maxValue = Math.max(...rows.map((r) => r.value));

  return (
    <Box flexDirection="column">
      {rows.map((row) => {
        const label = row.category.padEnd(labelCol);
        const value = row.formatted.padStart(valueCol);
        if (barCells < MIN_BAR_CELLS) {
          return (
            <Box key={row.category}>
              <Text dimColor>{label} </Text>
              <Text>{value}</Text>
            </Box>
          );
        }
        const ratio = maxValue === 0 ? 0 : row.value / maxValue;
        const segments = renderFillBar(ratio, barCells);
        return (
          <Box key={row.category}>
            <Text dimColor>{label} </Text>
            <Text color={theme.accent}>{segments.filled}</Text>
            <Text dimColor>{segments.empty}</Text>
            <Text> {value}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
