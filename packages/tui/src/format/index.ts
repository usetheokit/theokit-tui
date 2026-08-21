// Public barrel for the format domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export type { OscSink } from "./terminal-osc.js";
export {
  osc8Link,
  setTerminalTitle,
  supportsHyperlinks,
} from "./terminal-osc.js";
