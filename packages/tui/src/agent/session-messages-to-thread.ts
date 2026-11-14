/**
 * `@theokit/tui` — render a stored session as `initialMessages` for `useAgentStream`.
 *
 * The SDK stores tool calls Claude-style: `tool_use` and `tool_result` are separate parts joined by an id,
 * often in different messages. `messagesToAgentEvents` expects one `tool-<name>` part per call, so this
 * pairs them. The input types are STRUCTURAL: they match `SessionMessage` / `SessionMessagePart` from
 * `@theokit/sdk` (what `readSessionMessages()` returns) without importing it.
 */

import type { UIMessageLike, UIMessagePartLike } from "./messages-to-events.js";

/** A part of a stored message. Matches the SDK's `SessionMessagePart`. */
export type StoredMessagePart =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; toolUseId: string; content: unknown; isError?: boolean };

/** A stored message. Matches the SDK's `SessionMessage`. */
export interface StoredMessage {
  role: "user" | "assistant";
  text: string;
  parts?: readonly StoredMessagePart[];
}

interface CollectedResult {
  output: string;
  isError: boolean;
}

const toText = (content: unknown): string =>
  typeof content === "string" ? content : (JSON.stringify(content) ?? "");

/** Every `tool_result` in the history, by call id: the result usually sits in the message after the call. */
function collectResults(messages: readonly StoredMessage[]): Map<string, CollectedResult> {
  const results = new Map<string, CollectedResult>();
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part?.type === "tool_result") {
        results.set(part.toolUseId, {
          output: toText(part.content),
          isError: part.isError === true,
        });
      }
    }
  }
  return results;
}

function toolPart(
  part: Extract<StoredMessagePart, { type: "tool_use" }>,
  results: ReadonlyMap<string, CollectedResult>,
): UIMessagePartLike {
  const base = { type: `tool-${part.name}`, toolCallId: part.id, input: part.input };
  const result = results.get(part.id);
  if (result === undefined) return { ...base, state: "input-available" };
  if (result.isError) return { ...base, state: "output-error", errorText: result.output };
  return { ...base, state: "output-available", output: result.output };
}

function convertParts(
  message: StoredMessage,
  results: ReadonlyMap<string, CollectedResult>,
): UIMessagePartLike[] {
  if (message.parts === undefined) {
    return message.text === "" ? [] : [{ type: "text", text: message.text }];
  }
  const out: UIMessagePartLike[] = [];
  for (const part of message.parts) {
    if (part?.type === "text") {
      if (typeof part.text === "string" && part.text !== "")
        out.push({ type: "text", text: part.text });
    } else if (part?.type === "tool_use") {
      out.push(toolPart(part, results));
    }
    // tool_result (already paired) and unknown part types are skipped.
  }
  return out;
}

/**
 * Convert stored session messages (e.g. `await readSessionMessages(id)`) to `UIMessageLike[]`, ready for
 * `useAgentStream(source, { initialMessages })`. Results are paired with their calls across messages; a
 * result naming no call is dropped; messages left empty are dropped. Ids are `<idPrefix>-<index>` (original
 * index), stable between renders.
 */
export function sessionMessagesToThread(
  messages: readonly StoredMessage[],
  opts: { idPrefix?: string } = {},
): UIMessageLike[] {
  const prefix = opts.idPrefix ?? "history";
  const results = collectResults(messages);
  const thread: UIMessageLike[] = [];
  messages.forEach((message, index) => {
    const parts = convertParts(message, results);
    if (parts.length > 0) thread.push({ id: `${prefix}-${index}`, role: message.role, parts });
  });
  return thread;
}
