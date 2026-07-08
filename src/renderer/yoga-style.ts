import Yoga, { type Node as YogaNode } from "yoga-layout";

// M18 yoga-style (plan m18-yoga-layout, ADR D1/D4): the style→yoga setter map —
// a faithful re-implementation of Ink's styles.js (node_modules/ink/build/
// styles.js), re-typed in our strict TS. Parity by construction: the SAME
// yoga-layout@3.2.1 setters, applied in the SAME order Ink applies them, so a
// tree configured here lays out byte-identically to Ink. The full prop set is
// ported (not a corpus subset) so no component can hit an unimplemented prop.

/** The Box/Text layout style surface (Ink's Styles, our subset of names). */
export interface Style {
  position?: "absolute" | "relative" | "static";
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  margin?: number;
  marginX?: number;
  marginY?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  flexDirection?: "row" | "row-reverse" | "column" | "column-reverse";
  // number → point, string → percent, undefined → auto (Ink's dimension model).
  flexBasis?: number | string | undefined;
  alignItems?: "stretch" | "flex-start" | "center" | "flex-end" | "baseline";
  alignSelf?:
    "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  width?: number | string | undefined;
  height?: number | string | undefined;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  display?: "flex" | "none";
  borderStyle?: string;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  gap?: number;
  columnGap?: number;
  rowGap?: number;
  textWrap?: string;
}

const positionEdges: [keyof Style, number][] = [
  ["top", Yoga.EDGE_TOP],
  ["right", Yoga.EDGE_RIGHT],
  ["bottom", Yoga.EDGE_BOTTOM],
  ["left", Yoga.EDGE_LEFT],
];

function applyPosition(node: YogaNode, style: Style): void {
  if ("position" in style) {
    const type =
      style.position === "absolute"
        ? Yoga.POSITION_TYPE_ABSOLUTE
        : style.position === "static"
          ? Yoga.POSITION_TYPE_STATIC
          : Yoga.POSITION_TYPE_RELATIVE;
    node.setPositionType(type);
  }
  for (const [property, edge] of positionEdges) {
    if (!(property in style)) {
      continue;
    }
    const value = style[property];
    if (typeof value === "string") {
      node.setPositionPercent(edge, Number.parseFloat(value));
    } else if (typeof value === "number") {
      node.setPosition(edge, value);
    }
  }
}

const marginEdges: [keyof Style, number][] = [
  ["margin", Yoga.EDGE_ALL],
  ["marginX", Yoga.EDGE_HORIZONTAL],
  ["marginY", Yoga.EDGE_VERTICAL],
  ["marginLeft", Yoga.EDGE_START],
  ["marginRight", Yoga.EDGE_END],
  ["marginTop", Yoga.EDGE_TOP],
  ["marginBottom", Yoga.EDGE_BOTTOM],
];

const paddingEdges: [keyof Style, number][] = [
  ["padding", Yoga.EDGE_ALL],
  ["paddingX", Yoga.EDGE_HORIZONTAL],
  ["paddingY", Yoga.EDGE_VERTICAL],
  ["paddingLeft", Yoga.EDGE_LEFT],
  ["paddingRight", Yoga.EDGE_RIGHT],
  ["paddingTop", Yoga.EDGE_TOP],
  ["paddingBottom", Yoga.EDGE_BOTTOM],
];

function applyMargin(node: YogaNode, style: Style): void {
  for (const [prop, edge] of marginEdges) {
    if (prop in style) {
      node.setMargin(edge, (style[prop] as number | undefined) ?? 0);
    }
  }
}

function applyPadding(node: YogaNode, style: Style): void {
  for (const [prop, edge] of paddingEdges) {
    if (prop in style) {
      node.setPadding(edge, (style[prop] as number | undefined) ?? 0);
    }
  }
}

