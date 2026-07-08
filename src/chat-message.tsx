import { Box, Text } from "ink";
import type { ReactNode } from "react";

import { MarkdownText } from "./markdown-text.js";
import { useTheoTheme } from "./theme.js";
import { unionMessage } from "./union-message.js";

// Single source for the role union (M3 D8 retrofit of the M2 VALID_STATUSES
// idiom): the type, ChatMessage's guard and AgentTimeline's boundary check
// all derive from this array.
export const CHAT_ROLES = ["user", "assistant", "system"] as const;

/** Message author roles supported by the chat surface (M1: three roles). */
export type ChatRole = (typeof CHAT_ROLES)[number];

export interface ChatMessageProps {
  /** Message author — selects the glyph prefix and role colors. */
  role: ChatRole;
  /** Message content (text-only at M0). */
  children: ReactNode;
  /** M13 opt-in: render string children as Markdown (AI-chat subset via
   * MarkdownText; fences → CodeBlock). Default false — raw text stays the
   * default and every pre-M13 call site is byte-identical. Requires string
   * children (TypeError otherwise — markdown needs source text). */
  markdown?: boolean;
}

/**
 * One chat message with a role glyph prefix (gemini-cli idiom) colored via
 * the theme tokens (plan ADR D4 — explicit role prop, no runtime context).
 */
export function ChatMessage({ role, children, markdown }: ChatMessageProps) {
  // Boundary validation (EC-1, rules/error-handling.md § 2): fail fast with a
  // typed error BEFORE any hook — JS consumers get the contract, not a crash.
  if (!CHAT_ROLES.includes(role)) {
    throw new TypeError(
      `ChatMessage: invalid role "${String(role)}" — expected ${unionMessage(CHAT_ROLES)}`,
    );
  }
  if (markdown === true && typeof children !== "string") {
    throw new TypeError(
      "ChatMessage: `markdown` requires string children — got " +
        typeof children,
    );
  }
  const tokens = useTheoTheme().role[role];
  // `text` may be undefined (= terminal default color). Ink's `color` prop
  // forbids an explicit `undefined` under exactOptionalPropertyTypes — omit
  // the prop entirely instead (SEPA iteration-4 finding 1).
  const textColor = tokens.text !== undefined ? { color: tokens.text } : {};
  if (markdown === true) {
    // Markdown is multi-block: the content slot becomes a column next to
    // the glyph. The default (raw) path below is BYTE-IDENTICAL to pre-M13.
    return (
      <Box>
        <Text color={tokens.prefix}>{tokens.glyph}</Text>
        <Box flexDirection="column" flexGrow={1}>
          <MarkdownText text={children as string} />
        </Box>
      </Box>
    );
  }
  return (
    <Box>
      <Text color={tokens.prefix}>{tokens.glyph}</Text>
      <Text {...textColor}>{children}</Text>
    </Box>
  );
}
