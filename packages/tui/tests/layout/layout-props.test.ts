import { describe, expect, it } from "vitest";
import type { LayoutMarginProps } from "../../src/layout/layout-props.js";
import {
  horizontalMargin,
  LAYOUT_MARGIN_KEYS,
  omitMargin,
  pickMargin,
} from "../../src/layout/layout-props.js";

describe("pickMargin (universal margin)", () => {
  it("returns_empty_object_when_no_margin_passed", () => {
    // The backward-compat invariant: spreading the result is a no-op.
    expect(pickMargin({})).toEqual({});
  });

  it("keeps_only_defined_margin_fields", () => {
    // Simulate a JS caller that passes an explicit `undefined` (the reason the
    // helper drops undefined rather than relying on TS optionality).
    const fromJs = {
      marginTop: 2,
      marginBottom: undefined,
    } as unknown as LayoutMarginProps;
    const result = pickMargin(fromJs);
    expect(result).toEqual({ marginTop: 2 });
    expect("marginBottom" in result).toBe(false);
  });

  it("passes_through_every_margin_key_including_shorthands", () => {
    const all = {
      margin: 1,
      marginX: 2,
      marginY: 3,
      marginTop: 4,
      marginRight: 5,
      marginBottom: 6,
      marginLeft: 7,
    };
    expect(pickMargin(all)).toEqual(all);
  });

  it("ignores_non_margin_keys", () => {
    // @ts-expect-error — deliberately passing a foreign key (negative case).
    const result = pickMargin({ marginTop: 1, padding: 9, color: "red" });
    expect(result).toEqual({ marginTop: 1 });
  });

  it("omitMargin_removes_margin_keys_keeps_the_rest", () => {
    // A variable (not an inline literal) so the wider type is inferred for T.
    const input = { name: "read", marginTop: 2, marginX: 1 };
    const result = omitMargin(input);
    expect(result).toEqual({ name: "read" });
  });

  it("omitMargin_is_a_no_op_when_no_margin_present", () => {
    const input = { name: "read", status: "ok" };
    expect(omitMargin(input)).toEqual({ name: "read", status: "ok" });
  });

  it("horizontal_margin_is_zero_when_none_passed", () => {
    expect(horizontalMargin({})).toBe(0);
  });

  it("horizontal_margin_sums_both_sides", () => {
    expect(horizontalMargin({ marginLeft: 4, marginRight: 2 })).toBe(6);
  });

  it("horizontal_margin_counts_the_margin_x_shorthand_twice", () => {
    expect(horizontalMargin({ marginX: 3 })).toBe(6);
  });

  it("horizontal_margin_counts_the_margin_shorthand_twice", () => {
    expect(horizontalMargin({ margin: 5 })).toBe(10);
  });

  it("horizontal_margin_lets_the_specific_side_win_over_the_shorthands", () => {
    // CSS/Yoga precedence: marginLeft > marginX > margin. The unset side falls
    // back to the nearest shorthand — here `marginX`, not `margin`.
    expect(horizontalMargin({ margin: 1, marginX: 2, marginLeft: 9 })).toBe(11);
    expect(horizontalMargin({ margin: 1, marginRight: 9 })).toBe(10);
  });

  it("horizontal_margin_ignores_the_vertical_family", () => {
    // Vertical margin costs ROWS, never columns — it must not shrink a width.
    expect(horizontalMargin({ marginY: 4, marginTop: 3, marginBottom: 2 })).toBe(0);
  });

  it("exposes_the_seven_margin_keys_in_stable_order", () => {
    expect([...LAYOUT_MARGIN_KEYS]).toEqual([
      "margin",
      "marginX",
      "marginY",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
    ]);
  });
});
