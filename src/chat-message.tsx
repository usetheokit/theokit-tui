import { Box, Text } from "ink";
import type { ReactNode } from "react";

import { useTheoTheme } from "./theme.js";

export interface ChatMessageProps {
  /** Message author — selects the glyph prefix and role colors. */
  role: "user" | "assistant";
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
  if (role !== "user" && role !== "assistant") {
    throw new TypeError(
      `ChatMessage: invalid role "${String(role)}" — expected "user" | "assistant"`,
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
