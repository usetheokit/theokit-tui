import { Box, Text } from "ink";
import { homedir } from "node:os";
import { Fragment } from "react";

import { formatCost, formatTokens } from "./format.js";
import type { LayoutMarginProps } from "./layout-props.js";
import { pickMargin } from "./layout-props.js";
import { useTheoTheme } from "./theme.js";

// M14 AppStatusBar (plan m14-status-bar, ADR D1): the persistent AI-native
// status line — model · cwd · tokens · cost · state — gemini's FooterRow recipe
// reduced to fixed slots (no config system, KISS). Separators are
// emitted between PRESENT slots only; the cwd slot shrinks first
// (truncate-start keeps the informative path TAIL); cost/state never shrink.

export interface AppStatusBarTokens {
  /** Tokens consumed so far (finite, >= 0). */
  used: number;
  /** Context-window limit (finite, > 0). */
  limit: number;
}

export interface AppStatusBarProps extends LayoutMarginProps {
  /** Model identifier (rendered accent). */
  model?: string;
  /** Working directory — home prefix tildeified, truncate-start. */
  cwd?: string;
  // `| undefined` on the two conditionally-supplied slots so a consumer under
  // `exactOptionalPropertyTypes` can pass the natural React `cond ? value : undefined`
  // without a conditional-spread dance (the App footer wires both this way).
  /** Token usage rendered compacted as `used/limit` (formatTokens). */
  tokens?: AppStatusBarTokens | undefined;
  /** Session/turn cost in USD, rendered `cost ~$X` (formatCost). Omitted when undefined. */
  cost?: number | undefined;
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

/** Home-prefix tildeify (gemini tildeifyPath reduced — stdlib only).
 * Boundary-aware: `/home/user-backup` is a SIBLING, not inside home. */
function tildeify(cwd: string): string {
  const home = homedir();
  if (cwd === home) {
    return "~";
  }
  return cwd.startsWith(`${home}/`) ? `~${cwd.slice(home.length)}` : cwd;
}

interface Slot {
  key: string;
  node: React.ReactNode;
  /** cwd shrinks first; everything else keeps its width (EC-3). */
  shrinks: boolean;
}

/**
 * One-line status bar: model · cwd · tokens · state. Absent slots
 * (undefined OR empty string) are omitted WITH their separators (never a
 * dangling `·`). Colors come from theme tokens — monochrome themes drop
 * color, keep the dim separator. Designed width floor ≈ 30 columns with
 * all slots (the cwd absorbs the squeeze; below the floor ink clips
 * visibly rather than lying). NOTE: the tokens TypeError fires at the
 * component boundary — under a live ink render the framework surfaces it
 * via waitUntilExit rather than the render call (review r2-F7).
 */
export function AppStatusBar(props: AppStatusBarProps) {
  // Boundary validation before hooks (house F10 idiom).
  if (props.tokens !== undefined) {
    assertTokens(props.tokens);
  }
  const theme = useTheoTheme();
  const m = pickMargin(props);
  // Empty strings are ABSENT (review r2-F5): a "" slot must not emit a
  // dangling separator — presence means non-empty content.
  const model = props.model === "" ? undefined : props.model;
  const cwd = props.cwd === "" ? undefined : props.cwd;
  const state = props.state === "" ? undefined : props.state;
  const slots: Slot[] = [];
  if (model !== undefined) {
    slots.push({
      key: "model",
      node: <Text color={theme.accent}>{model}</Text>,
      shrinks: false,
    });
  }
  if (cwd !== undefined) {
    slots.push({
      key: "cwd",
      node: <Text wrap="truncate-start">{tildeify(cwd)}</Text>,
      shrinks: true,
    });
  }
  if (props.tokens !== undefined) {
    slots.push({
      key: "tokens",
      node: (
        // truncate-end keeps any clipping VISIBLE (`12.3k/12…`) — a
        // silently cut "12.3k/128" reads as a complete-but-wrong limit
        // (review r2-F3).
        <Text dimColor wrap="truncate-end">
          {formatTokens(props.tokens.used)}/{formatTokens(props.tokens.limit)}
        </Text>
      ),
      shrinks: false,
    });
  }
  if (props.cost !== undefined && Number.isFinite(props.cost) && props.cost >= 0) {
    slots.push({
      key: "cost",
      node: (
        <Text dimColor>
          cost {formatCost(props.cost, { approx: true })}
        </Text>
      ),
      shrinks: false,
    });
  }
  if (state !== undefined) {
    slots.push({
      key: "state",
      node: <Text>{state}</Text>,
      shrinks: false,
    });
  }
  if (slots.length === 0) {
    return null;
  }
  return (
    <Box flexWrap="nowrap" {...m}>
      {slots.map((slot, index) => (
        <Fragment key={slot.key}>
          {index > 0 && (
            // The separator never shrinks (review r2-F3 — it collapsed
            // before the cwd slot did).
            <Box flexShrink={0}>
              <Text dimColor> · </Text>
            </Box>
          )}
          <Box flexShrink={slot.shrinks ? 1 : 0}>{slot.node}</Box>
        </Fragment>
      ))}
    </Box>
  );
}
