import type { BoxProps } from "ink";

/**
 * The margin family every public component accepts, so any component can be
 * spaced from its neighbours without a wrapper `<Box>`. Mirrors the CSS / Ink
 * margin surface exactly (`margin`, the axis shorthands `marginX`/`marginY`,
 * and the four sides).
 *
 * CONTRACT (backward-compat invariant): all fields are optional and default to
 * `undefined`. A component spreads these onto its root `<Box>` — when the
 * consumer passes none, the spread is a no-op and output is byte-identical to
 * before this prop existed. Text-rooted components (which Ink does not let carry
 * margin) wrap their root in a margin-carrying `<Box>`; components built on
 * `<Static>` (ChatThread, AgentTimeline) carry the margin on their live region.
 *
 * Values are cell counts (terminal rows/columns), never CSS units.
 */
export type LayoutMarginProps = Pick<
  BoxProps,
  "margin" | "marginX" | "marginY" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
>;

/** The margin keys in a stable order — the single source the sweep relies on. */
export const LAYOUT_MARGIN_KEYS = [
  "margin",
  "marginX",
  "marginY",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
] as const;

/**
 * Extract ONLY the margin fields from a props object, dropping `undefined`
 * entries. Components that cannot use rest-spread (because they read individual
 * props rather than destructuring) call this to get a clean object to spread
 * onto their root `<Box>`: `<Box {...pickMargin(props)}>`.
 *
 * Dropping `undefined` keeps the no-op invariant strict — the returned object is
 * empty (`{}`) when no margin was passed, so spreading it changes nothing.
 */
export function pickMargin(props: LayoutMarginProps): LayoutMarginProps {
  const out: Record<string, number> = {};
  for (const key of LAYOUT_MARGIN_KEYS) {
    const value = props[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * How many COLUMNS the horizontal margin box takes from the row.
 *
 * A component that pins its root `<Box>` to the terminal width must subtract
 * this, otherwise the margin is ADDED to that width and the row overflows the
 * terminal (issue #56). Yoga's precedence is the CSS one — the specific side
 * wins over the axis shorthand, which wins over `margin` — so it is resolved
 * here once instead of at each call site.
 *
 * `marginY` is deliberately ignored: vertical margin costs rows, not columns.
 */
export function horizontalMargin(props: LayoutMarginProps): number {
  const axis = props.marginX ?? props.margin ?? 0;
  return (props.marginLeft ?? axis) + (props.marginRight ?? axis);
}

/**
 * The mirror of {@link pickMargin}: return a props object with the margin keys
 * REMOVED. A component that owns its root `<Box>` (carrying the margin) but
 * forwards the remaining props to a child component uses this to avoid applying
 * the same margin twice — `<Box {...pickMargin(p)}><Child {...omitMargin(p)} /></Box>`.
 */
export function omitMargin<T extends object>(props: T): Omit<T, keyof LayoutMarginProps> {
  const marginKeys = LAYOUT_MARGIN_KEYS as readonly string[];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!marginKeys.includes(key)) {
      out[key] = value;
    }
  }
  return out as Omit<T, keyof LayoutMarginProps>;
}
