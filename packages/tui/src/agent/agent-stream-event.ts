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

// The tool-result routing moved to `tool-result-routing.ts` (#59 item 1) — this file declares the
// stream-event SHAPE, and routing a result is a different question. Re-exported here so every
// existing import keeps working.
export {
  isShellEnvelope,
  looksLikeUnifiedDiff,
  type NormalizedShell,
  parseShellEnvelope,
  routeToolResult,
  toShell,
} from "./tool-result-routing.js";

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
