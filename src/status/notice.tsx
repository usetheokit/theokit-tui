import { Box, Text } from "ink";
import type { ReactNode } from "react";

import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";
import { unionMessage } from "../agent/union-message.js";
import { reportGuardFailure } from "../status/guard-sink.js";

// #3 Notice — a persistent inline banner (distinct from the transient Toast):
//   !! Both apiKeyHelper and ANTHROPIC_API_KEY set · auth may not work   (warning)
//   │ Opus 4.8 is now available! · /model to switch                       (info)
// A leading marker carries the variant; the message and marker share the
// variant color. Under a monochrome theme the marker is the color-independent
// channel (`!!` / `│` / `✓` / `✗`), so the notice stays legible (degrade-as-data).

/** The notice variants, in severity order. */
export const NOTICE_VARIANTS = ["info", "warning", "success", "error"] as const;
export type NoticeVariant = (typeof NOTICE_VARIANTS)[number];

const VARIANT_UNION_MESSAGE = unionMessage(NOTICE_VARIANTS);

/** Marker glyph per variant. `info` is a left accent bar; the rest are markers. */
const MARKER: Record<NoticeVariant, string> = {
  info: "│",
  warning: "!!",
  success: "✓",
  error: "✗",
};

/** Ink color per variant; `info` follows the theme accent. */
function variantColor(variant: NoticeVariant, accent: string): string {
  switch (variant) {
    case "warning":
      return "yellow";
    case "error":
      return "red";
    case "success":
      return "green";
    case "info":
      return accent;
  }
}

export interface NoticeProps extends LayoutMarginProps {
  /** Severity — selects the marker + color. Default `info`. */
  variant?: NoticeVariant;
  /** The notice message. */
  children: ReactNode;
}

export function Notice({ variant = "info", children, ...margin }: NoticeProps) {
  // Boundary validation FIRST (F10 idiom).
  if (!NOTICE_VARIANTS.includes(variant)) {
    reportGuardFailure(
      "Notice",
      new TypeError(
        `Notice: invalid variant "${String(variant)}" — expected ${VARIANT_UNION_MESSAGE}`,
      ),
    );
  }
  const theme = useTheoTheme();
  const mono = isMonochrome(theme);
  const color = mono ? {} : { color: variantColor(variant, theme.accent) };
  return (
    <Box {...pickMargin(margin)}>
      <Box flexShrink={0}>
        <Text {...color}>{MARKER[variant]} </Text>
      </Box>
      <Text {...color} wrap="truncate-end">
        {children}
      </Text>
    </Box>
  );
}