const flexDirections: Record<string, number> = {
  row: Yoga.FLEX_DIRECTION_ROW,
  "row-reverse": Yoga.FLEX_DIRECTION_ROW_REVERSE,
  column: Yoga.FLEX_DIRECTION_COLUMN,
  "column-reverse": Yoga.FLEX_DIRECTION_COLUMN_REVERSE,
};

const flexWraps: Record<string, number> = {
  nowrap: Yoga.WRAP_NO_WRAP,
  wrap: Yoga.WRAP_WRAP,
  "wrap-reverse": Yoga.WRAP_WRAP_REVERSE,
};

const alignItemsMap: Record<string, number> = {
  stretch: Yoga.ALIGN_STRETCH,
  "flex-start": Yoga.ALIGN_FLEX_START,
  center: Yoga.ALIGN_CENTER,
  "flex-end": Yoga.ALIGN_FLEX_END,
  baseline: Yoga.ALIGN_BASELINE,
};

const alignSelfMap: Record<string, number> = {
  auto: Yoga.ALIGN_AUTO,
  "flex-start": Yoga.ALIGN_FLEX_START,
  center: Yoga.ALIGN_CENTER,
  "flex-end": Yoga.ALIGN_FLEX_END,
  stretch: Yoga.ALIGN_STRETCH,
  baseline: Yoga.ALIGN_BASELINE,
};

const justifyMap: Record<string, number> = {
  "flex-start": Yoga.JUSTIFY_FLEX_START,
  center: Yoga.JUSTIFY_CENTER,
  "flex-end": Yoga.JUSTIFY_FLEX_END,
  "space-between": Yoga.JUSTIFY_SPACE_BETWEEN,
  "space-around": Yoga.JUSTIFY_SPACE_AROUND,
  "space-evenly": Yoga.JUSTIFY_SPACE_EVENLY,
};

/** Look up `key` in `style`, resolve via `map` (falling back to `fallback`), call `set`. */
function applyEnum(
  present: boolean,
  value: string | undefined,
  map: Record<string, number>,
  fallback: number,
  set: (v: number) => void,
): void {
  if (present) {
    set(value !== undefined && value in map ? map[value]! : fallback);
  }
}

function applyFlexBasis(node: YogaNode, style: Style): void {
  if (!("flexBasis" in style)) {
    return;
  }
  if (typeof style.flexBasis === "number") {
    node.setFlexBasis(style.flexBasis);
  } else if (typeof style.flexBasis === "string") {
    node.setFlexBasisPercent(Number.parseInt(style.flexBasis, 10));
  } else {
    node.setFlexBasisAuto();
  }
}

function applyFlex(node: YogaNode, style: Style): void {
  if ("flexGrow" in style) node.setFlexGrow(style.flexGrow ?? 0);
  if ("flexShrink" in style) {
    node.setFlexShrink(
      typeof style.flexShrink === "number" ? style.flexShrink : 1,
    );
  }
  applyEnum(
    !!style.flexWrap,
    style.flexWrap,
    flexWraps,
    Yoga.WRAP_NO_WRAP,
    (v) => node.setFlexWrap(v),
  );
  applyEnum(
    !!style.flexDirection,
    style.flexDirection,
    flexDirections,
    Yoga.FLEX_DIRECTION_ROW,
    (v) => node.setFlexDirection(v),
  );
  applyFlexBasis(node, style);
  applyEnum(
    "alignItems" in style,
    style.alignItems,
    alignItemsMap,
    Yoga.ALIGN_STRETCH,
    (v) => node.setAlignItems(v),
  );
  applyEnum(
    "alignSelf" in style,
    style.alignSelf,
    alignSelfMap,
    Yoga.ALIGN_AUTO,
    (v) => node.setAlignSelf(v),
  );
  applyEnum(
    "justifyContent" in style,
    style.justifyContent,
    justifyMap,
    Yoga.JUSTIFY_FLEX_START,
    (v) => node.setJustifyContent(v),
  );
}

