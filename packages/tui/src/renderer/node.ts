import type { Node as YogaNode } from "yoga-layout";

/**
 * The renderer's node tree, in a module that imports nothing from its siblings.
 *
 * B-023 — these interfaces used to live in `host-config.ts`, which imports `measureTextNode` from
 * `text-measure.ts`, which imports the node type back. That is a cycle, and the first run of this
 * package's new `no-circular` rule found it. It costs nothing at runtime — `text-measure.ts` used
 * `import type`, which TypeScript erases — but dependency-cruiser reports both directions as plain
 * imports, so the only way to keep the cycle would have been a path exception naming the two files
 * the rule had just caught. A leaf module removes the edge instead of hiding it.
 *
 * `host-config.ts` re-exports both names, so nothing that imported them from there had to change.
 */

/** A renderable node in the renderer tree (M18: carries a yoga node). */
export interface RendererNode {
  type: string;
  props: Record<string, unknown>;
  children: RendererNode[];
  /** Only set on text instances (type === "#text"). */
  text?: string;
  parent?: RendererNode | undefined;
  /**
   * The yoga layout node. Absent for `#text` and for a `<Text>` nested inside
   * another `<Text>` (virtual text — it participates only through its parent's
   * measure func). M18 T1.1 wires the tree; the measure func binding is T2.1.
   */
  yogaNode?: YogaNode | undefined;
}

export interface RootNode extends RendererNode {
  type: "#root";
}
