import { Box, Text, useStdout } from "ink";
import type { ReactNode } from "react";

import type { LayoutMarginProps } from "./layout-props.js";
import { horizontalMargin } from "./layout-props.js";
import { MarkdownText } from "./markdown-text.js";
import { useTheoTheme } from "./theme.js";
import { unionMessage } from "./union-message.js";

// Single source for the role union (M3 D8 retrofit of the M2 VALID_STATUSES
// idiom): the type, ChatMessage's guard and AgentTimeline's boundary check
// all derive from this array.
export const CHAT_ROLES = ["user", "assistant", "system"] as const;

/** Message author roles supported by the chat surface (M1: three roles). */
export type ChatRole = (typeof CHAT_ROLES)[number];

export interface ChatMessageProps extends LayoutMarginProps {
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
export function ChatMessage({
  role,
  children,
  markdown,
  ...margin
}: ChatMessageProps) {
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
  // Constrain the row to the terminal width so `MarkdownText`/raw text word-wraps WITHIN it. Without this,
  // the row (rendered inside AgentTimeline's `<Static>`) sizes to content, so `wrap="wrap"` has content-
  // width room and never engages — a long paragraph overflows and the terminal hard-wraps it MID-WORD.
  // Fallback 80 for a non-TTY / piped stdout (Ink re-renders on resize, so this follows the terminal).
  const { stdout } = useStdout();
  // The margin box is spread onto this SAME Box, so it is ADDED to the pinned
  // width — subtract it or a `marginLeft` row renders `columns + margin` wide
  // and the terminal hard-wraps it mid-word again (issue #56). Floor at 1: a
  // margin wider than the terminal must still leave a renderable column.
  const rowWidth = Math.max(
    1,
    (stdout?.columns ?? 80) - horizontalMargin(margin),
  );
  // `text` may be undefined (= terminal default color). Ink's `color` prop
  // forbids an explicit `undefined` under exactOptionalPropertyTypes — omit
  // the prop entirely instead (SEPA iteration-4 finding 1).
  const textColor = tokens.text !== undefined ? { color: tokens.text } : {};
  // M27.1 Claude Code parity: the user turn is the input echo — render it dim so
  // the assistant reply (normal weight) reads as the prominent output. The
  // attribute stays component-level, never a token (the tool-call `failed`-bold
  // precedent: attributes are the channel that survives color loss).
  const dim = role === "user" ? { dimColor: true } : {};
  if (markdown === true) {
    // Markdown is multi-block: the content slot becomes a column next to
    // the glyph. The default (raw) path below is BYTE-IDENTICAL to pre-M13.
    return (
      <Box {...margin} width={rowWidth}>
        <Text color={tokens.prefix}>{tokens.glyph}</Text>
        <Box flexDirection="column" flexGrow={1}>
          <MarkdownText text={children as string} />
        </Box>
      </Box>
    );
  }
  return (
    <Box {...margin} width={rowWidth}>
      <Text color={tokens.prefix}>{tokens.glyph}</Text>
      <Text {...textColor} {...dim} wrap="wrap">
        {children}
      </Text>
    </Box>
  );
}
