import { Box, Text } from "ink";

import { AGENT_EVENT_KINDS, isAgentEventKind } from "./agent-event.js";
import type { AgentEvent } from "./agent-event.js";
import { CHAT_ROLES, ChatMessage } from "./chat-message.js";
import { TOOL_CALL_STATUSES, ToolCallCard } from "./tool-call.js";
import { ToolResult } from "./tool-result.js";
import { useTheoTheme } from "./theme.js";

const KIND_UNION_MESSAGE = AGENT_EVENT_KINDS.map((k) => `"${k}"`).join(" | ");

export interface AgentTimelineProps {
  /**
   * Ordered agent events. ORDERING CONTRACT (plan ADR D2): caller-ordered
   * array; unique ids (duplicates throw); graduated events are IMMUTABLE —
   * replace the TAIL event with a new object to stream (rows are memoized by
   * object identity). Always pass a NEW array on update.
   */
  events: AgentEvent[];
}

/**
 * FULL structural boundary check (plan ADR D8, EC-1/EC-2): variant-field
 * validation lives HERE — child-component guards would fire mid-render where
 * Ink's error boundary swallows throws (F10) and name the wrong component.
 * Extra/unknown properties are tolerated (EC-12).
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
        `AgentTimeline: message event "${event.id}" — invalid role "${String(event.role)}"`,
      );
    }
    if (event.kind === "tool") {
      if (!TOOL_CALL_STATUSES.includes(event.status)) {
        throw new TypeError(
          `AgentTimeline: tool event "${event.id}" — invalid status "${String(event.status)}"`,
        );
      }
      if (event.output !== undefined && event.shell !== undefined) {
        throw new TypeError(
          `AgentTimeline: tool event "${event.id}" — provide only one of output | shell`,
        );
      }
    }
  }
}

function ThinkingRow({ text }: { text: string }) {
  const theme = useTheoTheme();
  return (
    <Box>
      <Box minWidth={3}>
        <Text color={theme.role.system.prefix}>·</Text>
      </Box>
      <Text dimColor italic>
        {text}
      </Text>
    </Box>
  );
}

function ToolRow(event: Extract<AgentEvent, { kind: "tool" }>) {
  const hasBody = event.output !== undefined || event.shell !== undefined;
  return (
    <ToolCallCard
      name={event.name}
      status={event.status}
      {...(event.summary !== undefined ? { summary: event.summary } : {})}
    >
      {hasBody && (
        <ToolResult
          {...(event.output !== undefined
            ? { lines: event.output.split("\n") }
            : {})}
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

/**
 * Ordered agent-turn timeline mixing messages, thinking and tool events
 * (plan ADR D2 — sibling of ChatThread with its own kind dispatch).
 */
export function AgentTimeline({ events }: AgentTimelineProps) {
  // Boundary validation FIRST, before any hook (F10 — tests invoke this as a
  // plain function; Ink swallows render-time throws).
  assertValidEvents(events);
  if (events.length === 0) {
    return null;
  }
  return (
    <Box flexDirection="column">
      {events.map((event) => (
        <Box key={event.id}>{eventRow(event)}</Box>
      ))}
    </Box>
  );
}
