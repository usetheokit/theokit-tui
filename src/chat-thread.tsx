import { Box, Static } from "ink";
import { memo, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { ChatMessage } from "./chat-message.js";
import type { ChatRole } from "./chat-message.js";

export interface ChatThreadMessage {
  /** Stable unique identity — React key + Static watermark anchor. */
  id: string;
  role: ChatRole;
  content: string;
  /** M13 per-message opt-in: render `content` as Markdown (AI-chat subset).
   * Default false — unflagged rows are byte-identical to pre-M13. */
  markdown?: boolean;
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
   * Treat both props as mount-time tuning knobs: INCREASING them after
   * messages have graduated pulls scrollback rows back into the live tail,
   * visibly duplicating history (Static output is unerasable) — review
   * F-arch-2/F-dom-3.
   */
  windowSize?: number;
  windowOverscan?: number;
  /**
   * Optional header folded as the FIRST item of the thread's own `<Static>`
   * — it prints once into scrollback and stays pinned ABOVE graduated
   * history (M11, gemini AppHeader shape). MOUNT-TIME prop: the first
   * render's value is frozen for the component's life; later changes to
   * content, identity AND presence are ignored by design (no
   * refreshStatic/clearTerminal machinery in a library). The key
   * `"__theokit_tui_header__"` is reserved — a message id colliding with it
   * throws. Size the header explicitly (Static's box is content-sized and
   * absolute — percentage widths may not resolve as in the live region).
   */
  header?: ReactElement;
}

/** Reserved Static key for the header sentinel (M11 ADR D1). */
export const HEADER_SENTINEL_KEY = "__theokit_tui_header__";
const HEADER_SENTINEL = Symbol("theokit-tui-header");
type StaticItem = typeof HEADER_SENTINEL | ChatThreadMessage;

const Row = memo(
  ({ message }: { message: ChatThreadMessage }) => (
    <ChatMessage role={message.role} markdown={message.markdown === true}>
      {message.content}
    </ChatMessage>
  ),
  (prev, next) => prev.message === next.message,
);
Row.displayName = "ChatThread.Row";

function assertUniqueIds(messages: ChatThreadMessage[]): void {
  const seen = new Set<string>();
  for (const message of messages) {
    if (message.id === HEADER_SENTINEL_KEY) {
      throw new TypeError(
        `ChatThread: message id "${HEADER_SENTINEL_KEY}" collides with the reserved header sentinel key`,
      );
    }
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
  header,
}: ChatThreadProps) {
  assertUniqueIds(messages);
  // MOUNT-FREEZE (M11 D1): the sentinel's contribution to items.length is
  // constant for the component's life — ink's Static advances its index by
  // LENGTH only, so a shrinking union would skip freshly graduated rows
  // permanently (the same-length trap, blueprint Corner 4).
  const frozenHeader = useRef(header).current;
  const tailStart = Math.max(
    0,
    messages.length - Math.max(0, windowSize) - Math.max(0, windowOverscan),
  );
  const prefix = useMemo(
    () => messages.slice(0, tailStart),
    [messages, tailStart],
  );
  const items = useMemo<StaticItem[]>(
    () => (frozenHeader === undefined ? prefix : [HEADER_SENTINEL, ...prefix]),
    [frozenHeader, prefix],
  );
  const tail = messages.slice(tailStart);

  return (
    <>
      {items.length > 0 && (
        <Static items={items}>
          {(item) =>
            item === HEADER_SENTINEL ? (
              <Box key={HEADER_SENTINEL_KEY} flexDirection="column">
                {frozenHeader}
              </Box>
            ) : (
              <Row key={item.id} message={item} />
            )
          }
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
