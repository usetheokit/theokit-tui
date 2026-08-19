import cliTruncate from "cli-truncate";
import widestLine from "widest-line";
import wrapAnsi from "wrap-ansi";

import type { RendererNode } from "./node.js";

// M18 text-measure (plan m18-yoga-layout, ADR D3): the text measure func + wrap
// modes — a faithful port of Ink's measure-text.js / wrap-text.js /
// squash-text-nodes.js / dom.js:measureTextNode, over the SAME libs Ink uses
// (widest-line, wrap-ansi, cli-truncate). This is what yoga calls (via
// setMeasureFunc) to size a text node during calculateLayout.

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Strip ANSI control sequences that would corrupt layout, keeping SGR (colors).
 * M18 scope: our corpus text is SGR-only (chalk transforms) — it never carries
 * cursor/clear control sequences — so this is a provable pass-through. Ink's
 * fuller sanitize (porting its private ansi-tokenizer) is deferred: no shipped
 * component injects raw control codes into `<Text>` content.
 */
function sanitizeAnsi(text: string): string {
  return text;
}

/** Concatenate a text node's descendants, applying each SGR `internal_transform`. */
export function squashTextNodes(node: RendererNode): string {
  let text = "";
  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index]!;
    let nodeText = "";
    if (child.type === "#text") {
      nodeText = child.text ?? "";
    } else if (child.type === "ink-text" || child.type === "ink-virtual-text") {
      nodeText = squashTextNodes(child);
      const transform = child.props.internal_transform;
      if (nodeText.length > 0 && typeof transform === "function") {
        nodeText = (transform as (t: string, i: number) => string)(
          nodeText,
          index,
        );
      }
    }
    text += nodeText;
  }
  return sanitizeAnsi(text);
}

/** Intrinsic size of a text block: widest line × line count. */
export function measureText(text: string): Dimensions {
  if (text.length === 0) {
    return { width: 0, height: 0 };
  }
  return { width: widestLine(text), height: text.split("\n").length };
}

/** Wrap or truncate `text` to `maxWidth` per `wrapType` (Ink's wrap-text.js). */
export function wrapText(
  text: string,
  maxWidth: number,
  wrapType: string,
): string {
  if (wrapType === "wrap") {
    return wrapAnsi(text, maxWidth, { trim: false, hard: true });
  }
  if (wrapType === "hard") {
    return wrapAnsi(text, maxWidth, {
      trim: false,
      hard: true,
      wordWrap: false,
    });
  }
  if (wrapType.startsWith("truncate")) {
    const position =
      wrapType === "truncate-middle"
        ? "middle"
        : wrapType === "truncate-start"
          ? "start"
          : "end";
    return cliTruncate(text, maxWidth, { position });
  }
  return text;
}

/**
 * The yoga measure func for a text node: measure the squashed text, wrap it to
 * `width` if it overflows (honoring `textWrap`), and return the final size.
 * Port of Ink's dom.js:measureTextNode.
 */
export function measureTextNode(node: RendererNode, width: number): Dimensions {
  const text =
    node.type === "#text" ? (node.text ?? "") : squashTextNodes(node);
  const dimensions = measureText(text);
  // Fits — no wrap needed.
  if (dimensions.width <= width) {
    return dimensions;
  }
  // Yoga probes a <1px shrink; tell it "no" by returning the intrinsic size.
  if (dimensions.width >= 1 && width > 0 && width < 1) {
    return dimensions;
  }
  const style = node.props.style as { textWrap?: string } | undefined;
  const wrappedText = wrapText(text, width, style?.textWrap ?? "wrap");
  return measureText(wrappedText);
}
