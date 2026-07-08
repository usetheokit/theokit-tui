import type { ReactNode } from "react";
import Yoga from "yoga-layout";

import { createHostReconciler, createRootNode } from "./host-config.js";
import { OutputEngine } from "./output-engine.js";
import { Output } from "./output-grid.js";
import { renderNodeToOutput } from "./render-node.js";
import type { Terminal } from "./terminal.js";

// M18 renderer (plan m18-yoga-layout, ADR D2): the public seam. createRenderer
// mounts a React tree through the react-reconciler host, lays it out with Yoga
// (calculateLayout at the terminal width, height auto), rasterizes the laid-out
// tree into a cell grid (renderNodeToOutput → Output), and paints the resulting
// rows through the differential OutputEngine. N commits/tick coalesce into one
// paint (pi's requestRender, `tui.ts:306`).

const LEGACY_ROOT = 0; // sync commits (updateContainerSync) — deterministic.

/** Renderer observability snapshot (D2 wiring pillar — full-redraw metrics). */
export interface RendererStats {
  fullRedrawCount: number;
  lastRedrawReason: string | undefined;
}

/** Public handle returned by createRenderer. */
export interface Renderer {
  render(element: ReactNode): void;
  unmount(): void;
  /** Read the engine's full-redraw metrics through the public seam. */
  stats(): RendererStats;
}

export function createRenderer(terminal: Terminal): Renderer {
  const engine = new OutputEngine(terminal);
  const root = createRootNode();
  let scheduled = false;
  let disposed = false;

  terminal.hideCursor();

  const paint = (): void => {
    const rootYoga = root.yogaNode;
    if (!rootYoga) {
      return;
    }
    rootYoga.setWidth(terminal.columns);
    rootYoga.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    const output = new Output({
      width: rootYoga.getComputedWidth(),
      height: rootYoga.getComputedHeight(),
    });
    renderNodeToOutput(root, output, {
      offsetX: 0,
      offsetY: 0,
      transformers: [],
    });
    engine.render(output.get().output.split("\n"));
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
      root.yogaNode?.freeRecursive(); // release the root WASM node (no leak)
    },
    stats: (): RendererStats => ({
      fullRedrawCount: engine.fullRedrawCount,
      lastRedrawReason: engine.lastRedrawReason,
    }),
  };
}
