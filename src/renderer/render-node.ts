import cliBoxes, { type BoxStyle } from "cli-boxes";
import chalk from "chalk";
import widestLine from "widest-line";
import Yoga, { type Node as YogaNode } from "yoga-layout";

import type { RendererNode } from "./host-config.js";
import type { Output } from "./output-grid.js";
import { squashTextNodes, wrapText } from "./text-measure.js";

// M18 render-node (plan m18-yoga-layout, ADR D2): the laid-out-tree → cell-grid
// walk — a faithful port of Ink's render-node-to-output.js + render-border.js +
// get-max-width.js, reduced to the M18 surface: NO clips (overflow unused), NO
// accessibility/static (unused). Borders + foreground colors are ported because
// WelcomeBanner uses them; border backgrounds/dim and per-edge colors are
// deferred (no component uses them — see the M18 parity report).

type Transformer = (line: string, index: number) => string;

interface WalkOptions {
  offsetX: number;
  offsetY: number;
  transformers: Transformer[];
  /**
   * When true, subtrees marked `internal_static` are skipped — the live pass
   * omits graduated scrollback (rendered separately, ONCE, via the engine's
   * `writeStatic`). Ink's render-node-to-output.js:73 (M20 T1.1 / ADR D1).
   */
  skipStaticElements?: boolean | undefined;
}

/** Content width available to text = computed width minus padding + border (Ink get-max-width.js). */
function getMaxWidth(yogaNode: YogaNode): number {
  return (
    yogaNode.getComputedWidth() -
    yogaNode.getComputedPadding(Yoga.EDGE_LEFT) -
    yogaNode.getComputedPadding(Yoga.EDGE_RIGHT) -
    yogaNode.getComputedBorder(Yoga.EDGE_LEFT) -
    yogaNode.getComputedBorder(Yoga.EDGE_RIGHT)
  );
}

/** Apply a foreground color via chalk (named / #hex / ansi256 / rgb) — Ink colorize.js. */
export function colorizeForeground(
  str: string,
  color: string | undefined,
): string {
  if (!color) {
    return str;
  }
  if (color in chalk) {
    return (chalk as unknown as Record<string, (s: string) => string>)[color]!(
      str,
    );
  }
  if (color.startsWith("#")) {
    return chalk.hex(color)(str);
  }
  const ansi = /^ansi256\(\s?(\d+)\s?\)$/.exec(color);
  if (ansi) {
    return chalk.ansi256(Number(ansi[1]))(str);
  }
  const rgb = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/.exec(color);
  if (rgb) {
    return chalk.rgb(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]))(str);
  }
  return str;
}

interface BoxBorderStyle {
  borderStyle?: string;
  borderColor?: string;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
}

interface BorderPlan {
  box: BoxStyle;
  color: string | undefined;
  showTop: boolean;
  showBottom: boolean;
  showLeft: boolean;
  showRight: boolean;
  width: number;
  height: number;
  contentWidth: number;
  verticalHeight: number;
  offsetY: number;
}

/** Resolve the border geometry + toggles from a box's style + computed size. */
function borderPlan(
  style: BoxBorderStyle,
  width: number,
  height: number,
): BorderPlan {
  const showTop = style.borderTop !== false;
  const showBottom = style.borderBottom !== false;
  const showLeft = style.borderLeft !== false;
  const showRight = style.borderRight !== false;
  return {
    box: cliBoxes[style.borderStyle as keyof typeof cliBoxes],
    color: style.borderColor,
    showTop,
    showBottom,
    showLeft,
    showRight,
    width,
    height,
    contentWidth: width - (showLeft ? 1 : 0) - (showRight ? 1 : 0),
    verticalHeight: height - (showTop ? 1 : 0) - (showBottom ? 1 : 0),
    offsetY: showTop ? 1 : 0,
  };
}

