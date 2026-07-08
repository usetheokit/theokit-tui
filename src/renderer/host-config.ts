import { createContext } from "react";
import createReconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";

// M17 host-config (plan m17-renderer-skeleton, ADR D1 / 0003): the minimal
// react-reconciler 0.33 mutation-mode host — Ink 7's hook subset reduced to
// text only (no Yoga until M18). The node tree is plain objects; layout is a
// depth-first line assembly done by the renderer at commit time, NOT here.
// resetAfterCommit is THE render trigger (Ink calls onRender there; we call
// the injected onCommit). Everything React 19 requires but the skeleton does
// not use is stubbed honestly — no NotImplemented throws (LSP).

/** A renderable node in the M17 skeleton tree. */
export interface RendererNode {
  type: string;
  props: Record<string, unknown>;
  children: RendererNode[];
  /** Only set on text instances (type === "#text"). */
  text?: string;
  parent?: RendererNode | undefined;
}

export interface RootNode extends RendererNode {
  type: "#root";
}

export function createRootNode(): RootNode {
  return { type: "#root", props: {}, children: [] };
}

function detach(child: RendererNode): void {
  const parent = child.parent;
  if (!parent) {
    return;
  }
  const index = parent.children.indexOf(child);
  if (index !== -1) {
    parent.children.splice(index, 1);
  }
  child.parent = undefined;
}

function append(parent: RendererNode, child: RendererNode): void {
  detach(child);
  parent.children.push(child);
  child.parent = parent;
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
    object, // HostContext
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

    createInstance(type, props): RendererNode {
      return { type, props, children: [] };
    },
    createTextInstance(text): RendererNode {
      return { type: "#text", props: {}, children: [], text };
    },
    getPublicInstance: (instance) => instance,
    shouldSetTextContent: () => false,
    getRootHostContext: () => ({}),
    getChildHostContext: (parentContext) => parentContext,
    prepareForCommit: () => null,
    preparePortalMount: () => {},
    clearContainer: (container) => {
      container.children = [];
      return false;
    },

    appendInitialChild: append,
    appendChild: append,
    appendChildToContainer: append,
    insertBefore: insert,
    insertInContainerBefore: insert,
    removeChild: (parent, child) => detach(child),
    removeChildFromContainer: (_container, child) => detach(child),

    finalizeInitialChildren: () => false,
    commitUpdate(instance, _type, _prevProps, nextProps): void {
      instance.props = nextProps;
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
