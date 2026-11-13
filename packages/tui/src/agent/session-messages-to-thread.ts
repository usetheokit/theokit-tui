/**
 * Stored session → thread. Turns a session transcript, where tool calls are Claude-style (`tool_use` and
 * `tool_result` as separate parts joined by an id), into {@link UIMessageLike}s with one `tool-<name>`
 * part per call, ready for `useAgentStream(source, { initialMessages })`.
 *
 * The input is declared structurally and matches `@theokit/sdk`'s `SessionMessage` (as returned by
 * `readSessionMessages()`) without importing it: this package does not depend on the SDK at runtime.
 */

import type { UIMessageLike, UIMessagePartLike } from "./messages-to-events.js";

/** A stored message part. Structurally matches the SDK's `SessionMessagePart`. */
export type StoredMessagePart =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; toolUseId: string; content: unknown; isError?: boolean };

/** A stored message. Structurally matches the SDK's `SessionMessage`. */
export interface StoredMessage {
  role: "user" | "assistant";
  text: string;
  parts?: readonly StoredMessagePart[];
}

interface StoredResult {
  content: string;
  isError: boolean;
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  return JSON.stringify(content) ?? "";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Every `tool_result` in the whole history, keyed by call id (the result usually sits in a later message). */
function collectResults(messages: readonly StoredMessage[]): Map<string, StoredResult> {
  const results = new Map<string, StoredResult>();
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (!isRecord(part) || part.type !== "tool_result") continue;
      if (typeof part.toolUseId !== "string") continue;
      results.set(part.toolUseId, {
        content: stringifyContent(part.content),
        isError: part.isError === true,
      });
    }
  }
  return results;
}

function toolPart(
  part: { id: string; name: string; input: unknown },
  results: ReadonlyMap<string, StoredResult>,
): UIMessagePartLike {
  const base = { type: `tool-${part.name}`, toolCallId: part.id, input: part.input };
  const result = results.get(part.id);
  if (result === undefined) return { ...base, state: "input-available" };
  if (result.isError) return { ...base, state: "output-error", errorText: result.content };
  return { ...base, state: "output-available", output: result.content };
}

function messageParts(
  message: StoredMessage,
  results: ReadonlyMap<string, StoredResult>,
): UIMessagePartLike[] {
  if (message.parts === undefined) {
    return message.text === "" ? [] : [{ type: "text", text: message.text }];
  }
  const out: UIMessagePartLike[] = [];
  for (const part of message.parts) {
    if (!isRecord(part)) continue;
    if (part.type === "text" && typeof part.text === "string") {
      if (part.text !== "") out.push({ type: "text", text: part.text });
    } else if (
      part.type === "tool_use" &&
      typeof part.id === "string" &&
      typeof part.name === "string"
    ) {
      out.push(toolPart(part, results));
    }
    // tool_result parts are folded into their call; unknown part types are skipped.
  }
  return out;
}

/**
 * Convert a stored session into thread messages. Results are paired with their calls across messages;
 * a result naming no call is dropped; messages left with no parts are dropped. Ids are
 * `<idPrefix>-<index>` (default `history`) so they stay stable between renders.
 */
export function sessionMessagesToThread(
  messages: readonly StoredMessage[],
  opts: { idPrefix?: string } = {},
): UIMessageLike[] {
  const prefix = opts.idPrefix ?? "history";
  const results = collectResults(messages);
  const thread: UIMessageLike[] = [];
  messages.forEach((message, index) => {
    const parts = messageParts(message, results);
    if (parts.length > 0) thread.push({ id: `${prefix}-${index}`, role: message.role, parts });
  });
  return thread;
}
