/**
 * `@theokit/tui/ai-sdk` — adapt the `ai` SDK's `UIMessage[]` (the shape TheoKit's unified agent client
 * produces) into the two shapes this package renders: `ChatThreadMessage[]` for `<ChatThread>` and
 * `AgentEvent[]` for `<AgentTimeline>`. Pure functions, no React, no Ink — a terminal app folds the client's
 * message snapshot through these to render with the same primitives the web/desktop surfaces use.
 *
 * `ai` is a TYPE-ONLY import (erased at build) and an OPTIONAL peer — a consumer of the unified client
 * already has it; a consumer that only renders raw `AgentEvent[]` never installs it.
 */
import type { UIMessage } from "ai";

import type { AgentEvent, AgentToolEvent } from "../agent-event.js";
import type { ChatThreadMessage } from "../chat-thread.js";
import type { ToolCallStatus } from "../tool-call.js";

type UIMessagePart = UIMessage["parts"][number];

/** ai SDK tool-part `state` → tui {@link ToolCallStatus}. Approval-pending states read as `pending`. */
const TOOL_STATUS: Readonly<Record<string, ToolCallStatus>> = {
  "input-streaming": "pending",
  "input-available": "running",
  "approval-requested": "pending",
  "approval-responded": "pending",
  "output-available": "success",
  "output-error": "failed",
};

/** The tool fields we read — identical across the static (`tool-<name>`) and `dynamic-tool` part shapes. */
interface ToolPartView {
  toolCallId: string;
  toolName: string;
  state: string;
  output?: unknown;
  errorText?: string;
}

/** Read the tool view from a part, or `null` when the part is not a tool invocation. */
function toolView(part: UIMessagePart): ToolPartView | null {
  const isDynamic = part.type === "dynamic-tool";
  if (!isDynamic && !part.type.startsWith("tool-")) return null;
  // The static (`tool-<name>`) shape is a template-literal type TS cannot narrow via `startsWith`, so read
  // the shared fields structurally (sanctioned narrowing from `unknown`).
  const p = part as unknown as Record<string, unknown>;
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
    // toolCallId is unique across the turn; fall back to a message-scoped id when a part omits it.
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
 * Project `UIMessage[]` onto the chat surface: one `ChatThreadMessage` per message that has text, its
 * `content` the concatenation of the message's text parts. Tool-only / reasoning-only turns produce no
 * chat bubble (they belong to the {@link uiMessagesToAgentEvents} timeline). `role` passes through 1:1.
 */
export function uiMessagesToChatThread(
  messages: readonly UIMessage[],
): ChatThreadMessage[] {
  const out: ChatThreadMessage[] = [];
  for (const message of messages) {
    let content = "";
    for (const part of message.parts) {
      if (part.type === "text") content += part.text;
    }
    if (content.length === 0) continue;
    out.push({ id: message.id, role: message.role, content });
  }
  return out;
}

/**
 * Flatten `UIMessage[]` into an ordered `AgentEvent[]` for `<AgentTimeline>`: each text part → a `message`
 * event, each reasoning part → a `thinking` event, each tool invocation → a `tool` event (status mapped from
 * the ai SDK part `state`). Every id is unique (text/reasoning are message-part-scoped; tools use the
 * `toolCallId`), satisfying the timeline's duplicate-id contract. Non-renderable parts (file, source,
 * step-start, data, custom) are skipped.
 */
export function uiMessagesToAgentEvents(
  messages: readonly UIMessage[],
): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const message of messages) {
    message.parts.forEach((part, index) => {
      if (part.type === "text") {
        if (part.text.length > 0) {
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
        if (part.text.length > 0) {
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
