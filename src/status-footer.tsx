import { Box, Text } from "ink";
import type { ReactNode } from "react";

import type { LayoutMarginProps } from "./layout-props.js";
import { pickMargin } from "./layout-props.js";
import { ModeIndicator, type PermissionMode } from "./mode-indicator.js";

// #45 StatusFooter — the two-line Claude Code footer that composes the status
// row and the mode/agents row:
//
//   main · plan                          42% context · fix the bug   (justified)
//   ⏵⏵ auto-accept edits on (shift+tab to cycle) · ← for agents      (mode row)
//
// Both rows are display-only slots (the app owns the content + the mode state).
// The top row space-betweens `left` and `right`; the bottom row shows the
// permission mode (when not `default`) followed by the agents hint, or the
// shortcuts hint when there is no active mode.

const AGENTS_HINT = "← for agents";
const DEFAULT_HINT = `? for shortcuts · ${AGENTS_HINT}`;

export interface StatusFooterProps extends LayoutMarginProps {
  /** Top-left slot — e.g. the branch / plan (`main · plan`). */
  left?: ReactNode;
  /** Top-right slot — e.g. `42% context · fix the bug`. */
  right?: ReactNode;
  /** Permission mode for the bottom row. `default` (or absent) shows no mode. */
  mode?: PermissionMode;
  /** The bottom hint shown when no mode is active. Default `? for shortcuts · ← for agents`. */
  hint?: string;
}

export function StatusFooter({
  left,
  right,
  mode = "default",
  hint = DEFAULT_HINT,
  ...margin
}: StatusFooterProps) {
  return (
    // width 100% so the top row can space-between to the terminal edges.
    <Box flexDirection="column" width="100%" {...pickMargin(margin)}>
      <Box justifyContent="space-between">
        <Box>{left}</Box>
        <Box>{right}</Box>
      </Box>
      {mode !== "default" ? (
        <Box>
          <ModeIndicator mode={mode} />
          <Text dimColor> · {AGENTS_HINT}</Text>
        </Box>
      ) : (
        <Text dimColor wrap="truncate-end">
          {hint}
        </Text>
      )}
    </Box>
  );
}