/** A horizontal border edge (top or bottom): corner + repeated mid + corner. */
function horizontalEdge(
  p: BorderPlan,
  left: string,
  mid: string,
  right: string,
): string {
  return (
    (p.showLeft ? left : "") +
    mid.repeat(p.contentWidth) +
    (p.showRight ? right : "")
  );
}

/** Draw a box border into the grid (Ink render-border.js, reduced to fg color). */
function renderBorder(
  x: number,
  y: number,
  node: RendererNode,
  output: Output,
): void {
  const style = (node.props.style as BoxBorderStyle | undefined) ?? {};
  if (!style.borderStyle || !node.yogaNode) {
    return;
  }
  const p = borderPlan(
    style,
    node.yogaNode.getComputedWidth(),
    node.yogaNode.getComputedHeight(),
  );
  const noTx = { transformers: [] as Transformer[] };
  const vertical = (glyph: string): string =>
    (colorizeForeground(glyph, p.color) + "\n").repeat(p.verticalHeight);

  if (p.showTop) {
    const top = horizontalEdge(p, p.box.topLeft, p.box.top, p.box.topRight);
    output.write(x, y, colorizeForeground(top, p.color), noTx);
  }
  if (p.showLeft) {
    output.write(x, y + p.offsetY, vertical(p.box.left), noTx);
  }
  if (p.showRight) {
    output.write(x + p.width - 1, y + p.offsetY, vertical(p.box.right), noTx);
  }
  if (p.showBottom) {
    const bottom = horizontalEdge(
      p,
      p.box.bottomLeft,
      p.box.bottom,
      p.box.bottomRight,
    );
    output.write(
      x,
      y + p.height - 1,
      colorizeForeground(bottom, p.color),
      noTx,
    );
  }
}

function renderTextNode(
  node: RendererNode,
  yogaNode: YogaNode,
  x: number,
  y: number,
  output: Output,
  transformers: Transformer[],
): void {
  let text = squashTextNodes(node);
  if (text.length === 0) {
    return;
  }
  if (widestLine(text) > getMaxWidth(yogaNode)) {
    const style = node.props.style as { textWrap?: string } | undefined;
    text = wrapText(text, getMaxWidth(yogaNode), style?.textWrap ?? "wrap");
  }
  // Ink's applyPaddingToText offsets by the first child's computed position;
  // in our tree text children are always virtual (no yoga node), so it is a
  // provable no-op and is omitted (KISS/YAGNI). Text position comes from x/y.
  output.write(x, y, text, { transformers });
}

/**
 * A node is skipped when it is display:none, or (in the live pass) when it is
 * graduated scrollback — the latter is emitted once by the engine's writeStatic.
 */
function isSkipped(
  node: RendererNode,
  yogaNode: YogaNode,
  options: WalkOptions,
): boolean {
  return (
    yogaNode.getDisplay() === Yoga.DISPLAY_NONE ||
    (options.skipStaticElements === true && node.props.internal_static === true)
  );
}

/** Walk the laid-out tree, writing each node's output to the cell grid. */
export function renderNodeToOutput(
  node: RendererNode,
  output: Output,
  options: WalkOptions,
): void {
  const { yogaNode } = node;
  if (!yogaNode || isSkipped(node, yogaNode, options)) {
    return;
  }
  const x = options.offsetX + yogaNode.getComputedLeft();
  const y = options.offsetY + yogaNode.getComputedTop();
  const transform = node.props.internal_transform;
  const transformers =
    typeof transform === "function"
      ? [transform as Transformer, ...options.transformers]
      : options.transformers;

  if (node.type === "ink-text") {
    renderTextNode(node, yogaNode, x, y, output, transformers);
    return;
  }
  if (node.type === "ink-box") {
    renderBorder(x, y, node, output);
  }
  if (node.type === "#root" || node.type === "ink-box") {
    for (const child of node.children) {
      renderNodeToOutput(child, output, {
        offsetX: x,
        offsetY: y,
        transformers,
        skipStaticElements: options.skipStaticElements,
      });
    }
  }
}
