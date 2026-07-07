// Pure metric formatters (plan m5-metrics-surface ADR D3): hand-rolled and
// deterministic by construction — Intl compact was evaluated and REJECTED
// (CLDR-version-dependent boundaries, small-icu builds, 2-sig-fig cap). Every
// behavior here is pinned by an exact-value oracle in format.test.ts.
// Float caveat: oracle rows are chosen away from binary-representation edges;
// each formatter rounds at ONE site (integer-scaled Math.round).

const TOKEN_UNITS = [
  { suffix: "k", scale: 1e3 },
  { suffix: "m", scale: 1e6 },
  { suffix: "b", scale: 1e9 },
] as const;

function assertFiniteNonNegative(value: number, message: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${message} — got ${String(value)}`);
  }
}

/** Rounded to 1 decimal, trailing ".0" stripped ("1k", "1.1k"). */
function oneDecimal(scaled: number): number {
  return Math.round(scaled * 10) / 10;
}

/**
 * Compact token count: exact digits below 1000, then lowercase k/m (gemini
 * casing) with HALF-UP 1-decimal rounding and BOUNDARY PROMOTION — 999_950
 * renders "1m", never the un-promoted "1000K" the codex formatter ships.
 * Promotion saturates at "b" (the last unit — an undesigned-but-defined tail).
 */
export function formatTokens(value: number): string {
  assertFiniteNonNegative(
    value,
    "formatTokens: value must be a finite number >= 0",
  );
  const n = Math.floor(value);
  if (n < 1000) {
    return String(n);
  }
  for (let i = 0; i < TOKEN_UNITS.length; i++) {
    const unit = TOKEN_UNITS[i] as (typeof TOKEN_UNITS)[number];
    const d = oneDecimal(n / unit.scale);
    if (d < 1000 || i === TOKEN_UNITS.length - 1) {
      return `${String(d)}${unit.suffix}`;
    }
  }
  /* v8 ignore next 2 */ // unreachable — the last unit always returns
  throw new Error("formatTokens: unit walk exhausted");
}

/** Insert thousands separators into an integer-digit string. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export interface FormatCostOptions {
  /**
   * Prefix the value with "~" (the number derives from token counts × price
   * sheets — an estimate). Default true; sub-cent "<$0.01" renders WITHOUT the
   * marker ("<" already communicates imprecision).
   */
  approx?: boolean;
}

/**
 * Honest USD cost: two half-up decimals with thousands separators; a nonzero
 * sub-cent cost renders "<$0.01", NEVER "$0.00" (a rendered lie); exactly 0 is
 * exact ("$0.00", no marker).
 */
export function formatCost(
  costUsd: number,
  options?: FormatCostOptions,
): string {
  assertFiniteNonNegative(
    costUsd,
    "formatCost: costUsd must be a finite number >= 0",
  );
  const approx = options?.approx ?? true;
  if (costUsd === 0) {
    return "$0.00";
  }
  if (costUsd < 0.005) {
    return "<$0.01";
  }
  const cents = Math.round(costUsd * 100);
  const dollars = groupThousands(String(Math.floor(cents / 100)));
  const remainder = String(cents % 100).padStart(2, "0");
  return `${approx ? "~" : ""}$${dollars}.${remainder}`;
}
