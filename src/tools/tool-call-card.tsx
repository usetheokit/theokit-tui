import { Box, Text } from "ink";
import type { ReactNode } from "react";

import { parseUnifiedDiff } from "../diff/diff.js";
import { omitMargin, pickMargin } from "../layout/layout-props.js";
import { ResultBody } from "./result-body.js";
import type { ToolCallProps } from "./tool-call.js";
import { ToolCall } from "./tool-call.js";
import type { ToolCardResult } from "./tool-card-result.js";
import { assertToolCardResult } from "./tool-card-result.js";

export interface ToolCallCardProps extends ToolCallProps {
  /** M16: per-kind result body — `{kind:"diff"}` renders the patch via
   * DiffViewer (its malformed-patch TypeError PROPAGATES — fail-fast),
   * `{kind:"output"}` the shell envelope via ToolResult, `{kind:"preview"}`
   * a capped CodeBlock (with `language`) or plain lines. Renders in the
   * SAME indented slot as children; when both are present the result body
   * comes FIRST, children below (EC-3). */
  result?: ToolCardResult;
  /**
   * Card body, indented under the name (no borders at M2 — ADR D3).
   * Plain STRING children are auto-wrapped in `<Text>` (a raw string inside
   * Ink's `<Box>` throws — EC-4); an empty string collapses to the bare row.
   */
  children?: ReactNode;
}

/**
 * Tool-call card: `ToolCall` header + body indented by the indicator width.
 * Without children (or with an empty string) it renders exactly the row.
 */

/**
 * M16 boundary: validate the result union and eagerly parse a diff patch so a
 * malformed patch throws a TYPED error at the card boundary (EC-1) — testable
 * via a plain call with a stack, before any hook. Only the diff kind carries
 * runtime DATA; output/preview payload shapes are compile-time programmer errors.
 */
function assertResultBoundary(result: ToolCardResult | undefined): void {
  if (result === undefined) {
    return;
  }
  assertToolCardResult(result);
  if (result.kind === "diff") {
    parseUnifiedDiff(result.patch);
  }
}

/** True when `children` is renderable content (not undefined/null/""/boolean —
 * the `{cond && <X/>}` idiom's residue). SEPA phase-1 F5. */
function hasRenderableBody(children: ReactNode): boolean {
  return (
    children !== undefined && children !== null && children !== "" && typeof children !== "boolean"
  );
}

export function ToolCallCard({ children, result, ...row }: ToolCallCardProps) {
  assertResultBoundary(result);
  // SEPA phase-1 F5: numbers crash Ink like strings do (auto-wrap both).
  const body =
    typeof children === "string" || typeof children === "number" ? (
      <Text>{children}</Text>
    ) : (
      children
    );
  const hasBody = hasRenderableBody(children);
  return (
    // Margin lands on the card's outer Box; the inner ToolCall gets the row
    // WITHOUT margin so the gap is not applied twice (composition, F-arch).
    <Box flexDirection="column" {...pickMargin(row)}>
      <ToolCall {...omitMargin(row)} />
      {(result !== undefined || hasBody) && (
        <ToolTree>
          {result !== undefined && <ResultBody result={result} />}
          {hasBody && body}
        </ToolTree>
      )}
    </Box>
  );
}

/**
 * M26: renders the result/children body under a `⎿` (U+23BF) corner connector —
 * the Claude Code tool-tree idiom. The connector shows once at the top-left; the
 * body flows to its right so multi-line continuation aligns under the body, not
 * the connector (codex `"  └ "` first-line / `"    "` continuation shape).
 */
function ToolTree({ children }: { children: ReactNode }) {
  return (
    <Box paddingLeft={2}>
      <Box flexShrink={0}>
        <Text dimColor>⎿ </Text>
      </Box>
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}
