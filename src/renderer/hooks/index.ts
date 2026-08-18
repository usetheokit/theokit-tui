// Barrel for renderer hooks (ADR 0001).

export {
  FocusContext,
  FocusProvider,
  useFocus,
  useFocusManager,
} from "./use-focus.js";
export type { FocusContextValue, UseFocusOptions } from "./use-focus.js";

export { OverlayProvider, useOverlay } from "./use-overlay.js";

export { StdoutContext, useStdout } from "./use-stdout.js";
export type { StdoutContextValue, StdoutLike } from "./use-stdout.js";
