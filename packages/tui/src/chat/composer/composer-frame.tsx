import { Box } from "ink";
import type { ReactNode } from "react";

/** How the composer's input line is framed. */
export type ComposerVariant = "plain" | "border" | "rules";

/**
 * Frames the input line.
 *
 * - `plain` — nothing around it.
 * - `border` — a rounded box (the look `bordered` has always produced); degrades to `single` with
 *   no accent under a monochrome theme.
 * - `rules` — full-width horizontal rules above and below, no sides (#62 item 2). This is what
 *   Claude Code v2.1.218 draws, and it is a different shape rather than a degraded box: the input
 *   spans the terminal instead of sitting inside a frame.
 */
export function ComposerFrame({
  variant,
  monochrome,
  accent,
  children,
}: {
  variant: ComposerVariant;
  monochrome: boolean;
  accent: string;
  children: ReactNode;
}) {
  if (variant === "plain") {
    return <>{children}</>;
  }
  const color = monochrome ? {} : { borderColor: accent };
  if (variant === "rules") {
    return (
      // `borderLeft/Right={false}` is what makes them RULES rather than a frame. The WIDTH comes
      // from the parent: the composer's outer box is a column, and a column stretches its children
      // across the cross axis, so the rules already span it. An explicit `width="100%"` was written
      // here first and mutation-testing removed it without a single test noticing — in a column it
      // is redundant, and in a row (a parent that sizes to content) it does not help either.
      <Box borderStyle="single" borderLeft={false} borderRight={false} {...color}>
        {children}
      </Box>
    );
  }
  return (
    <Box borderStyle={monochrome ? "single" : "round"} paddingX={1} {...color}>
      {children}
    </Box>
  );
}
