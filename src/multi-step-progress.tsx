import { Box, Text } from "ink";

import { TodoList, type TodoItem } from "./todo-list.js";

// M24 MultiStepProgress (plan m24-live-progress-surfaces T2.1, ADR D2): a
// discrete n-of-m step list. A step IS a TodoList item with ordered semantics, so
// the rows REUSE `<TodoList>` verbatim (DRY — no second row impl); this component
// only adds the header. Without `current` the header counts done steps
// (`"{done} of {total}"`); with `current` it shows the step position
// (`"step {i} of {total}"`, clamped). A `groupLabel` renders the subagent-lane
// variant header (each step's `label` is a lane name).

export interface MultiStepProgressProps {
  steps: readonly TodoItem[];
  /** The active step index — renders a "step i of m" position counter (clamped). */
  current?: number;
  /** A subagent group header rendered above the lanes. */
  groupLabel?: string;
}

function counterLine(steps: readonly TodoItem[], current?: number): string {
  const total = steps.length;
  if (current !== undefined) {
    const clamped = total === 0 ? 0 : Math.min(Math.max(current, 0), total - 1);
    return `step ${total === 0 ? 0 : clamped + 1} of ${total}`;
  }
  const done = steps.filter((s) => s.status === "done").length;
  return `${done} of ${total}`;
}

export function MultiStepProgress({
  steps,
  current,
  groupLabel,
}: MultiStepProgressProps) {
  return (
    <Box flexDirection="column">
      {groupLabel !== undefined ? <Text bold>{groupLabel}</Text> : null}
      <Text dimColor>{counterLine(steps, current)}</Text>
      <TodoList items={steps} />
    </Box>
  );
}
