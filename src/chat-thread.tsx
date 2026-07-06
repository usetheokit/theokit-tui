import { Box, Static } from "ink";
import { memo, useMemo } from "react";

import { ChatMessage } from "./chat-message.js";
import type { ChatRole } from "./chat-message.js";

export interface ChatThreadMessage {
  /** Stable unique identity — React key + Static watermark anchor. */
  id: string;
  role: ChatRole;
  content: string;
}

export interface ChatThreadProps {
  /**
   * Ordered messages. STREAMING CONTRACT (plan ADR D2): replace the LAST
   * message with a new object carrying longer `content`; rows are memoized by
   * object identity, so only the replaced row repaints. In-place mutation
   * (same reference) does NOT repaint.
   */
  messages: ChatThreadMessage[];
  /**
   * Messages beyond `windowSize + windowOverscan` graduate into Ink `<Static>`
   * (terminal scrollback) and are FROZEN — append-only history (ADR D1).
   */
  windowSize?: number;
  windowOverscan?: number;
}

const Row = memo(
  ({ message }: { message: ChatThreadMessage }) => (
    <ChatMessage role={message.role}>{message.content}</ChatMessage>
  ),
  (prev, next) => prev.message === next.message,
);
Row.displayName = "ChatThread.Row";

function assertUniqueIds(messages: ChatThreadMessage[]): void {
  const seen = new Set<string>();
  for (const message of messages) {
    if (seen.has(message.id)) {
      // Duplicate keys silently corrupt the Static watermark + row identity —
      // fail fast at the boundary (plan ADR D7, rules/error-handling.md § 2).
      throw new TypeError(`ChatThread: duplicate message id "${message.id}"`);
    }
    seen.add(message.id);
  }
}

/**
 * Chat thread with windowed `<Static>` history: older messages render ONCE
 * into terminal scrollback (Ink's scroll mechanism); the live tail re-renders
 * per message-identity change. Empty-string ids are legal — only DUPLICATES
 * throw (plan EC-4).
 */
export function ChatThread({
  messages,
  windowSize = 8,
  windowOverscan = 4,
}: ChatThreadProps) {
  assertUniqueIds(messages);
  const tailStart = Math.max(
    0,
    messages.length - Math.max(0, windowSize) - Math.max(0, windowOverscan),
  );
  const prefix = useMemo(
    () => messages.slice(0, tailStart),
    [messages, tailStart],
  );
  const tail = messages.slice(tailStart);

  return (
    <>
      {prefix.length > 0 && (
        <Static items={prefix}>
          {(message) => <Row key={message.id} message={message} />}
        </Static>
      )}
      <Box flexDirection="column">
        {tail.map((message) => (
          <Row key={message.id} message={message} />
        ))}
      </Box>
    </>
  );
}
