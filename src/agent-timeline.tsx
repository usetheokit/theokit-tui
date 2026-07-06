import { Box, Static, Text } from "ink";
import { memo, useMemo } from "react";

import { AGENT_EVENT_KINDS, isAgentEventKind } from "./agent-event.js";
import type { AgentEvent } from "./agent-event.js";
import { CHAT_ROLES, ChatMessage } from "./chat-message.js";
import {
  STATUS_INDICATOR_WIDTH,
  TOOL_CALL_STATUSES,
  ToolCallCard,
} from "./tool-call.js";
import { ToolResult } from "./tool-result.js";
import { useTheoTheme } from "./theme.js";

const unionMessage = (values: readonly string[]): string =>
  values.map((v) => `"${v}"`).join(" | ");
const KIND_UNION_MESSAGE = unionMessage(AGENT_EVENT_KINDS);

export interface AgentTimelineProps {
  /**
   * Ordered agent events. ORDERING CONTRACT (plan ADR D2): caller-ordered
   * array; unique ids (duplicates throw); graduated events are IMMUTABLE —
   * replace the TAIL event with a new object to stream (rows are memoized by
   * object identity). Always pass a NEW array on update (in-place mutation of
   * the same reference has pinned-but-unsupported hybrid behavior — EC-8).
   */
  events: AgentEvent[];
  /**
   * Events beyond `windowSize + windowOverscan` graduate into Ink `<Static>`
   * (terminal scrollback) and are FROZEN. Mount-time tuning knobs: INCREASING
   * them after events have graduated pulls scrollback rows back into the live
   * tail, visibly duplicating history (M1 window-growth hazard — same wording
   * as ChatThread; D2 occurrence #2 of the windowing knowledge, Rule-of-3
   * extraction deferred until a third windowed surface exists).
   */
  windowSize?: number;
  windowOverscan?: number;
}

/**
 * Structural boundary check (plan ADR D8, EC-1/EC-2): kind membership, id
 * uniqueness, role/status membership, output⊕shell exclusivity and maxLines
 * validity — child-component guards would fire mid-render where Ink's error
 * boundary swallows throws (F10) and name the wrong component. Primitive
 * FIELD TYPES are TypeScript's job (not re-checked at runtime — SEPA F5
 * scope note). Extra/unknown properties are tolerated (EC-12).
 */
function assertValidEvents(events: AgentEvent[]): void {
  const seen = new Set<string>();
  for (const event of events) {
    if (!isAgentEventKind(event.kind)) {
      throw new TypeError(
        `AgentTimeline: unknown event kind "${String(event.kind)}" — expected ${KIND_UNION_MESSAGE}`,
      );
    }
    if (seen.has(event.id)) {
      throw new TypeError(`AgentTimeline: duplicate event id "${event.id}"`);
    }
    seen.add(event.id);
    if (event.kind === "message" && !CHAT_ROLES.includes(event.role)) {
      throw new TypeError(
        `AgentTimeline: message event "${event.id}" — invalid role "${String(event.role)}" — expected ${unionMessage(CHAT_ROLES)}`,
      );
    }
    if (event.kind === "tool") {
      if (!TOOL_CALL_STATUSES.includes(event.status)) {
        throw new TypeError(
          `AgentTimeline: tool event "${event.id}" — invalid status "${String(event.status)}" — expected ${unionMessage(TOOL_CALL_STATUSES)}`,
        );
      }
      if (event.output !== undefined && event.shell !== undefined) {
        throw new TypeError(
          `AgentTimeline: tool event "${event.id}" — provide only one of output | shell`,
        );
      }
      // SEPA F1: ToolResult's own maxLines guard would fire mid-render
      // (swallowed, wrong component name) — mirror it at THIS boundary.
      if (
        event.maxLines !== undefined &&
        (!Number.isInteger(event.maxLines) || event.maxLines < 1)
      ) {
        throw new TypeError(
          `AgentTimeline: tool event "${event.id}" — maxLines must be an integer >= 1 — got ${String(event.maxLines)}`,
        );
      }
    }
  }
}

// Column note (SEPA F6, accepted heritage): message rows use ChatMessage's
// 2-cell "✦ " prefix while thinking/tool rows use the 3-cell indicator —
// same mixed-prefix shape as the gemini timeline; aligning would change the
// M0/M1 public render. Revisit with the M6 theme system.
function ThinkingRow({ text }: { text: string }) {
  const theme = useTheoTheme();
  return (
    <Box>
      <Box minWidth={STATUS_INDICATOR_WIDTH}>
        <Text color={theme.role.system.prefix}>·</Text>
      </Box>
      <Text dimColor italic>
        {text}
      </Text>
    </Box>
  );
}

function ToolRow(event: Extract<AgentEvent, { kind: "tool" }>) {
  // SEPA F2: pass `output` as ToolResult CHILDREN (not pre-split lines) so
  // it inherits M2's normalization — CRLF strip (EC-6), trailing-blank pop
  // (EC-7). Empty output collapses to the bare row.
  const hasBody =
    (event.output !== undefined && event.output !== "") ||
    event.shell !== undefined;
  return (
    <ToolCallCard
      name={event.name}
      status={event.status}
      {...(event.summary !== undefined ? { summary: event.summary } : {})}
    >
      {hasBody && (
        <ToolResult
          {...(event.output !== undefined ? { children: event.output } : {})}
          {...(event.shell !== undefined ? { shell: event.shell } : {})}
          {...(event.maxLines !== undefined
            ? { maxLines: event.maxLines }
            : {})}
        />
      )}
    </ToolCallCard>
  );
}

function eventRow(event: AgentEvent) {
  switch (event.kind) {
    case "message":
      return <ChatMessage role={event.role}>{event.text}</ChatMessage>;
    case "thinking":
      return <ThinkingRow text={event.text} />;
    case "tool":
      return <ToolRow {...event} />;
    default: {
      // Unreachable through the public API — assertValidEvents screens kinds
      // at the boundary (D8); kept for compile-time exhaustiveness (D3).
      /* v8 ignore next 4 */
      const exhaustive: never = event;
      throw new TypeError(
        `AgentTimeline: unknown event kind "${String((exhaustive as AgentEvent).kind)}" — expected ${KIND_UNION_MESSAGE}`,
      );
    }
  }
}

const Row = memo(
  ({ event }: { event: AgentEvent }) => eventRow(event),
  (prev, next) => prev.event === next.event,
);
Row.displayName = "AgentTimeline.Row";

/**
 * Ordered agent-turn timeline mixing messages, thinking and tool events
 * (plan ADR D2 — sibling of ChatThread: windowed `<Static>` history +
 * identity-memoized rows + its own kind dispatch).
 */
export function AgentTimeline({
  events,
  windowSize = 8,
  windowOverscan = 4,
}: AgentTimelineProps) {
  // Boundary validation FIRST, before any hook (F10 — tests invoke this as a
  // plain function; Ink swallows render-time throws).
  assertValidEvents(events);
  const tailStart = Math.max(
    0,
    events.length - Math.max(0, windowSize) - Math.max(0, windowOverscan),
  );
  const prefix = useMemo(() => events.slice(0, tailStart), [events, tailStart]);
  const tail = events.slice(tailStart);

  return (
    <>
      {prefix.length > 0 && (
        <Static items={prefix}>
          {(event) => <Row key={event.id} event={event} />}
        </Static>
      )}
      <Box flexDirection="column">
        {tail.map((event) => (
          <Row key={event.id} event={event} />
        ))}
      </Box>
    </>
  );
}
