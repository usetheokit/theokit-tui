import { Box, Text } from "ink";
import { useEffect, useReducer } from "react";

import { useFocus } from "./renderer/hooks/use-focus.js";
import { useInput } from "./renderer/input/use-input.js";
import { useStdout } from "./renderer/hooks/use-stdout.js";
import {
  pagerReducer,
  scrollPercent,
  visibleRange,
  type PagerAction,
} from "./pager-model.js";

// M22 Pager (plan m22-interaction-primitives T3.1, ADR C1/C2/C3): a full-screen
// scrollable viewport over pre-wrapped `content`. Reads the terminal height from
// OUR `useStdout` (reserving one row for the status line), scrolls via the pure
// `pager-model`, and binds the canonical less/vim keymap (↑/k, ↓/j, b/f page,
// C-u/C-d half-page, g/G top/bottom, q close). Consumes OUR M19/M20 hooks; meant
// to be pushed as an overlay (Esc-dismiss is the overlay's — see use-overlay).

export interface PagerProps {
  /** Pre-wrapped content (the app wraps; the pager does not — ADR C2). */
  content: string;
  /** Called on `q` (the overlay owns Esc). */
  onClose: () => void;
  autoFocus?: boolean;
}

interface PagerKey {
  upArrow: boolean;
  downArrow: boolean;
  pageUp: boolean;
  pageDown: boolean;
  ctrl: boolean;
}

const CHAR_ACTIONS: Record<string, PagerAction> = {
  k: { type: "line-up" },
  j: { type: "line-down" },
  b: { type: "page-up" },
  f: { type: "page-down" },
  " ": { type: "page-down" },
  g: { type: "goto-top" },
  G: { type: "goto-bottom" },
};

/** Resolve a keypress to a scroll action, `"close"`, or nothing (pure). */
function resolvePagerKey(
  input: string,
  key: PagerKey,
): PagerAction | "close" | undefined {
  if (key.upArrow) return { type: "line-up" };
  if (key.downArrow) return { type: "line-down" };
  if (key.pageUp) return { type: "page-up" };
  if (key.pageDown) return { type: "page-down" };
  if (key.ctrl && input === "u") return { type: "half-up" };
  if (key.ctrl && input === "d") return { type: "half-down" };
  if (input === "q") return "close";
  return CHAR_ACTIONS[input];
}

export function Pager({ content, onClose, autoFocus = true }: PagerProps) {
  const { isFocused } = useFocus({ autoFocus });
  const { stdout } = useStdout();
  const lines = content.split("\n");
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 1);
  const [state, dispatch] = useReducer(pagerReducer, {
    offset: 0,
    viewportHeight,
    totalLines: lines.length,
  });

  // Keep the model's viewport/total in sync with the terminal + content (resize
  // re-clamps a now-out-of-range offset — the failure scenario).
  useEffect(() => {
    dispatch({ type: "resize", viewportHeight, totalLines: lines.length });
  }, [viewportHeight, lines.length]);

  useInput(
    (input, key) => {
      const action = resolvePagerKey(input, key as unknown as PagerKey);
      if (action === "close") {
        onClose();
      } else if (action) {
        dispatch(action);
      }
    },
    { isActive: isFocused },
  );

  const [start, end] = visibleRange(state);
  const visible = lines.slice(start, end);
  const bottom = Math.min(end, lines.length);
  const percent = Math.round(scrollPercent(state) * 100);
  // Clip the status to ONE row: a wrapped status would consume rows the layout
  // reserved for content, pushing content off the top (review M1).
  const columns = stdout?.columns ?? 80;
  const status =
    `line ${start + 1}–${bottom} of ${lines.length} · ${percent}% · q to close`.slice(
      0,
      Math.max(1, columns),
    );

  return (
    <Box flexDirection="column">
      {visible.map((line, index) => (
        <Text key={start + index}>{line || " "}</Text>
      ))}
      <Text dimColor>{status}</Text>
    </Box>
  );
}
