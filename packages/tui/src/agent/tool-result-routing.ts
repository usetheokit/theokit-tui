/**
 * How a raw tool result becomes a rendered body: shell envelope, unified diff, or plain output.
 *
 * Extracted from `agent-stream-event.ts` (#59 item 1), which documents itself as the structural
 * stream-event union — a shape declaration. This is a decision procedure over tool results, and it
 * arrived at a different question than the file it lived in was answering. Nothing about the
 * routing is specific to the stream: `messagesToAgentEvents` calls it over SDK message parts, and
 * an app's `ToolResultFormatter` returns the same union.
 *
 * PURE, like its former home: no ink, no react, no sdk import.
 *
 * Every symbol is re-exported from `agent-stream-event.ts` for back-compat, so no import anywhere
 * has to change.
 */

/** Shell-envelope result: at least one of the three keys, with strings for
 * stdout/stderr and a number for exitCode WHEN PRESENT (EC-12 — a
 * `{stdout: 42}` would flow unvalidated into ToolResult and misrender). */
function keyValid(
  candidate: Record<string, unknown>,
  key: string,
  expected: "string" | "number",
): boolean {
  return !(key in candidate) || typeof candidate[key] === expected;
}

export function isShellEnvelope(
  result: unknown,
): result is { stdout?: string; stderr?: string; exitCode?: number } {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return false;
  }
  const candidate = result as Record<string, unknown>;
  const hasAny = "stdout" in candidate || "stderr" in candidate || "exitCode" in candidate;
  return (
    hasAny &&
    keyValid(candidate, "stdout", "string") &&
    keyValid(candidate, "stderr", "string") &&
    keyValid(candidate, "exitCode", "number")
  );
}

/** The normalized shell shape both timeline projections (`AgentTimeline`'s
 * `shell` prop / ToolResult) render. Structural — assignable to
 * `AgentToolEvent["shell"]` without importing the event type here (this module
 * stays dependency-free). */
export interface NormalizedShell {
  stdout: string;
  stderr: string;
  exitCode?: number;
}

/** Normalize a validated shell envelope to {@link NormalizedShell} (fills
 * missing stdout/stderr with "", keeps a numeric exitCode). Shared by the
 * stream-reducer and the message projection (DRY). */
export function toShell(envelope: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}): NormalizedShell {
  return {
    stdout: envelope.stdout ?? "",
    stderr: envelope.stderr ?? "",
    ...(typeof envelope.exitCode === "number" ? { exitCode: envelope.exitCode } : {}),
  };
}

/** A tool result can arrive as a JSON-STRING-encoded shell envelope: the
 * in-process SDK serializes the {stdout,stderr,exitCode} envelope before it
 * surfaces the tool result. Parse it so ToolResult's shell renderer fires
 * instead of the timeline dumping the raw JSON. A non-JSON or non-envelope
 * string returns undefined and falls through to the output ladder (no
 * regression). */
export function parseShellEnvelope(raw: string): NormalizedShell | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  return isShellEnvelope(parsed) ? toShell(parsed) : undefined;
}

/** Whether `text` is a git-style unified diff — the signal to render it as a
 * colored inline diff (DiffViewer) instead of plain output. STRICT on purpose:
 * requires BOTH a `@@` hunk header AND a `---`/`diff --git` file header, so a
 * plain listing that merely contains `@@` is never misrouted. */
export function looksLikeUnifiedDiff(text: string): boolean {
  return /^@@ .* @@/m.test(text) && (/^--- /m.test(text) || /^diff --git /m.test(text));
}

/** The timeline field that renders a tool-result VALUE best: an inline `diff`,
 * a `shell` envelope, or plain `output`. Shared by both timeline projections
 * (the message projection and the stream reducer) — DRY. A shell envelope whose
 * stdout is a clean unified diff (no stderr, exit 0) is an `apply_patch`-style
 * edit and routes to `diff`. Returns undefined when the value is neither a
 * shell envelope, a diff, nor a string — the caller applies its own fallback
 * (e.g. a `.text` field, or `JSON.stringify`). */
export function routeToolResult(
  value: unknown,
): { diff: string } | { shell: NormalizedShell } | { output: string } | undefined {
  const envelope = isShellEnvelope(value)
    ? toShell(value)
    : typeof value === "string"
      ? parseShellEnvelope(value)
      : undefined;
  if (envelope !== undefined) {
    if (
      envelope.stderr === "" &&
      (envelope.exitCode === undefined || envelope.exitCode === 0) &&
      looksLikeUnifiedDiff(envelope.stdout)
    ) {
      return { diff: envelope.stdout };
    }
    return { shell: envelope };
  }
  if (typeof value === "string") {
    return looksLikeUnifiedDiff(value) ? { diff: value } : { output: value };
  }
  return undefined;
}
