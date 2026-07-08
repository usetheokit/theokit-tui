import { createContext, useContext } from "react";

// M20 T1.1 (plan m20-scrollback-cutover, ADR D4): our own `useStdout`. Ink's
// StdoutContext cannot be reused — Ink's package `exports` map gates deep
// imports, so a component that reads OUR renderer's dimensions must read OUR
// context. `createRenderer` provides it with a shim over the mounted Terminal;
// components that still import Ink's `useStdout` fall back to `process.stdout`
// (the pre-cutover reality — the import swap is the later Ink-drop milestone).

/** The stdout surface a component sees — a subset of Node's WriteStream. */
export interface StdoutLike {
  columns: number;
  rows: number;
  isTTY: boolean;
  write(data: string): void;
}

export interface StdoutContextValue {
  stdout: StdoutLike | undefined;
  write(data: string): void;
}

/** Default: no renderer mounted → no dimensions (callers fall back). */
export const StdoutContext = createContext<StdoutContextValue>({
  stdout: undefined,
  write() {},
});
StdoutContext.displayName = "TheoTuiStdoutContext";

/** Returns the stdout surface where the current renderer paints. */
export function useStdout(): StdoutContextValue {
  return useContext(StdoutContext);
}
