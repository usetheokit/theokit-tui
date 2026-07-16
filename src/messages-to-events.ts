/**
 * `@theokit/tui` — project a client message snapshot onto the two shapes this package renders
 * (`AgentEvent[]` for `<AgentTimeline>`, `ChatThreadMessage[]` for `<ChatThread>`), with NO dependency on
 * the `ai` SDK. The input is a STRUCTURAL {@link UIMessageLike} (id + role + parts), which the ai SDK's
 * `UIMessage` satisfies 1:1 — so a consumer of TheoKit's unified agent client passes `useAgent().thread`
 * straight through without importing `ai`. Pure functions, no React, no Ink.
 *
 * (The `@theokit/tui/ai-sdk` subpath re-exports these under `ai`-typed aliases for back-compat.)
 */
import type { AgentEvent, AgentToolEvent } from "./agent-event.js";
import type { ChatThreadMessage } from "./chat-thread.js";
import type { ToolCallStatus } from "./tool-call.js";

/** A message part, read structurally — a `text`/`reasoning` block or a tool invocation. */
export interface UIMessagePartLike {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/** The minimal message shape the renderers read. The ai SDK's `UIMessage` is assignable to this. */
export interface UIMessageLike {
  id: string;
  role: "user" | "assistant" | "system";
  parts: readonly UIMessagePartLike[];
  /** Per-turn metadata the agent stream rides on the finish chunk (usage/cost) — read by {@link readTurnUsage}. */
  metadata?: unknown;
}

/**
 * Per-turn usage extracted from a message's {@link UIMessageLike.metadata} — the totals the agent stream
 * attaches to the finish chunk's `messageMetadata` (and `readUIMessageStream` lands on `UIMessage.metadata`).
 * Optional fields are OMITTED when the provider/agent did not report them (never fabricated as 0).
 */
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Total cost in USD for the turn (present iff the agent reported it). */
  cost?: number;
  durationMs?: number;
}

const USAGE_TOKEN_KEYS = [
  "reasoningTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
] as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Read the per-turn usage from a message's metadata, or `undefined` when absent/malformed. Structural and
 * DEFENSIVE (never throws): a user turn, a run that ended without `done`, or a foreign metadata shape all
 * yield `undefined`. The three required token counts must be finite numbers; optional buckets/cost/duration
 * are copied only when finite. This is the seam a status bar / cost meter renders — see {@link TurnUsage}.
 */
export function readTurnUsage(message: UIMessageLike): TurnUsage | undefined {
  const metadata = message.metadata;
  if (!isRecord(metadata)) return undefined;
  const usage = metadata.usage;
  if (!isRecord(usage)) return undefined;
  if (
    !isFiniteNumber(usage.inputTokens) ||
    !isFiniteNumber(usage.outputTokens) ||
    !isFiniteNumber(usage.totalTokens)
  ) {
    return undefined;
  }
  const out: TurnUsage = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
  for (const key of USAGE_TOKEN_KEYS) {
    const value = usage[key];
    if (isFiniteNumber(value)) out[key] = value;
  }
  if (isFiniteNumber(metadata.cost)) out.cost = metadata.cost;
  if (isFiniteNumber(metadata.durationMs)) out.durationMs = metadata.durationMs;
  return out;
}

/**
 * A gated tool paused awaiting a human decision — surfaced by {@link findPendingApproval} from a
 * reconstructed `approval-requested` tool part, so a surface renders an approval prompt and settles it
 * via the agent client's `approve(approvalId, decision)`.
 */
export interface PendingApproval {
  /** The id to settle: `useAgent().approve(approvalId, decision)`. */
  approvalId: string;
  /** The tool the human is being asked to allow (e.g. `send_email`). */
  toolName: string;
  /** The tool input the model proposed (shown to the approver). */
  input?: unknown;
}

/**
 * Scan a thread for a tool part awaiting human approval (`state === "approval-requested"`), newest first,
 * and surface its {@link PendingApproval}. `undefined` when none is pending (settled, or never gated).
 * Structural + DEFENSIVE (never throws): mirrors ai-sdk's reconstruction — `approval.id` (else the
 * `toolCallId`) is the settle id; `toolName`/`input` come off the same part.
 */
/** The settle id: `approval.id`, else the `toolCallId`, else none. */
function resolveApprovalId(p: Record<string, unknown>): string | undefined {
  const approval = p.approval as { id?: unknown } | undefined;
  if (typeof approval?.id === "string") return approval.id;
  if (typeof p.toolCallId === "string") return p.toolCallId;
  return undefined;
}

/** Read a single part as a {@link PendingApproval}, or `undefined` when it is
 * not an approval-requested tool part with a settle id. */
