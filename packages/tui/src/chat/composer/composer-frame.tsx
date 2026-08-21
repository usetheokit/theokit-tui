import { Box } from "ink";
import type { ReactNode } from "react";

/** Wraps the input line in a rounded box when `bordered` (Claude Code look);
 * degrades to a `single` border with no accent under a monochrome theme. */
export function ComposerFrame({
  bordered,
  monochrome,
  accent,
  children,
}: {
  bordered: boolean;
  monochrome: boolean;
  accent: string;
  children: ReactNode;
}) {
  if (!bordered) {
    return <>{children}</>;
  }
  return (
    <Box
      borderStyle={monochrome ? "single" : "round"}
      paddingX={1}
      {...(monochrome ? {} : { borderColor: accent })}
    >
      {children}
    </Box>
  );
}

/** The single input line (glyph + text/placeholder + cursor cell).
 * M6 D8: at chalk level 0 the inverse attribute is stripped — the cursor
 * vanishes. Under MONOCHROME themes (degrade as DATA) a visible marker
 * carries the affordance instead; colored-mode bytes unchanged. Known
 * scope (EC-1): TERM=dumb/bare-pipe with a COLORED theme keeps the
 * invisible inverse — NO_COLOR is the standard opt-out. */
