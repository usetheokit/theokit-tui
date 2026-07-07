// Pure fill-bar core (plan m5-metrics-surface ADRs D1/D3/D7): the ONE home for
// clamp + fill rounding + glyph repeat. Color/threshold policy stays caller-side
// (bubbles ColorFunc model); no ink, no react.

export interface FillBarOptions {
  /** Glyph for filled cells. Single character. Default "█". */
  fullChar?: string;
  /** Glyph for empty cells. Single character (glyph-distinct — EC-5). Default "░". */
  emptyChar?: string;
  /**
   * Fill-count rounding. Default "round" (bubbles/ink-ui majority);
   * "ceil" opts into gemini-style "nonzero usage always shows ≥ 1 cell".
   */
  rounding?: "round" | "ceil" | "floor";
}

export interface FillBarSegments {
  /** fullChar repeated filledCells times. */
  filled: string;
  /** emptyChar repeated (width − filledCells) times. */
  empty: string;
  filledCells: number;
  width: number;
}

const ROUNDERS = {
  round: Math.round,
  ceil: Math.ceil,
  floor: Math.floor,
} as const;

/**
 * ONE business rule, one home (plan D4, review arch-1): below this many bar
 * cells the metrics components drop the bar and degrade to label-only.
 * Layout invariant of the bar primitive — color policy stays caller-side.
 * NOT re-exported from the package entry.
 */
export const MIN_BAR_CELLS = 3;

/**
 * THE single rounding authority (EC-1): the integer display percent every label
 * AND every bar derives from. Endpoint-honest: 100 is reserved for ratio >= 1
 * and 0 for ratio <= 0 — interior ratios clamp to 1..99 (99.6% reads "99%",
 * 0.4% reads "1%"; no analog protects these endpoints — roadmap risk 2).
 * Exported for the ContextWindowBar 'left' derivation (100 − displayPercent);
 * NOT re-exported from the package entry.
 */
export function displayPercent(ratio: number): number {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) {
    throw new TypeError(
      `displayPercent: ratio must be a finite number — got ${String(ratio)}`,
    );
  }
  if (ratio <= 0) {
    return 0;
  }
  if (ratio >= 1) {
    return 100;
  }
  const rounded = Math.round(ratio * 100);
  return Math.min(99, Math.max(1, rounded));
}

/** displayPercent rendered as a label. Same authority — see displayPercent. */
export function formatPercent(ratio: number): string {
  return `${displayPercent(ratio)}%`;
}

function assertSingleChar(value: string, name: string): void {
  if (value.length !== 1) {
    throw new TypeError(
      `renderFillBar: ${name} must be a single character — got ${JSON.stringify(value)}`,
    );
  }
}

/** Integer-numerator fill count (EC-2) + endpoint guard (EC-1, width >= 2). */
function computeFilledCells(
  percent: number,
  cells: number,
  rounding: "round" | "ceil" | "floor",
): number {
  const base = ROUNDERS[rounding]((percent * cells) / 100);
  let filled = Math.min(cells, Math.max(0, base));
  if (cells >= 2) {
    if (percent > 0 && filled === 0) {
      filled = 1;
    }
    if (percent < 100 && filled === cells) {
      filled = cells - 1;
    }
  }
  return filled;
}

/**
 * Maps a ratio to bar segments at `width` cells. Ratio clamps to [0,1]; width
 * clamps to >= 0 (EC-4 — degrade, never throw). Endpoint guard at width >= 2:
 * a nonzero ratio never renders 0 cells and a sub-full ratio never renders a
 * full bar — bar and label agree by construction (both consume displayPercent).
 */
export function renderFillBar(
  ratio: number,
  width: number,
  options?: FillBarOptions,
): FillBarSegments {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) {
    throw new TypeError(
      `renderFillBar: ratio must be a finite number — got ${String(ratio)}`,
    );
  }
  const fullChar = options?.fullChar ?? "█";
  const emptyChar = options?.emptyChar ?? "░";
  assertSingleChar(fullChar, "fullChar");
  assertSingleChar(emptyChar, "emptyChar");

  const cells = Math.max(0, Math.floor(width));
  const filledCells = computeFilledCells(
    displayPercent(ratio),
    cells,
    options?.rounding ?? "round",
  );
  return {
    filled: fullChar.repeat(filledCells),
    empty: emptyChar.repeat(cells - filledCells),
    filledCells,
    width: cells,
  };
}
