// Public barrel for the tools domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export type { ExpandableOutputProps } from "./expandable-output.js";
// M25 — parity polish.
export { ExpandableOutput } from "./expandable-output.js";
export type { ToolCallProps, ToolCallStatus } from "./tool-call.js";
export { TOOL_CALL_STATUSES, ToolCall } from "./tool-call.js";
export type { ToolCallCardProps } from "./tool-call-card.js";
export { ToolCallCard } from "./tool-call-card.js";
export type { ToolCardResult } from "./tool-card-result.js";
export {
  DEFAULT_TOOL_PRESENTATION,
  KNOWN_TOOL_NAMES,
  type KnownToolName,
  type ToolPresentation,
  toolPresentation,
} from "./tool-presentation.js";
export type { ShellEnvelope, ToolResultProps } from "./tool-result.js";
// truncateLines stays module-internal (ADR D7 — SEPA phase-2 F1).
export { MAX_RESULT_CHARS, ToolResult } from "./tool-result.js";
