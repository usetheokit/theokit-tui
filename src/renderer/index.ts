// M17 renderer subpath barrel (plan m17-renderer-skeleton, ADR 0003). The
// renderer is exported ONLY here — `@theokit/tui/renderer` — never from the
// root entry (src/index.ts stays Ink-component-only). The package.json export
// map wiring lands in T3.1; this barrel is the stable public surface.

export { createRenderer, type Renderer } from "./renderer.js";
export { type Terminal, ProcessTerminal } from "./terminal.js";
