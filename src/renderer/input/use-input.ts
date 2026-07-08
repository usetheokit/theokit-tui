import { createContext, useContext, useEffect, useRef } from "react";

import type { InputSource, KeyHandler, PasteHandler } from "./input-source.js";

// M19 useInput/usePaste (plan m19-input-stack, ADR D1; blueprint §5): the
// Ink-compatible hooks over OUR own context (no Ink StdinContext). useInput
// subscribes to the InputSource key channel and ref-counts raw mode while
// active; usePaste subscribes to the paste channel. A handler ref keeps the
// latest closure fresh without re-subscribing every render.

/** Provides the InputSource to the useInput/usePaste hooks. */
export const InputContext = createContext<InputSource | null>(null);

interface Options {
  isActive?: boolean;
}

/** Run `handler(input, key)` for each key event while active (Ink's useInput). */
export function useInput(handler: KeyHandler, options: Options = {}): void {
  const { isActive = true } = options;
  const source = useContext(InputContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!source || !isActive) {
      return;
    }
    source.setRawMode(true);
    const off = source.onKey((input, key) => handlerRef.current(input, key));
    return () => {
      off();
      source.setRawMode(false);
    };
  }, [source, isActive]);
}

/** Run `handler(content)` for each bracketed-paste event while active. */
export function usePaste(handler: PasteHandler, options: Options = {}): void {
  const { isActive = true } = options;
  const source = useContext(InputContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!source || !isActive) {
      return;
    }
    const off = source.onPaste((content) => handlerRef.current(content));
    return off;
  }, [source, isActive]);
}
