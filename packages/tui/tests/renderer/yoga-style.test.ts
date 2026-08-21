import { describe, expect, it } from "vitest";
import Yoga from "yoga-layout";

import { applyStyles } from "../../src/renderer/yoga-style.js";

// M18 T1.1 (plan m18-yoga-layout, ADR D1/D4): the style→yoga setter port —
// Ink's styles.js re-implemented (node_modules/ink/build/styles.js). Parity by
// construction: the SAME yoga-layout@3.2.1 setters Ink drives. Asserts read the
// yoga node back through its getters.

describe("applyStyles (M18 T1.1)", () => {
  it("apply_styles_sets_flex_direction", () => {
    const node = Yoga.Node.create();
    applyStyles(node, { flexDirection: "row" });
    expect(node.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_ROW);
    applyStyles(node, { flexDirection: "column" });
    expect(node.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_COLUMN);
    node.free();
  });

  it("apply_styles_sets_padding_and_width", () => {
    const node = Yoga.Node.create();
    applyStyles(node, { paddingLeft: 2, width: 20 });
    expect(node.getPadding(Yoga.EDGE_LEFT).value).toBe(2);
    expect(node.getWidth().value).toBe(20);
    node.free();
  });

  it("apply_styles_sets_flex_grow_shrink", () => {
    const node = Yoga.Node.create();
    applyStyles(node, { flexGrow: 1, flexShrink: 0 });
    expect(node.getFlexGrow()).toBe(1);
    expect(node.getFlexShrink()).toBe(0);
    node.free();
  });

  it("apply_styles_reserves_border", () => {
    const node = Yoga.Node.create();
    applyStyles(node, { borderStyle: "round" });
    expect(node.getBorder(Yoga.EDGE_TOP)).toBe(1);
    expect(node.getBorder(Yoga.EDGE_LEFT)).toBe(1);
    node.free();
  });

  it("apply_styles_percent_and_auto_dimensions", () => {
    // Edge case: string width → percent, undefined → auto (Ink styles.js).
    const node = Yoga.Node.create();
    applyStyles(node, { width: "50%" });
    expect(node.getWidth().unit).toBe(Yoga.UNIT_PERCENT);
    applyStyles(node, { height: undefined });
    expect(node.getHeight().unit).toBe(Yoga.UNIT_AUTO);
    node.free();
  });

  it("apply_styles_margin_and_gap", () => {
    const node = Yoga.Node.create();
    applyStyles(node, { marginTop: 3, gap: 1 });
    expect(node.getMargin(Yoga.EDGE_TOP).value).toBe(3);
    expect(node.getGap(Yoga.GUTTER_ALL)).toBe(1);
    node.free();
  });

  it("apply_styles_empty_is_noop", () => {
    // Negative case: empty style must not throw and leaves defaults.
    const node = Yoga.Node.create();
    expect(() => applyStyles(node, {})).not.toThrow();
    node.free();
  });

  it("apply_styles_position_absolute_static_and_edges", () => {
    const a = Yoga.Node.create();
    applyStyles(a, { position: "absolute", top: 1, left: "10%" });
    expect(a.getPositionType()).toBe(Yoga.POSITION_TYPE_ABSOLUTE);
    expect(a.getPosition(Yoga.EDGE_TOP).value).toBe(1);
    expect(a.getPosition(Yoga.EDGE_LEFT).unit).toBe(Yoga.UNIT_PERCENT);
    a.free();
    const s = Yoga.Node.create();
    applyStyles(s, { position: "static" });
    expect(s.getPositionType()).toBe(Yoga.POSITION_TYPE_STATIC);
    s.free();
    const r = Yoga.Node.create();
    applyStyles(r, { position: "relative" });
    expect(r.getPositionType()).toBe(Yoga.POSITION_TYPE_RELATIVE);
    r.free();
  });

  it("apply_styles_all_margin_and_padding_edges", () => {
    const node = Yoga.Node.create();
    applyStyles(node, {
      margin: 1,
      marginX: 2,
      marginY: 3,
      marginLeft: 4,
      marginRight: 5,
      marginBottom: 6,
      padding: 1,
      paddingX: 2,
      paddingY: 3,
      paddingRight: 4,
      paddingTop: 5,
      paddingBottom: 6,
    });
    expect(node.getMargin(Yoga.EDGE_BOTTOM).value).toBe(6);
    expect(node.getPadding(Yoga.EDGE_BOTTOM).value).toBe(6);
    node.free();
  });

  it("apply_styles_flex_alignments_and_basis_variants", () => {
    const node = Yoga.Node.create();
    applyStyles(node, {
      flexWrap: "wrap",
      alignItems: "center",
      alignSelf: "flex-end",
      justifyContent: "space-between",
      flexBasis: 10,
    });
    expect(node.getFlexWrap()).toBe(Yoga.WRAP_WRAP);
    expect(node.getAlignItems()).toBe(Yoga.ALIGN_CENTER);
    expect(node.getAlignSelf()).toBe(Yoga.ALIGN_FLEX_END);
    expect(node.getJustifyContent()).toBe(Yoga.JUSTIFY_SPACE_BETWEEN);
    expect(node.getFlexBasis().value).toBe(10);
    node.free();
    const pct = Yoga.Node.create();
    applyStyles(pct, { flexBasis: "50%" });
    expect(pct.getFlexBasis().unit).toBe(Yoga.UNIT_PERCENT);
    pct.free();
    const auto = Yoga.Node.create();
    applyStyles(auto, { flexBasis: undefined });
    expect(auto.getFlexBasis().unit).toBe(Yoga.UNIT_AUTO);
    auto.free();
  });

  it("apply_styles_min_max_dimensions_number_and_percent", () => {
    const node = Yoga.Node.create();
    applyStyles(node, {
      minWidth: 5,
      minHeight: "20%",
      maxWidth: 40,
      maxHeight: "80%",
    });
    expect(node.getMinWidth().value).toBe(5);
    expect(node.getMinHeight().unit).toBe(Yoga.UNIT_PERCENT);
    expect(node.getMaxWidth().value).toBe(40);
    expect(node.getMaxHeight().unit).toBe(Yoga.UNIT_PERCENT);
    node.free();
  });

  it("apply_styles_min_max_flipped_units", () => {
    // Complementary units to the prior test: minWidth %, minHeight number,
    // maxWidth %, maxHeight number — closes the remaining setter branches.
    const node = Yoga.Node.create();
    applyStyles(node, {
      minWidth: "30%",
      minHeight: 4,
      maxWidth: "60%",
      maxHeight: 30,
    });
    expect(node.getMinWidth().unit).toBe(Yoga.UNIT_PERCENT);
    expect(node.getMinHeight().value).toBe(4);
    expect(node.getMaxWidth().unit).toBe(Yoga.UNIT_PERCENT);
    expect(node.getMaxHeight().value).toBe(30);
    node.free();
  });

  it("apply_styles_height_number_and_display_none", () => {
    const node = Yoga.Node.create();
    applyStyles(node, { height: 12, display: "none", columnGap: 2, rowGap: 3 });
    expect(node.getHeight().value).toBe(12);
    expect(node.getDisplay()).toBe(Yoga.DISPLAY_NONE);
    expect(node.getGap(Yoga.GUTTER_COLUMN)).toBe(2);
    expect(node.getGap(Yoga.GUTTER_ROW)).toBe(3);
    node.free();
  });

  it("apply_styles_border_edge_toggle_off", () => {
    // A per-edge false disables that edge's reserved cell (Ink border toggles).
    const node = Yoga.Node.create();
    applyStyles(node, { borderStyle: "single", borderTop: false });
    expect(node.getBorder(Yoga.EDGE_TOP)).toBe(0);
    expect(node.getBorder(Yoga.EDGE_BOTTOM)).toBe(1);
    node.free();
  });
});
