// Structural stream-event union (plan m7-stream-adapter ADR D1): designed
// FRESH from the real @theokit/sdk tables — NOT copied from the theo-ui
// mirror, whose type drifts today (tsc-proven: SDKStatusMessage.message is a
// string; the mirror's "text_delta" never arrives from any public surface —
// the real fine event is "text-delta" inside the onDelta wrapper).
// PURE: no ink, no react, no sdk import (zero runtime coupling — the
// compile-time drift tripwire in tests/sdk-assignability.test.ts checks the
// REAL types against this union).
//
// Documented drops (EC-11): assistant `tool_use` blocks are NOT folded (tool
// lifecycle arrives via `tool_call` events); the fine camelCase
// `tool-call-*` updates no-op in v0 — coarse `tool_call` is the lifecycle
// surface. `"done"`/`"error"` are OUR hook synthetics — no SDK stream emits
// them (stream end = generator completion; failures throw).

/** One block of an assistant message's content array (TextBlock subset). */
export interface AssistantContentBlock {
  type?: string;
  text?: string;
}

export interface AgentStreamEvent {
  /** Discriminator — OPEN by design: unknown types fold to no-op. */
  type: string;
  /** Fine token text ("text-delta"/"thinking-delta") or coarse thinking text. */
  text?: string;
  /**
   * Assistant/user message payload. Widened to accept the SDK's
   * `SDKStatusMessage.message?: string` (the whole-union assignability fix).
   */
  message?: string | { content?: ReadonlyArray<AssistantContentBlock> };
  /** Tool lifecycle (coarse `tool_call`). */
  call_id?: string;
  name?: string;
  /**
   * Tool status ("running" | "completed" | "error") — but the same field
   * name carries the cloud-status vocabulary on `status` events: the reducer
   * NEVER switches on `status` before `type`.
   */
  status?: string;
  args?: unknown;
  /** Tool result — {stdout, stderr, exitCode} today, declared unstable. */
  result?: unknown;
  /** OUR synthetic `error` payload (client-side — no SDK stream carries it). */
  error?: string | { message?: string };
}

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

/**
 * Extracts the text of an assistant message: a plain string passes through
 * (the widened arm); an object's content array contributes its text blocks
 * concatenated; anything else yields "" (the mint-empty rule's input).
 */
export function extractAssistantText(message: AgentStreamEvent["message"]): string {
  if (typeof message === "string") {
    return message;
  }
  if (typeof message !== "object" || message === null || !Array.isArray(message.content)) {
    return "";
  }
  let text = "";
  for (const block of message.content) {
    if (typeof block === "object" && block !== null && "text" in block) {
      const value = (block as AssistantContentBlock).text;
      if (typeof value === "string") {
        text += value;
      }
    }
  }
  return text;
}
