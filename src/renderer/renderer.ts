import { createElement, type ReactNode } from "react";
import Yoga from "yoga-layout";

import {
  createHostReconciler,
  createRootNode,
  type RendererNode,
} from "./host-config.js";
import { StdoutContext, type StdoutContextValue } from "./hooks/use-stdout.js";
import { OutputEngine } from "./output/output-engine.js";
import { Output } from "./output/output-grid.js";
import { renderNodeToOutput } from "./output/render-node.js";
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

  // Our own stdout surface (Ink's context is un-importable — its `exports`
  // map gates deep imports). Live getters so a resize is reflected (M20 T1.1).
  const stdoutValue: StdoutContextValue = {
    stdout: {
      get columns(): number {
        return terminal.columns;
      },
      get rows(): number {
        return terminal.rows;
      },
      isTTY: true,
      write: (data: string): void => terminal.write(data),
    },
    write: (data: string): void => terminal.write(data),
  };

  /** Collect every `internal_static` subtree root (not recursing into them). */
  const collectStatic = (node: RendererNode): RendererNode[] => {
    const found: RendererNode[] = [];
    for (const child of node.children) {
      if (child.props.internal_static === true) {
        found.push(child);
      } else {
        found.push(...collectStatic(child));
      }
    }
    return found;
  };

  // Static capture runs PER COMMIT (synchronously), not in the coalesced live
  // paint: Ink's <Static> advances its index in a layout effect, so by paint
  // time the delta is gone. We render the static subtree's current children and
  // emit them ONCE via writeStatic (Ink's per-commit onRender, M20 T1.1 / D1).
  const captureStaticDelta = (): void => {
    for (const node of collectStatic(root)) {
      const sy = node.yogaNode;
      if (!sy || node.children.length === 0) {
        continue;
      }
      sy.calculateLayout(terminal.columns, undefined, Yoga.DIRECTION_LTR);
      const height = sy.getComputedHeight();
      if (height <= 0) {
        continue;
      }
      const staticOutput = new Output({
        width: sy.getComputedWidth() || terminal.columns,
        height,
      });
      renderNodeToOutput(node, staticOutput, {
        offsetX: -sy.getComputedLeft(),
        offsetY: -sy.getComputedTop(),
        transformers: [],
        skipStaticElements: false,
      });
      const lines = staticOutput.get().output.split("\n");
      while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") {
        lines.pop();
      }
      if (lines.length > 0) {
        engine.writeStatic(lines);
      }
    }
  };

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
      skipStaticElements: true, // graduated scrollback is emitted separately
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

  // Per commit: capture static synchronously, then coalesce the live paint.
  const onCommit = (): void => {
    if (disposed) {
      return;
    }
    captureStaticDelta();
    requestRender();
  };

  const reconciler = createHostReconciler(onCommit);
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
      const wrapped = createElement(
        StdoutContext.Provider,
        { value: stdoutValue },
        element,
      );
      reconciler.updateContainerSync(wrapped, container, null, () => {});
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