function setDimension(
  value: number | string | undefined,
  setPoint: (v: number) => void,
  setPercent: (v: number) => void,
  setAuto: () => void,
): void {
  if (typeof value === "number") {
    setPoint(value);
  } else if (typeof value === "string") {
    setPercent(Number.parseInt(value, 10));
  } else {
    setAuto();
  }
}

/** A min-/max- constraint: string → percent, else point (defaulting to 0). */
function applyConstraint(
  value: number | string | undefined,
  setPoint: (v: number) => void,
  setPercent: (v: number) => void,
): void {
  if (typeof value === "string") {
    setPercent(Number.parseInt(value, 10));
  } else {
    setPoint(value ?? 0);
  }
}

function applyDimensions(node: YogaNode, style: Style): void {
  if ("width" in style) {
    setDimension(
      style.width,
      (v) => node.setWidth(v),
      (v) => node.setWidthPercent(v),
      () => node.setWidthAuto(),
    );
  }
  if ("height" in style) {
    setDimension(
      style.height,
      (v) => node.setHeight(v),
      (v) => node.setHeightPercent(v),
      () => node.setHeightAuto(),
    );
  }
  if ("minWidth" in style) {
    applyConstraint(
      style.minWidth,
      (v) => node.setMinWidth(v),
      (v) => node.setMinWidthPercent(v),
    );
  }
  if ("minHeight" in style) {
    applyConstraint(
      style.minHeight,
      (v) => node.setMinHeight(v),
      (v) => node.setMinHeightPercent(v),
    );
  }
  if ("maxWidth" in style && style.maxWidth !== undefined) {
    applyConstraint(
      style.maxWidth,
      (v) => node.setMaxWidth(v),
      (v) => node.setMaxWidthPercent(v),
    );
  }
  if ("maxHeight" in style && style.maxHeight !== undefined) {
    applyConstraint(
      style.maxHeight,
      (v) => node.setMaxHeight(v),
      (v) => node.setMaxHeightPercent(v),
    );
  }
}

function applyDisplay(node: YogaNode, style: Style): void {
  if ("display" in style) {
    node.setDisplay(
      style.display === "none" ? Yoga.DISPLAY_NONE : Yoga.DISPLAY_FLEX,
    );
  }
}

const borderEdges: [keyof Style, number][] = [
  ["borderTop", Yoga.EDGE_TOP],
  ["borderBottom", Yoga.EDGE_BOTTOM],
  ["borderLeft", Yoga.EDGE_LEFT],
  ["borderRight", Yoga.EDGE_RIGHT],
];

function applyBorder(node: YogaNode, style: Style, currentStyle: Style): void {
  const hasBorderChanges =
    "borderStyle" in style || borderEdges.some(([prop]) => prop in style);
  if (!hasBorderChanges) {
    return;
  }
  const borderWidth = currentStyle.borderStyle ? 1 : 0;
  for (const [prop, edge] of borderEdges) {
    node.setBorder(edge, currentStyle[prop] === false ? 0 : borderWidth);
  }
}

function applyGap(node: YogaNode, style: Style): void {
  if ("gap" in style) node.setGap(Yoga.GUTTER_ALL, style.gap ?? 0);
  if ("columnGap" in style)
    node.setGap(Yoga.GUTTER_COLUMN, style.columnGap ?? 0);
  if ("rowGap" in style) node.setGap(Yoga.GUTTER_ROW, style.rowGap ?? 0);
}

/**
 * Apply `style` to `node`, in Ink's exact order. `currentStyle` is the merged
 * style used for border-width computation (Ink passes the full style on update
 * so a border toggle reads the whole picture); it defaults to `style`.
 */
export function applyStyles(
  node: YogaNode,
  style: Style = {},
  currentStyle: Style = style,
): void {
  applyPosition(node, style);
  applyMargin(node, style);
  applyPadding(node, style);
  applyFlex(node, style);
  applyDimensions(node, style);
  applyDisplay(node, style);
  applyBorder(node, style, currentStyle);
  applyGap(node, style);
}
