import { CodeBlock } from "../markdown/code-block.js";
import { DiffViewer } from "../diff/diff-viewer.js";
import type { ToolCardResult } from "./tool-card-result.js";
import { ToolResult } from "./tool-result.js";

/** Drops undefined entries so optional props are OMITTED, never passed as
 * explicit undefined (exactOptionalPropertyTypes — SEPA iteration-4). */
function defined<T extends Record<string, unknown>>(entries: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as Partial<T>;
}

/** M16 per-kind result body (ADR D1 explicit union — no shape sniffing). */
export function ResultBody({ result }: { result: ToolCardResult }) {
  switch (result.kind) {
    case "diff":
      return (
        <DiffViewer
          patch={result.patch}
          {...defined({
            maxLines: result.maxLines,
            contextLines: result.contextLines,
          })}
        />
      );
    case "output":
      return (
        <ToolResult
          shell={result.shell}
          {...defined({
            maxLines: result.maxLines,
            expanded: result.expanded,
          })}
        />
      );
    case "preview":
      if (result.language !== undefined) {
        return (
          <CodeBlock
            code={result.text}
            language={result.language}
            {...defined({ maxLines: result.maxLines })}
          />
        );
      }
      return (
        <ToolResult {...defined({ maxLines: result.maxLines })}>
          {result.text}
        </ToolResult>
      );
  }
}
