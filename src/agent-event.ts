import type { ChatRole } from "./chat-message.js";
import type { ToolCallStatus } from "./tool-call.js";
import type { ShellEnvelope } from "./tool-result.js";

// PURE types module (plan ADR D8): no ink/React import — M7 adapters consume
// the event shape without pulling render code.

// Single source for the kind union (plan ADR D1): the type, the runtime
// guard and AgentTimeline's error message all derive from this array. The
// discriminant is `kind`, NOT `type` — a deliberate divergence from all three
// analogs (reserved-word-ambiguous naming; recorded in ADR D1).
export const AGENT_EVENT_KINDS = [
  "message",
  "thinking",
  "tool",
  "explored",
] as const;

export type AgentEventKind = (typeof AGENT_EVENT_KINDS)[number];

export interface AgentMessageEvent {
  /** Stable unique identity — React key + streaming replace anchor. */
  id: string;
  kind: "message";
  role: ChatRole;
  text: string;
}

export interface AgentThinkingEvent {
  id: string;
  kind: "thinking";
  /** The reasoning summary the adapter chose — rendered dim+italic in full. */
  text: string;
}

export interface AgentToolEvent {
  id: string;
  kind: "tool";
  name: string;
  status: ToolCallStatus;
  summary?: string;
  /** Plain output lines. EXCLUSIVE with `shell`/`diff` (validated at the boundary). */
  output?: string;
  /** Shell envelope. EXCLUSIVE with `output`/`diff`. */
  shell?: ShellEnvelope;
  /** Unified-diff text — rendered as a colored inline diff (DiffViewer), the
   * Codex-style edit render for a tool like `apply_patch`. EXCLUSIVE with
   * `output`/`shell`. */
  diff?: string;
  /** The tool input the model proposed — used to render a Codex-style
   * verb+target summary ("Read config.mjs") inside an `explored` group. */
  input?: unknown;
  /** Rendered line budget for the body. Default 10 on the `output`/`shell`
   * path (ToolResult) and 20 on the `diff` path (DiffViewer counts the file
   * headers in the same budget, so it needs the extra room). */
  maxLines?: number;
}

/**
 * A run of consecutive read-only exploration tool calls (read/list/grep),
 * collapsed into ONE Codex-style "Explored" block — a header + one verb+target
 * line per tool, output summarized away. Produced by the message projection
 * (`messagesToAgentEvents`), so the timeline renders it as a single row and the
 * `<Static>` windowing is untouched (1 event = 1 row holds).
 */
export interface AgentExploredEvent {
  id: string;
  kind: "explored";
  /** The grouped tool calls, in order. */
  tools: AgentToolEvent[];
}

/**
 * One item of the agent timeline. Ordering contract (plan ADR D2): the array
 * is caller-ordered; ids are unique (duplicates throw); graduated events are
 * IMMUTABLE — only the tail event may be replaced by identity (streaming).
 * Text passes through unsanitized (ANSI is the caller's responsibility —
 * M2 EC-16 parity). Extra properties are tolerated (M7 adapters may enrich).
 */
export type AgentEvent =
  AgentMessageEvent | AgentThinkingEvent | AgentToolEvent | AgentExploredEvent;

export function isAgentEventKind(value: unknown): value is AgentEventKind {
  return (AGENT_EVENT_KINDS as readonly unknown[]).includes(value);
}
