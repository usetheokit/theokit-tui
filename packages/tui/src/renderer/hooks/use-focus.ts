import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { InputContext } from "../input/use-input.js";

// M20 T2.1 (plan m20-scrollback-cutover, ADR D4): our own focus manager. Ink's
// lives inside its App component (bound to Ink's stdin); ours is a standalone
// FocusProvider bound to OUR InputSource (M19). The arbiter (ESC blur, Tab /
// Shift+Tab cycle) runs on the PRIORITY input channel — before every component
// useInput handler — so the composer's ESC handler sees an already-blurred
// state and can re-focus itself (chat-composer.tsx:322-328). Faithful port of
// Ink's App.js focus logic (:150-395).

interface Focusable {
  id: string;
  isActive: boolean;
}

export interface FocusContextValue {
  activeId: string | undefined;
  isFocusEnabled: boolean;
  add(id: string, options: { autoFocus: boolean }): void;
  remove(id: string): void;
  activate(id: string): void;
  deactivate(id: string): void;
  focus(id: string): void;
  /** Clear the active focus (no component focused) — used by the overlay layer. */
  blur(): void;
  focusNext(): void;
  focusPrevious(): void;
  enableFocus(): void;
  disableFocus(): void;
}

const noop = (): void => {};

/** Default (no provider): a well-behaved inert manager — nothing is focused. */
export const FocusContext = createContext<FocusContextValue>({
  activeId: undefined,
  isFocusEnabled: true,
  add: noop,
  remove: noop,
  activate: noop,
  deactivate: noop,
  focus: noop,
  blur: noop,
  focusNext: noop,
  focusPrevious: noop,
  enableFocus: noop,
  disableFocus: noop,
});
FocusContext.displayName = "TheoTuiFocusContext";

/** The next active focusable id after `activeId` (wraps to undefined at the end). */
function findNext(focusables: Focusable[], activeId: string | undefined): string | undefined {
  const start = focusables.findIndex((f) => f.id === activeId);
  for (let i = start + 1; i < focusables.length; i++) {
    if (focusables[i]!.isActive) {
      return focusables[i]!.id;
    }
  }
  return undefined;
}

/** The previous active focusable id before `activeId` (wraps at the start). */
function findPrevious(focusables: Focusable[], activeId: string | undefined): string | undefined {
  const start = focusables.findIndex((f) => f.id === activeId);
  for (let i = start - 1; i >= 0; i--) {
    if (focusables[i]!.isActive) {
      return focusables[i]!.id;
    }
  }
  return undefined;
}

/** The first active focusable id (Tab wrap target). */
function firstActive(focusables: Focusable[]): string | undefined {
  return focusables.find((f) => f.isActive)?.id;
}

/** The last active focusable id (Shift+Tab wrap target). */
function lastActive(focusables: Focusable[]): string | undefined {
  for (let i = focusables.length - 1; i >= 0; i--) {
    if (focusables[i]!.isActive) {
      return focusables[i]!.id;
    }
  }
  return undefined;
}

/**
 * Owns the focus registry + active id and wires the ESC/Tab arbiter to OUR
 * InputSource's priority channel. Place it (with an `InputContext`) around any
 * tree whose components use `useFocus`/`useFocusManager`.
 */
