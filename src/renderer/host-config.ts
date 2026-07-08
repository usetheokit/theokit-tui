import { createContext } from "react";
import createReconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import Yoga, { type Node as YogaNode } from "yoga-layout";

import { measureTextNode } from "./text-measure.js";
import { applyStyles, type Style } from "./yoga-style.js";

// M17 host-config (plan m17-renderer-skeleton, ADR D1 / 0003): the minimal
// react-reconciler 0.33 mutation-mode host — Ink 7's hook subset reduced to
// text only (no Yoga until M18). The node tree is plain objects; layout is a
// depth-first line assembly done by the renderer at commit time, NOT here.
// resetAfterCommit is THE render trigger (Ink calls onRender there; we call
// the injected onCommit). Everything React 19 requires but the skeleton does
// not use is stubbed honestly — no NotImplemented throws (LSP).

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

export function createRootNode(): RootNode {
  return {
    type: "#root",
    props: {},
    children: [],
    yogaNode: Yoga.Node.create(),
  };
}

/** The style object React passes on `props.style` (Ink's Box/Text convention). */
function styleOf(props: Record<string, unknown>): Style {
  return (props.style as Style | undefined) ?? {};
}

/** The yoga index of `child` = count of yoga-having siblings before it. */
function yogaIndexOf(parent: RendererNode, child: RendererNode): number {
  let index = 0;
  for (const sibling of parent.children) {
    if (sibling === child) {
      break;
    }
    if (sibling.yogaNode) {
      index += 1;
    }
  }
  return index;
}

/** Remove from the child array AND yoga tree (no free — moves reuse this). */
function detach(child: RendererNode): void {
  const parent = child.parent;
  if (!parent) {
    return;
  }
  const index = parent.children.indexOf(child);
  if (index !== -1) {
    parent.children.splice(index, 1);
  }
  if (parent.yogaNode && child.yogaNode) {
    parent.yogaNode.removeChild(child.yogaNode);
  }
  child.parent = undefined;
}

function append(parent: RendererNode, child: RendererNode): void {
  detach(child);
  parent.children.push(child);
  child.parent = parent;
  if (parent.yogaNode && child.yogaNode) {
    parent.yogaNode.insertChild(
      child.yogaNode,
      parent.yogaNode.getChildCount(),
    );
  }
}

function insert(
  parent: RendererNode,
  child: RendererNode,
  before: RendererNode,
): void {
  detach(child);
  const at = parent.children.indexOf(before);
  parent.children.splice(at === -1 ? parent.children.length : at, 0, child);
  child.parent = parent;
  if (parent.yogaNode && child.yogaNode) {
    parent.yogaNode.insertChild(child.yogaNode, yogaIndexOf(parent, child));
  }
}

/** Detach then free the subtree's yoga nodes (reconciler removal, not a move). */
function remove(child: RendererNode): void {
  detach(child);
  child.yogaNode?.freeRecursive();
  child.yogaNode = undefined;
}

/** Remove + free every child of a container (leak-safe bulk clear). */
export function clearContainerChildren(container: RendererNode): void {
  for (const child of [...container.children]) {
    remove(child);
  }
}

/** Host context: whether we are inside a `<Text>` (nested text = virtual, no yoga node). */
interface HostContext {
  isInsideText: boolean;
}

/**
 * Build the react-reconciler bound to `onCommit`, which fires once per React
 * commit (from resetAfterCommit) so the renderer can assemble + paint.
 */
