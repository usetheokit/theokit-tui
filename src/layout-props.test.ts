import { describe, expect, it } from "vitest";

import { LAYOUT_MARGIN_KEYS, omitMargin, pickMargin } from "./layout-props.js";
import type { LayoutMarginProps } from "./layout-props.js";

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
