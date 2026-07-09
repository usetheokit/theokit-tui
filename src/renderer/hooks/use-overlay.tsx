import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useInput } from "../input/use-input.js";
import { useFocusManager } from "./use-focus.js";

// M22 overlay layer (plan m22-interaction-primitives T2.1, ADR B1/B2/B5): a
// stack of overlays rendered IN-BAND (part of the live frame — no z-index
// compositing) above the thread. Focus capture reuses the M20 focus manager:
// opening the FIRST overlay saves + BLURS the background focus and disables Tab
// nav (so background components go inert), and closing the LAST overlay restores
// it. Nesting is DEPTH-COUNTED (a ref, not the boolean isFocusEnabled) so a
// push→push→pop keeps the background inert until depth 0 (the F-HIGH-1 fix). The
// TOP overlay owns Esc-dismiss; the M20 priority ESC-blur arbiter is gated off
// while focus is disabled, so Esc reaches the overlay instead of blurring it.
//
// NESTED-OVERLAY STATE (documented limitation, review M22): only the TOP overlay
// is mounted. When a nested overlay is pushed, the one below UNMOUNTS; on pop it
// re-mounts fresh — which correctly re-captures focus (its autoFocus re-fires)
// but RESETS its internal component state (a covered SelectList's filter /
// selection is lost). Single-level overlays are unaffected. If you nest overlays
// and need to preserve the covered overlay's state, LIFT that state to the caller
// and pass it back in. (Keeping lower overlays mounted while isolating focus is a
// future enhancement.)

interface OverlayEntry {
  id: string;
  node: ReactNode;
}

interface OverlayContextValue {
  /** Push an overlay above the thread; returns its id. */
  push(node: ReactNode): string;
  /** Dismiss the top overlay. */
  pop(): void;
  /** Number of open overlays. */
  depth: number;
}

const OverlayContext = createContext<OverlayContextValue>({
  push: () => "",
  pop: () => {},
  depth: 0,
});
OverlayContext.displayName = "TheoTuiOverlayContext";

/** The top overlay: renders its node and owns Esc-dismiss. */
function OverlayHost({ node, onEsc }: { node: ReactNode; onEsc: () => void }) {
  useInput(
    (_input, key) => {
      if (key.escape) {
        onEsc();
      }
    },
    { isActive: true },
  );
  return <>{node}</>;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<OverlayEntry[]>([]);
  const mgr = useFocusManager();
  const savedFocus = useRef<string | undefined>(undefined);
  const depthRef = useRef(0);
  const idRef = useRef(0);

  const push = useCallback(
    (node: ReactNode): string => {
      // 0 → 1: save + blur the background focus, disable Tab nav (depth guard).
      if (depthRef.current === 0) {
        savedFocus.current = mgr.activeId;
        mgr.blur();
        mgr.disableFocus();
      }
      depthRef.current += 1;
      const id = `overlay-${idRef.current++}`;
      setStack((prev) => [...prev, { id, node }]);
      return id;
    },
    [mgr],
  );

  const pop = useCallback(() => {
    if (depthRef.current === 0) {
      return;
    }
    depthRef.current -= 1;
    // 1 → 0: restore Tab nav + the saved background focus.
    if (depthRef.current === 0) {
      mgr.enableFocus();
      if (savedFocus.current !== undefined) {
        mgr.focus(savedFocus.current);
      }
      savedFocus.current = undefined;
    }
    setStack((prev) => prev.slice(0, -1));
  }, [mgr]);

  const value = useMemo<OverlayContextValue>(
    () => ({ push, pop, depth: stack.length }),
    [push, pop, stack.length],
  );

  const top = stack[stack.length - 1];
  return (
    <OverlayContext.Provider value={value}>
      {children}
      {top ? <OverlayHost key={top.id} node={top.node} onEsc={pop} /> : null}
    </OverlayContext.Provider>
  );
}

/** Push/pop overlays + the current depth. */
export function useOverlay(): OverlayContextValue {
  return useContext(OverlayContext);
}
