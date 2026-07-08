import { Box, Text } from "ink";
import { homedir } from "node:os";
import { Fragment } from "react";

import { formatTokens } from "./format.js";
import { useTheoTheme } from "./theme.js";

// M14 AppStatusBar (plan m14-status-bar, ADR D1): the persistent AI-native
// status line — model · cwd · tokens · state — gemini's FooterRow recipe
// reduced to four fixed slots (no config system, KISS). Separators are
// emitted between PRESENT slots only; the cwd slot shrinks first
// (truncate-start keeps the informative path TAIL); state never shrinks.

export interface AppStatusBarTokens {
  /** Tokens consumed so far (finite, >= 0). */
  used: number;
  /** Context-window limit (finite, > 0). */
  limit: number;
}

export interface AppStatusBarProps {
  /** Model identifier (rendered accent). */
  model?: string;
  /** Working directory — home prefix tildeified, truncate-start. */
  cwd?: string;
  /** Token usage rendered compacted as `used/limit` (formatTokens). */
  tokens?: AppStatusBarTokens;
  /** Free-text turn state (idle/streaming/error…) — never truncated. */
  state?: string;
}

function assertTokens(tokens: AppStatusBarTokens): void {
  if (
    !Number.isFinite(tokens.used) ||
    tokens.used < 0 ||
    !Number.isFinite(tokens.limit) ||
    tokens.limit <= 0
  ) {
    throw new TypeError(
      `AppStatusBar: \`tokens\` must have finite used >= 0 and limit > 0 — got used=${String(tokens.used)} limit=${String(tokens.limit)}`,
    );
  }
}

/** Home-prefix tildeify (gemini tildeifyPath reduced — stdlib only). */
function tildeify(cwd: string): string {
  const home = homedir();
  return cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
}

interface Slot {
  key: string;
  node: React.ReactNode;
  /** cwd shrinks first; everything else keeps its width (EC-3). */
  shrinks: boolean;
}

/**
 * One-line status bar: model · cwd · tokens · state. Absent slots are
 * omitted WITH their separators (never a dangling `·`). Colors come from
 * theme tokens — monochrome themes drop color, keep the dim separator.
 */
export function AppStatusBar(props: AppStatusBarProps) {
  // Boundary validation before hooks (house F10 idiom).
  if (props.tokens !== undefined) {
    assertTokens(props.tokens);
  }
  const theme = useTheoTheme();
  const slots: Slot[] = [];
  if (props.model !== undefined) {
    slots.push({
      key: "model",
      node: <Text color={theme.accent}>{props.model}</Text>,
      shrinks: false,
    });
  }
  if (props.cwd !== undefined) {
    slots.push({
      key: "cwd",
      node: <Text wrap="truncate-start">{tildeify(props.cwd)}</Text>,
      shrinks: true,
    });
  }
  if (props.tokens !== undefined) {
    slots.push({
      key: "tokens",
      node: (
        <Text dimColor>
          {formatTokens(props.tokens.used)}/{formatTokens(props.tokens.limit)}
        </Text>
      ),
      shrinks: false,
    });
  }
  if (props.state !== undefined) {
    slots.push({
      key: "state",
      node: <Text>{props.state}</Text>,
      shrinks: false,
    });
  }
  if (slots.length === 0) {
    return null;
  }
  return (
    <Box flexWrap="nowrap">
      {slots.map((slot, index) => (
        <Fragment key={slot.key}>
          {index > 0 && <Text dimColor> · </Text>}
          <Box flexShrink={slot.shrinks ? 1 : 0}>{slot.node}</Box>
        </Fragment>
      ))}
    </Box>
  );
}