export function FocusProvider({ children }: { children: ReactNode }) {
  const source = useContext(InputContext);
  // Only the setter is used — every read is a functional update (the arbiter
  // runs outside render and must see the current registry).
  const [, setFocusables] = useState<Focusable[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [isFocusEnabled, setIsFocusEnabled] = useState(true);

  const add = useCallback((id: string, { autoFocus }: { autoFocus: boolean }) => {
    setFocusables((prev) =>
      prev.some((f) => f.id === id) ? prev : [...prev, { id, isActive: true }],
    );
    if (autoFocus) {
      setActiveId((current) => current ?? id);
    }
  }, []);

  const remove = useCallback((id: string) => {
    setFocusables((prev) => prev.filter((f) => f.id !== id));
    setActiveId((current) => (current === id ? undefined : current));
  }, []);

  const activate = useCallback((id: string) => {
    setFocusables((prev) => prev.map((f) => (f.id === id ? { ...f, isActive: true } : f)));
  }, []);

  const deactivate = useCallback((id: string) => {
    setFocusables((prev) => prev.map((f) => (f.id === id ? { ...f, isActive: false } : f)));
    setActiveId((current) => (current === id ? undefined : current));
  }, []);

  const focus = useCallback((id: string) => {
    setFocusables((current) => {
      if (current.some((f) => f.id === id && f.isActive)) {
        setActiveId(id);
      }
      return current;
    });
  }, []);

  const focusNext = useCallback(() => {
    setFocusables((current) => {
      setActiveId((active) => findNext(current, active) ?? firstActive(current) ?? active);
      return current;
    });
  }, []);

  const focusPrevious = useCallback(() => {
    setFocusables((current) => {
      setActiveId((active) => findPrevious(current, active) ?? lastActive(current) ?? active);
      return current;
    });
  }, []);

  const blur = useCallback(() => setActiveId(undefined), []);
  const enableFocus = useCallback(() => setIsFocusEnabled(true), []);
  const disableFocus = useCallback(() => setIsFocusEnabled(false), []);

  // The arbiter reads `isFocusEnabled` from a ref so it always sees the current
  // value without re-subscribing (re-subscription churn would race a key that
  // arrives before the new subscription lands). The ref is updated DURING render
  // (not in an effect) so it is current the instant the new value is committed —
  // an effect lags the render, letting a key that arrives between commit and
  // effect see the stale value (the canonical "read latest value in a callback"
  // pattern; safe for a ref).
  const isFocusEnabledRef = useRef(isFocusEnabled);
  isFocusEnabledRef.current = isFocusEnabled;

  // ESC-blur runs on the PRIORITY channel (before component useInput) — the
  // composer's ESC-refocus depends on seeing an already-blurred state
  // (chat-composer.tsx:322-328). This mirrors Ink's App, which handles ESC
  // synchronously ahead of the input emit (App.js:156).
  useEffect(() => {
    if (!source) {
      return;
    }
    return source.onKeyPriority((_input, key) => {
      if (isFocusEnabledRef.current && key.escape) {
        setActiveId(undefined);
      }
    });
  }, [source]);

  // Tab / Shift+Tab navigation runs on the REGULAR channel — same precedence as
  // a component's useInput, exactly as Ink wires Tab navigation (App.js:369-385),
  // NOT ahead of it.
  useEffect(() => {
    if (!source) {
      return;
    }
    return source.onKey((_input, key) => {
      if (!isFocusEnabledRef.current || !key.tab) {
        return;
      }
      if (key.shift) {
        focusPrevious();
      } else {
        focusNext();
      }
    });
  }, [source, focusNext, focusPrevious]);

  const value = useMemo<FocusContextValue>(
    () => ({
      activeId,
      isFocusEnabled,
      add,
      remove,
      activate,
      deactivate,
      focus,
      blur,
      focusNext,
      focusPrevious,
      enableFocus,
      disableFocus,
    }),
    [
      activeId,
      isFocusEnabled,
      add,
      remove,
      activate,
      deactivate,
      focus,
      blur,
      focusNext,
      focusPrevious,
      enableFocus,
      disableFocus,
    ],
  );

  return createElement(FocusContext.Provider, { value }, children);
}

export interface UseFocusOptions {
  isActive?: boolean | undefined;
  autoFocus?: boolean | undefined;
  id?: string | undefined;
}

/** Makes a component focusable; returns `{ isFocused, focus }` (Ink parity). */
export function useFocus({
  isActive = true,
  autoFocus = false,
  id: customId,
}: UseFocusOptions = {}): { isFocused: boolean; focus: (id: string) => void } {
  // Destructure the STABLE methods (each is useCallback([])). Depending on the
  // whole context object would re-run these effects on every activeId change —
  // re-applying autoFocus and instantly undoing an ESC blur.
  const { activeId, add, remove, activate, deactivate, focus } = useContext(FocusContext);
  const source = useContext(InputContext);
  const id = useMemo(
    // Ink's exact id fallback; deterministic when a customId is passed.
    () => customId ?? Math.random().toString().slice(2, 7),
    [customId],
  );

  useEffect(() => {
    add(id, { autoFocus });
    return () => remove(id);
  }, [id, autoFocus, add, remove]);

  useEffect(() => {
    if (isActive) {
      activate(id);
    } else {
      deactivate(id);
    }
  }, [isActive, id, activate, deactivate]);

  // Hold raw mode while active (ref-counted in the source) — Ink's use-focus.js.
  useEffect(() => {
    if (!isActive || !source) {
      return;
    }
    source.setRawMode(true);
    return () => source.setRawMode(false);
  }, [isActive, source]);

  return { isFocused: activeId === id, focus };
}

/** Focus controls for the whole tree (Ink's useFocusManager). */
export function useFocusManager(): Pick<
  FocusContextValue,
  "enableFocus" | "disableFocus" | "focusNext" | "focusPrevious" | "focus" | "blur" | "activeId"
> {
  const ctx = useContext(FocusContext);
  return {
    enableFocus: ctx.enableFocus,
    disableFocus: ctx.disableFocus,
    focusNext: ctx.focusNext,
    focusPrevious: ctx.focusPrevious,
    focus: ctx.focus,
    blur: ctx.blur,
    activeId: ctx.activeId,
  };
}
