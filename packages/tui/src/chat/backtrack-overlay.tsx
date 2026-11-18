import { Box, Text } from "ink";
import type { ReactElement } from "react";

import { WindowedList } from "../prompts/windowed-list.js";

export interface BacktrackOverlayProps {
  previews: readonly string[];
  /** Index into previews, oldest first; -1 = none selected. */
  selected: number;
  /** Visible rows (default 7). */
  maxRows?: number;
  /** Header line. Default `message {selected}/{total}`. */
  header?: string;
  /** Hint line. Default `Enter to edit · Esc for older`. */
  hint?: string;
}

/** One-line previews, numbered, in a windowed list. Renders nothing for an empty list. */
export function BacktrackOverlay({
  previews,
  selected,
  maxRows,
  header,
  hint = "Enter to edit · Esc for older",
}: BacktrackOverlayProps): ReactElement | null {
  if (previews.length === 0) return null;
  const position = selected < 0 ? 0 : Math.min(selected, previews.length - 1) + 1;
  const title = header ?? `message ${String(position)}/${String(previews.length)}`;
  const rows = previews.map((p, i) => `${String(i + 1)}. ${p.replace(/\s+/g, " ").trim()}`);
  return (
    <Box borderStyle="round" flexDirection="column" paddingX={1}>
      <WindowedList
        rows={rows}
        selected={selected}
        {...(maxRows === undefined ? {} : { window: maxRows })}
        header={
          <Text bold>
            {title} <Text dimColor>{hint}</Text>
          </Text>
        }
      />
    </Box>
  );
}
