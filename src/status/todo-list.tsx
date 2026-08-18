import { Box, Text } from "ink";
import { memo } from "react";

import type { LayoutMarginProps } from "../layout/layout-props.js";
import { isMonochrome, useTheoTheme, type TheoTheme } from "../theme/theme.js";

// M24 TodoList (plan m24-live-progress-surfaces T1.2, ADR D1): a live checklist
// keyed by stable id. An item updates IN PLACE when the caller passes a NEW
// object with the same id (rows are `memo`ed by object identity + `key={id}` —
// the M8 ChatThread precedent); duplicate ids throw at the boundary. Unlike
// ChatThread/AgentTimeline it NEVER graduates to `<Static>` — it is fully live
// (a done item may revert to active). The status glyph carries the meaning
// (☐/◐/☑ are glyph-distinct), so the surface survives a monochrome theme where
// there is no color to differentiate pending from active (M6 degrade-as-data).

export type TodoStatus = "pending" | "active" | "done";

export interface TodoItem {
  /** Stable identity — the replace-item key. */
  id: string;
  label: string;
  status: TodoStatus;
}

export interface TodoListProps extends LayoutMarginProps {
  items: readonly TodoItem[];
  /** Blank rows between items (issue #50). Default 0 — the tight Claude Code look. */
  gap?: number;
}

const STATUS_GLYPH: Record<TodoStatus, string> = {
  pending: "☐",
  active: "◐",
  done: "☑",
};

/** The status color (accent for the live item; dim otherwise). Monochrome-safe:
 * the glyph, not the color, is the signal. */
function statusColor(status: TodoStatus, theme: TheoTheme): string | undefined {
  if (isMonochrome(theme)) return undefined;
  if (status === "active") return theme.accent;
  return undefined;
}

/** Row text emphasis by status (M26.1 Claude Code parity): a done item is dim +
 * struck through (the signature completed-todo look); the active item is bold;
 * pending is plain. The status GLYPH still carries the meaning under monochrome
 * (M6 degrade-as-data) — these attributes only reinforce it. Exported for tests. */
export function todoRowStyle(status: TodoStatus): {
  dimColor?: boolean;
  strikethrough?: boolean;
  bold?: boolean;
} {
  if (status === "done") return { dimColor: true, strikethrough: true };
  if (status === "active") return { bold: true };
  return {};
}

const Row = memo(
  ({ item, theme }: { item: TodoItem; theme: TheoTheme }) => {
    const color = statusColor(item.status, theme);
    return (
      <Text {...todoRowStyle(item.status)}>
        <Text {...(color ? { color } : {})}>{STATUS_GLYPH[item.status]}</Text>{" "}
        {item.label}
      </Text>
    );
  },
  (prev, next) => prev.item === next.item && prev.theme === next.theme,
);
Row.displayName = "TodoList.Row";

function assertUniqueIds(items: readonly TodoItem[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      // Duplicate keys corrupt row identity / in-place update — fail fast at the
      // boundary (the ChatThread precedent, rules/error-handling.md § 2).
      throw new TypeError(`TodoList: duplicate item id "${item.id}"`);
    }
    seen.add(item.id);
  }
}

export function TodoList({ items, gap = 0, ...margin }: TodoListProps) {
  assertUniqueIds(items);
  const theme = useTheoTheme();
  return (
    <Box flexDirection="column" gap={gap} {...margin}>
      {items.map((item) => (
        <Row key={item.id} item={item} theme={theme} />
      ))}
    </Box>
  );
}
