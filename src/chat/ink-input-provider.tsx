import { useStdin } from "ink";
import { useEffect, useMemo, type ReactNode } from "react";

import { FocusProvider } from "../renderer/hooks/use-focus.js";
import {
  createInputSource,
  type InputSource,
  type InputStream,
} from "../renderer/input/input-source.js";
import { InputContext } from "../renderer/input/use-input.js";

// #41 bridge: the interactive components (ChoiceRow / SelectList / Pager /
// FreeTextInput and the decision prompts that compose them) consume the custom
// V4 renderer's input+focus hooks, whose `InputContext` is not mounted under
// pure Ink's `render` — so under Ink they rendered but silently ignored every
// key. `<InkInputProvider>` wires an `InputSource` to Ink's stdin and provides
// the `InputContext` + `FocusProvider` those components need. Mount it ONCE,
// high in the tree, when you render this library's interactive surfaces under
// Ink. Non-interactive apps (or `ChatComposer`, which uses Ink's own hooks) do
// not need it.

export interface InkInputProviderProps {
  children: ReactNode;
}

export function InkInputProvider({ children }: InkInputProviderProps) {
  const { stdin, setRawMode, isRawModeSupported } = useStdin();

  const source = useMemo<InputSource | null>(() => {
    if (!stdin) return null;
    const stream: InputStream = {
      isTTY: stdin.isTTY,
      // Delegate raw mode to Ink's ref-counted `setRawMode` so the two input
      // systems share ONE terminal-mode owner and never fight over it. When raw
      // mode is unsupported (non-TTY), leave it unset — the source skips it and
      // interactive input is simply inert, as it must be off a TTY.
      ...(isRawModeSupported
        ? { setRawMode: (enabled: boolean) => setRawMode(enabled) }
        : {}),
      on: (event, listener) => {
        stdin.on(event, listener);
      },
      off: (event, listener) => {
        stdin.off(event, listener);
      },
      resume: () => {
        stdin.resume();
      },
      pause: () => {
        stdin.pause();
      },
    };
    return createInputSource(stream);
  }, [stdin, setRawMode, isRawModeSupported]);

  useEffect(() => {
    if (!source) return;
    source.start();
    return () => source.stop();
  }, [source]);

  return (
    <InputContext.Provider value={source}>
      <FocusProvider>{children}</FocusProvider>
    </InputContext.Provider>
  );
}
