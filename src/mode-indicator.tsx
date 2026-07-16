import { Box, Text } from "ink";

import type { LayoutMarginProps } from "./layout-props.js";
import { pickMargin } from "./layout-props.js";
import { isMonochrome, useTheoTheme } from "./theme.js";
import { unionMessage } from "./union-message.js";

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
  /** The active permission mode. `default` renders nothing. */
  mode: PermissionMode;
}

export function ModeIndicator({ mode, ...margin }: ModeIndicatorProps) {
  // Boundary validation FIRST (F10 idiom) — before any hook, so JS callers get
  // the typed contract, not a crash.
  if (!PERMISSION_MODES.includes(mode)) {
    throw new TypeError(
      `ModeIndicator: invalid mode "${String(mode)}" — expected ${MODE_UNION_MESSAGE}`,
    );
  }
  const theme = useTheoTheme();
  const mono = isMonochrome(theme);
  if (mode === "default") {
    return null;
  }
  return (
    <Box {...pickMargin(margin)}>
      <Text {...(mono ? {} : { color: theme.accent })}>{MODE_LABEL[mode]}</Text>
      <Text dimColor> (shift+tab to cycle)</Text>
    </Box>
  );
}
