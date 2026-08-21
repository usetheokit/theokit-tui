import { Box, Text } from "ink";
import type { ReactNode } from "react";

import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import type { FooterAffordances } from "../shortcuts/composer-capabilities.js";
import { footerHintFor } from "../shortcuts/composer-capabilities.js";
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
  /**
   * U-8 — the mode row's text, for a product whose permission vocabulary is not this one.
   *
   * `ModeIndicator` already accepts a `label` for exactly this, and deliberately keeps `mode` a
   * CLOSED union so a misspelling is still caught. What was missing is that the composed footer
   * never forwarded it: the escape hatch sat one level down and out of reach, so a consumer using
   * `StatusFooter` with a Codex-style vocabulary (`suggest | auto-edit | full-auto`) had to stuff
   * its mode into `left` and lose the row — which is what the measured consumer does.
   *
   * Forwarding, not widening. Widening `mode` would let `plna` render as a mode; requiring the
   * caller to SAY it is outside the vocabulary keeps the typo an error and makes the exit explicit.
   * Takes precedence over `mode` when both are passed, matching `ModeIndicator`.
   */
  modeLabel?: string;
  /** The bottom hint shown when no mode is active. Default `? for shortcuts · ← for agents`. */
  hint?: string;
  /**
   * B-005 — which affordances THIS app actually has, governing BOTH rows.
   *
   * The `hint` prop above reaches only the row drawn when no mode is active. The mode row used to
   * append `· ← for agents` with no prop consulted at all, so an app with a permission mode and no
   * agents panel advertised one and could not stop it — a prop that works in one branch of two is
   * worse than no prop, because the caller believes they suppressed it.
   *
   * Absent leaves both rows exactly as before. Present, it wins over `hint` — and an EMPTY
   * declaration is a declaration: it renders nothing, rather than falling back to a default that
   * means "say everything the toolkit can do" (ADR D4).
   */
  affordances?: FooterAffordances;
}

export function StatusFooter({
  left,
  right,
  mode = "default",
  modeLabel,
  hint = DEFAULT_HINT,
  affordances,
  ...margin
}: StatusFooterProps) {
  const showsMode = modeLabel !== undefined || mode !== "default";
  // `=== undefined`, never falsiness: `footerHintFor({})` returns `""`, and `||` would restore the
  // full default — this item's own defect, re-created by the fix for it (ADR D4).
  const resolvedHint = affordances === undefined ? hint : footerHintFor(affordances);
  const showsAgents = affordances === undefined || affordances.agents === true;
  return (
    // width 100% so the top row can space-between to the terminal edges.
    <Box flexDirection="column" width="100%" {...pickMargin(margin)}>
      <Box justifyContent="space-between">
        <Box>{left}</Box>
        <Box>{right}</Box>
      </Box>
      {showsMode ? (
        <Box>
          {/* `mode` is forwarded even alongside `modeLabel` so its closed-union check still
              runs — a caller that passes both a label and a typo'd mode hears about the typo. */}
          <ModeIndicator mode={mode} {...(modeLabel === undefined ? {} : { label: modeLabel })} />
          {/* The separator belongs to the affordance, not to the row: blanking only the text
              would leave `⏵⏵ auto-accept edits on · `, a trailing middot that reads as a
              truncated line rather than a deliberate absence (ADR D5). */}
          {showsAgents ? <Text dimColor> · {AGENTS_HINT}</Text> : null}
        </Box>
      ) : (
        <Text dimColor wrap="truncate-end">
          {resolvedHint}
        </Text>
      )}
    </Box>
  );
}
