// Public barrel for the markdown domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

// ensureHighlighter stays module-internal (EC-10 — D7 precedent);
// preloadHighlighter is the PUBLIC readiness seam (DV-5, review batch).
export { CodeBlock, preloadHighlighter } from "./code-block.js";

export { MarkdownText } from "./markdown-text.js";

export type { MarkdownTextProps } from "./markdown-text.js";

export type { CodeBlockProps } from "./code-block.js";
