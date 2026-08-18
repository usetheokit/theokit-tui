// Public entry point for @theokit/tui.
//
// ADR 0001 organises src/ by product domain; ADR 0002 makes each domain own its
// public surface through a barrel. This file re-exports those barrels and does
// nothing else — the same shape src/renderer/index.ts has always had. Export
// policy (which symbols stay module-internal) lives in each domain's barrel,
// next to the code it governs, rather than as prose here. See docs/adr/.

export const VERSION = "0.61.0";

export * from "./theme/index.js";
export * from "./layout/index.js";
export * from "./chat/index.js";
export * from "./tools/index.js";
export * from "./markdown/index.js";
export * from "./diff/index.js";
export * from "./agent/index.js";
export * from "./metrics/index.js";
export * from "./status/index.js";
export * from "./prompts/index.js";
export * from "./branding/index.js";
export * from "./shortcuts/index.js";
export * from "./format/index.js";

// Overlay hook ships from the renderer subsystem, not from a UI domain.
export { OverlayProvider, useOverlay } from "./renderer/hooks/use-overlay.js";
