// Public barrel for the diff domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

// DiffFold/DiffRow stay module-internal (D10 — no public producer/consumer).
export type { DiffFile, DiffLine, DiffLineKind } from "./diff.js";
export { parseUnifiedDiff } from "./diff.js";
export type { DiffViewerProps } from "./diff-viewer.js";
export { DiffViewer } from "./diff-viewer.js";
