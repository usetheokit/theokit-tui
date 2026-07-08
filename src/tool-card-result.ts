// M16 tool-card result union (plan m16-tool-card-variants, ADR D1): the
// EXPLICIT discriminated union — a typed lib API beats gemini's
// shape-sniffing dispatch (ToolResultDisplay.tsx:100-175). The card
// validates only `kind` (REACHABLE from JS callers — explicit boundary
// check, not a dead `never` guard; the M13 lesson); payload contracts
// stay with the primitives (ADR D2 — DiffViewer's malformed-patch
// TypeError PROPAGATES).

import type { ShellEnvelope } from "./tool-result.js";

export type ToolCardResult =
  | {
      kind: "diff";
      /** Unified-diff text — DiffViewer's contract (typed error on a
       * malformed patch propagates through the card). DiffViewer emits its
       * own per-file header row (falling back to "(unnamed)") — a separate
       * fileName prop was REMOVED at review (r2-F2: it duplicated or
       * contradicted that row in both scenarios). */
      patch: string;
      maxLines?: number;
      contextLines?: number;
    }
  | {
      kind: "output";
      /** Shell envelope — ToolResult's stdout/stderr/exitCode mode. */
      shell: ShellEnvelope;
      maxLines?: number;
      expanded?: boolean;
    }
  | {
      kind: "preview";
      text: string;
      /** Routes to CodeBlock (plain-first render); absent = plain lines.
       * NOTE the cap semantics differ by branch (inherited from the
       * primitives — r2-F4): with `language` the HEAD lines survive with a
       * `(+N more lines)` trailer (CodeBlock); without it the TAIL survives
       * with a `+N lines hidden` indicator (ToolResult). */
      language?: string;
      maxLines?: number;
    };

const KINDS = ["diff", "output", "preview"] as const;

/** Boundary validation for the card's `result` prop (fail-fast). */
export function assertToolCardResult(result: ToolCardResult): void {
  if (
    typeof result !== "object" ||
    result === null ||
    !KINDS.includes(result.kind)
  ) {
    throw new TypeError(
      `ToolCallCard: \`result.kind\` must be one of ${KINDS.join(" | ")} — got ${JSON.stringify(
        typeof result === "object" && result !== null ? result.kind : result,
      )}`,
    );
  }
}
