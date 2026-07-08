import type { ReactNode } from "react";

import {
  createHostReconciler,
  createRootNode,
  type RendererNode,
} from "./host-config.js";
import { OutputEngine } from "./output-engine.js";
import type { Terminal } from "./terminal.js";

// M17 renderer (plan m17-renderer-skeleton, ADR D1 / 0003): the public seam.
// createRenderer(terminal) mounts a React tree through the react-reconciler
// host and paints it via the differential OutputEngine. Line assembly is a
// depth-first walk of the committed node tree — NO Yoga at M17 (that is M18);
// a column stacks its children vertically, a row concatenates inline, text
// nodes contribute their string. Commits coalesce through a microtask so N
// React commits in one tick paint once (pi's requestRender, `tui.ts:306`).

const LEGACY_ROOT = 0; // sync commits (updateContainerSync) — deterministic.

/** Public handle returned by createRenderer. */
export interface Renderer {
  render(element: ReactNode): void;
  unmount(): void;
}

/** Concatenate all descendant text of a node (the inline text run). */
function textContent(node: RendererNode): string {
  if (node.type === "#text") {
    return node.text ?? "";
  }
  return node.children.map(textContent).join("");
}

/**
 * Depth-first line assembly (M17 skeleton — no Yoga). Ink nests layout under
 * `props.style`, defaults a Box to `flexDirection: "row"`; root always stacks.
 * Row = inline concat, column = stacked lines. Multi-line rows are M18 (Yoga).
 */
function assembleLines(node: RendererNode): string[] {
  if (node.type === "#text" || node.type === "ink-text") {
    return textContent(node).split("\n");
  }
  const style = node.props.style as { flexDirection?: string } | undefined;
  const direction =
    node.type === "#root" ? "column" : (style?.flexDirection ?? "row");
  if (direction === "row") {
    return [node.children.map(textContent).join("")];
  }
  return node.children.flatMap(assembleLines);
}

export function createRenderer(terminal: Terminal): Renderer {
  const engine = new OutputEngine(terminal);
  const root = createRootNode();
  let scheduled = false;
  let disposed = false;

  terminal.hideCursor();

  const paint = (): void => {
    engine.render(assembleLines(root));
  };

  const requestRender = (): void => {
    if (scheduled || disposed) {
      return;
    }
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!disposed) {
        paint();
      }
    });
  };

  const reconciler = createHostReconciler(requestRender);
  const container = reconciler.createContainer(
    root,
    LEGACY_ROOT,
    null,
    false,
    null,
    "theo-tui",
    () => {},
    () => {},
    () => {},
    () => {},
  );

  return {
    render(element: ReactNode): void {
      if (disposed) {
        return;
      }
      reconciler.updateContainerSync(element, container, null, () => {});
      reconciler.flushSyncWork();
    },
    unmount(): void {
      if (disposed) {
        return;
      }
      disposed = true; // silence any pending/next commit before it paints
      reconciler.updateContainerSync(null, container, null, () => {});
      reconciler.flushSyncWork();
      engine.teardown();
    },
  };
}
