import { Box, Text } from "ink";
import type { ReactNode } from "react";

import { useTheoTheme } from "./theme.js";

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
}

/**
 * One chat message with a role glyph prefix (gemini-cli idiom) colored via
 * the theme tokens (plan ADR D4 — explicit role prop, no runtime context).
 */
export function ChatMessage({ role, children }: ChatMessageProps) {
  // Boundary validation (EC-1, rules/error-handling.md § 2): fail fast with a
  // typed error BEFORE any hook — JS consumers get the contract, not a crash.
  if (!CHAT_ROLES.includes(role)) {
    throw new TypeError(
      `ChatMessage: invalid role "${String(role)}" — expected "user" | "assistant" | "system"`,
    );
  }
  const tokens = useTheoTheme().role[role];
  // `text` may be undefined (= terminal default color). Ink's `color` prop
  // forbids an explicit `undefined` under exactOptionalPropertyTypes — omit
  // the prop entirely instead (SEPA iteration-4 finding 1).
  const textColor = tokens.text !== undefined ? { color: tokens.text } : {};
  return (
    <Box>
      <Text color={tokens.prefix}>{tokens.glyph}</Text>
      <Text {...textColor}>{children}</Text>
    </Box>
  );
}