export function createHostReconciler(onCommit: () => void) {
  return createReconciler<
    string, // Type
    Record<string, unknown>, // Props
    RootNode, // Container
    RendererNode, // Instance
    RendererNode, // TextInstance
    never, // SuspenseInstance
    never, // HydratableInstance
    never, // FormInstance
    RendererNode, // PublicInstance
    HostContext, // HostContext
    true, // ChildSet (unused in mutation mode)
    ReturnType<typeof setTimeout>, // TimeoutHandle
    -1, // NoTimeout
    null // TransitionStatus (we have no host transitions)
  >({
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: true,
    noTimeout: -1,
    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    supportsMicrotasks: true,
    scheduleMicrotask: queueMicrotask,

    createInstance(type, props, _root, hostContext): RendererNode {
      // A <Text> nested inside another <Text> is virtual — it participates via
      // its parent's measure func and gets NO yoga node (Ink dom.js:12).
      const isVirtualText = type === "ink-text" && hostContext.isInsideText;
      const node: RendererNode = { type, props, children: [] };
      if (!isVirtualText) {
        node.yogaNode = Yoga.Node.create();
        applyStyles(node.yogaNode, styleOf(props));
        if (type === "ink-text") {
          // Yoga calls this to size the text during calculateLayout (T2.1).
          node.yogaNode.setMeasureFunc((width) => measureTextNode(node, width));
        }
      }
      return node;
    },
    createTextInstance(text): RendererNode {
      return { type: "#text", props: {}, children: [], text };
    },
    getPublicInstance: (instance) => instance,
    shouldSetTextContent: () => false,
    getRootHostContext: (): HostContext => ({ isInsideText: false }),
    getChildHostContext: (parentContext, type): HostContext =>
      type === "ink-text" ? { isInsideText: true } : parentContext,
    prepareForCommit: () => null,
    preparePortalMount: () => {},
    clearContainer: (container) => {
      clearContainerChildren(container);
      return false;
    },

    appendInitialChild: append,
    appendChild: append,
    appendChildToContainer: append,
    insertBefore: insert,
    insertInContainerBefore: insert,
    removeChild: (_parent, child) => remove(child),
    removeChildFromContainer: (_container, child) => remove(child),

    finalizeInitialChildren: () => false,
    commitUpdate(instance, _type, _prevProps, nextProps): void {
      instance.props = nextProps;
      if (instance.yogaNode) {
        applyStyles(instance.yogaNode, styleOf(nextProps));
      }
    },
    commitTextUpdate(textInstance, _oldText, newText): void {
      textInstance.text = newText;
    },
    // Offscreen/Suspense visibility toggles — React calls these unconditionally
    // on reveal; without them the commit-phase throw is swallowed. No-op here
    // (the differential engine recomputes lines from the live tree each paint).
    hideInstance: () => {},
    unhideInstance: () => {},
    hideTextInstance: () => {},
    unhideTextInstance: () => {},

    // resetAfterCommit is THE render trigger — one call per React commit.
    resetAfterCommit: () => onCommit(),

    // Priority + React 19 required stubs (Ink's exact set) — honest no-ops.
    resolveUpdatePriority: () => DefaultEventPriority,
    setCurrentUpdatePriority: () => {},
    getCurrentUpdatePriority: () => DefaultEventPriority,
    // Deliberate divergence from Ink (which returns true for resource
    // preloading): the text-only skeleton has no suspendable resources, so
    // false avoids the preload machinery. Revisit if images land (M21).
    maySuspendCommit: () => false,
    beforeActiveInstanceBlur: () => {},
    afterActiveInstanceBlur: () => {},
    detachDeletedInstance: () => {},
    getInstanceFromNode: () => null,
    prepareScopeUpdate: () => {},
    getInstanceFromScope: () => null,
    NotPendingTransition: null,
    // React's createContext yields the right object at runtime; the type
    // gap is only @types/react vs @types/react-reconciler internals.
    HostTransitionContext: createContext(null) as never,
    resetFormInstance: () => {},
    requestPostPaintCallback: () => {},
    shouldAttemptEagerTransition: () => false,
    trackSchedulerEvent: () => {},
    resolveEventType: () => null,
    resolveEventTimeStamp: () => -1.1,
    preloadInstance: () => true,
    startSuspendingCommit: () => {},
    suspendInstance: () => {},
    waitForCommitToBeReady: () => null,
  });
}
