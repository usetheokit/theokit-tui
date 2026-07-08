import { createElement, type ReactNode } from "react";

import { FocusProvider } from "../../src/renderer/hooks/use-focus.js";
import { createRenderer } from "../../src/renderer/index.js";
import { createInputSource } from "../../src/renderer/input/input-source.js";
import { InputContext } from "../../src/renderer/input/use-input.js";
import { createFakeStdin } from "./fake-stdin.js";
import { VirtualTerminal } from "./virtual-terminal.js";

// M20 T2.1 (plan m20-scrollback-cutover, ADR D2): an ink-testing-library-shaped
// harness over OUR renderer. It composes the differential renderer + a fake
// stdin/InputSource + the FocusProvider + (via createRenderer) the StdoutContext,
// exposing lastFrame/stdin/rerender/unmount. Unlike ink-testing-library it is
// ASYNC (our paint coalesces on a microtask), so callers `await flush()` before
// reading a frame. lastFrame reads the emulator SCREEN (scrollback written above
// + the live frame below), so it reproduces Ink's `fullStaticOutput + live`
// concatenation. `.frames` is best-effort (a full-frame snapshot per flush, not
// Ink's diff-stream history) — assert on lastFrame/screen, not raw frame bytes.

export interface ItlInstance {
  /** The current emulator screen as text — scrollback prefix + live frame. */
  lastFrame(): string;
  /** Full-frame snapshots captured on each `flush` (best-effort). */
  frames: string[];
  /** Drive input: `stdin.write(bytes)` reaches mounted `useInput` handlers. */
  stdin: { write(data: string): void };
  rerender(element: ReactNode): void;
  unmount(): void;
  /** Drain the coalesced paint + any layout-effect re-commit, flush the emulator. */
  flush(): Promise<void>;
  terminal: VirtualTerminal;
}

export interface RenderOptions {
  columns?: number;
  rows?: number;
}

export function render(
  element: ReactNode,
  { columns = 80, rows = 24 }: RenderOptions = {},
): ItlInstance {
  const terminal = new VirtualTerminal(columns, rows);
  const stdin = createFakeStdin();
  const source = createInputSource(stdin, (data) => terminal.write(data));
  source.start();
  const renderer = createRenderer(terminal);
  const frames: string[] = [];

  const wrap = (el: ReactNode): ReactNode =>
    createElement(
      InputContext.Provider,
      { value: source },
      createElement(FocusProvider, null, el),
    );

  renderer.render(wrap(element));

  return {
    frames,
    stdin: { write: (data: string): void => stdin.send(data) },
    lastFrame: (): string => terminal.screenLines().join("\n"),
    rerender: (el: ReactNode): void => renderer.render(wrap(el)),
    unmount: (): void => {
      renderer.unmount();
      source.stop();
    },
    flush: async (): Promise<void> => {
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      await terminal.flush();
      frames.push(terminal.screenLines().join("\n"));
    },
    terminal,
  };
}