function partToPendingApproval(part: unknown): PendingApproval | undefined {
  const p = part as Record<string, unknown>;
  if (p.state !== "approval-requested") return undefined;
  const approvalId = resolveApprovalId(p);
  if (approvalId === undefined) return undefined;
  const result: PendingApproval = {
    approvalId,
    toolName: typeof p.toolName === "string" ? p.toolName : "tool",
  };
  if (p.input !== undefined) result.input = p.input;
  return result;
}

export function findPendingApproval(
  messages: readonly UIMessageLike[],
): PendingApproval | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i]?.parts ?? [];
    for (const part of parts) {
      const pending = partToPendingApproval(part);
      if (pending !== undefined) return pending;
    }
  }
  return undefined;
}

/** ai SDK tool-part `state` → tui {@link ToolCallStatus}. Approval-pending states read as `pending`. */
const TOOL_STATUS: Readonly<Record<string, ToolCallStatus>> = {
  "input-streaming": "pending",
  "input-available": "running",
  "approval-requested": "pending",
  "approval-responded": "pending",
  "output-available": "success",
  "output-error": "failed",
};

interface ToolPartView {
  toolCallId: string;
  toolName: string;
  state: string;
  output?: unknown;
  errorText?: string;
}

/** Read the tool view from a part, or `null` when the part is not a tool invocation. */
function toolView(part: UIMessagePartLike): ToolPartView | null {
  const isDynamic = part.type === "dynamic-tool";
  if (!isDynamic && !part.type.startsWith("tool-")) return null;
  const p = part as Record<string, unknown>;
  const toolCallId = typeof p.toolCallId === "string" ? p.toolCallId : "";
  const toolName = isDynamic
    ? typeof p.toolName === "string"
      ? p.toolName
      : "tool"
    : part.type.slice("tool-".length);
  const view: ToolPartView = {
    toolCallId,
    toolName,
    state: typeof p.state === "string" ? p.state : "",
    output: p.output,
  };
  if (typeof p.errorText === "string") view.errorText = p.errorText;
  return view;
}

/** The plain-text output the timeline shows for a tool: `errorText` on failure, else the stringified output. */
function toolOutput(tool: ToolPartView): string | undefined {
  if (tool.state === "output-error") return tool.errorText;
  if (tool.output === undefined) return undefined;
  return typeof tool.output === "string"
    ? tool.output
    : JSON.stringify(tool.output, null, 2);
}

function toToolEvent(
  tool: ToolPartView,
  messageId: string,
  index: number,
): AgentToolEvent {
  const event: AgentToolEvent = {
    id:
      tool.toolCallId.length > 0 ? tool.toolCallId : `${messageId}::t${index}`,
    kind: "tool",
    name: tool.toolName,
    status: TOOL_STATUS[tool.state] ?? "pending",
  };
  const output = toolOutput(tool);
  if (output !== undefined) event.output = output;
  return event;
}

/**
 * Project messages onto the chat surface: one `ChatThreadMessage` per message that has text, its `content`
 * the concatenation of the message's text parts. Tool-only / reasoning-only turns produce no chat bubble.
 */
export function messagesToChatThread(
  messages: readonly UIMessageLike[],
): ChatThreadMessage[] {
  const out: ChatThreadMessage[] = [];
  for (const message of messages) {
    let content = "";
    for (const part of message.parts) {
      if (part.type === "text" && typeof part.text === "string")
        content += part.text;
    }
    if (content.length === 0) continue;
    out.push({ id: message.id, role: message.role, content });
  }
  return out;
}

/**
 * Flatten messages into an ordered `AgentEvent[]` for `<AgentTimeline>`: each text part → a `message` event,
 * each reasoning part → a `thinking` event, each tool invocation → a `tool` event (status mapped from the
 * part `state`). Every id is unique. Non-renderable parts (file, source, step-start, data, custom) are skipped.
 */
export function messagesToAgentEvents(
  messages: readonly UIMessageLike[],
): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const message of messages) {
    message.parts.forEach((part, index) => {
      if (part.type === "text") {
        if (typeof part.text === "string" && part.text.length > 0) {
          events.push({
            id: `${message.id}::m${index}`,
            kind: "message",
            role: message.role,
            text: part.text,
          });
        }
        return;
      }
      if (part.type === "reasoning") {
        if (typeof part.text === "string" && part.text.length > 0) {
          events.push({
            id: `${message.id}::r${index}`,
            kind: "thinking",
            text: part.text,
          });
        }
        return;
      }
      const tool = toolView(part);
      if (tool !== null) events.push(toToolEvent(tool, message.id, index));
    });
  }
  return events;
}
