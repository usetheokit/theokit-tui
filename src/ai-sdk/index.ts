/**
 * `@theokit/tui/ai-sdk` — BACK-COMPAT shim. The projection logic now lives ai-free in
 * `../messages-to-events.js` (exported from the main `@theokit/tui` entry as `messagesToAgentEvents` /
 * `messagesToChatThread`). This subpath keeps the original `ai`-typed `uiMessages*` names working for
 * existing consumers; the ai SDK's `UIMessage` is structurally assignable to the core's `UIMessageLike`,
 * so these are one-line delegations. New code should import the ai-free functions from `@theokit/tui`.
 *
 * `ai` is a TYPE-ONLY import (erased at build) and an OPTIONAL peer — only this subpath references it.
 */
import type { UIMessage } from "ai";

import type { AgentEvent } from "../agent-event.js";
import type { ChatThreadMessage } from "../chat-thread.js";
import {
  messagesToAgentEvents,
  messagesToChatThread,
} from "../messages-to-events.js";

/** @deprecated Import `messagesToChatThread` from `@theokit/tui` (ai-free). */
export function uiMessagesToChatThread(
  messages: readonly UIMessage[],
): ChatThreadMessage[] {
  return messagesToChatThread(messages);
}

/** @deprecated Import `messagesToAgentEvents` from `@theokit/tui` (ai-free). */
export function uiMessagesToAgentEvents(
  messages: readonly UIMessage[],
): AgentEvent[] {
  return messagesToAgentEvents(messages);
}
