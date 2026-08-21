import { Box, Text } from "ink";
import { unionMessage } from "../agent/union-message.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { reportGuardFailure } from "../status/guard-sink.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";

// #2 ModeIndicator — the Claude Code permission-mode footer line:
//   ⏵⏵ auto-accept edits on (shift+tab to cycle)
//   ⏸ plan mode on (shift+tab to cycle)
// `default` renders nothing (no indicator). Callback-only / display: the app
// owns the mode state and the shift+tab cycling; this only draws the line. The
// glyph (`⏵⏵` / `⏸`) carries the mode under a monochrome theme (degrade-as-data).

/** The permission modes, in cycle order (default → auto-accept → plan). */
export const PERMISSION_MODES = ["default", "auto-accept", "plan"] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

const MODE_UNION_MESSAGE = unionMessage(PERMISSION_MODES);

const MODE_LABEL: Record<Exclude<PermissionMode, "default">, string> = {
  "auto-accept": "⏵⏵ auto-accept edits on",
  plan: "⏸ plan mode on",
};

export interface ModeIndicatorProps extends LayoutMarginProps {
  /** The active permission mode. `default` renders nothing. Omit when passing `label`. */
  mode?: PermissionMode;
  /**
   * U-8 — the row's text, for a product whose permission vocabulary is not this one.
   *
   * `PermissionMode` is the Claude Code idiom (`default | auto-accept | plan`). A Codex-style agent
   * has a different one (`suggest | auto-edit | full-auto`), so the boundary check refused its modes
   * — correct for a typo, wrong for a different vocabulary, and there was no way to tell the two
   * apart. The consumer's options were to map its modes onto labels that mean something else, or to
   * rebuild the row.
   *
   * The union stays closed for `mode`, so a typo is still caught: a caller has to SAY it is outside
   * the vocabulary rather than slip out of it. Styling and the cycle hint belong to the row, not to
   * the vocabulary, so both are kept.
   */
  label?: string;
}

export function ModeIndicator({ mode, label, ...margin }: ModeIndicatorProps) {
  // Boundary validation FIRST (F10 idiom) — before any hook, so JS callers get
  // the typed contract, not a crash. `label` opts out of the vocabulary, not out of the check:
  // a `mode` that is present must still be one of the union.
  if (mode !== undefined && !PERMISSION_MODES.includes(mode)) {
    reportGuardFailure(
      "ModeIndicator",
      new TypeError(
        `ModeIndicator: invalid mode "${String(mode)}" — expected ${MODE_UNION_MESSAGE}`,
      ),
    );
  }
  if (mode === undefined && label === undefined) {
    reportGuardFailure(
      "ModeIndicator",
      new TypeError("ModeIndicator: pass either `mode` or `label`"),
    );
  }
  const theme = useTheoTheme();
  const mono = isMonochrome(theme);
  const text =
    label ?? (mode === "default" ? undefined : MODE_LABEL[mode as "auto-accept" | "plan"]);
  if (text === undefined) {
    return null;
  }
  return (
    <Box {...pickMargin(margin)}>
      <Text {...(mono ? {} : { color: theme.accent })}>{text}</Text>
      <Text dimColor> (shift+tab to cycle)</Text>
    </Box>
  );
}
