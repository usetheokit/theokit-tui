import { useMemo } from "react";

import type { AgentEvent } from "./agent-event.js";
import type { ToolHeaderFormatter, TurnUsage, UIMessageLike } from "./messages-to-events.js";
import { messagesToAgentEvents, readTurnUsage } from "./messages-to-events.js";
import { useCoalesced } from "./use-coalesced.js";

/** The slice of the framework's `useAgent()` result this hook reads. */
export interface AgentTimelineSource {
  readonly thread: readonly UIMessageLike[];
}

export interface UseAgentTimelineOptions {
  /** Messages shown BEFORE the thread: a greeting, a resumed transcript. */
  prefix?: readonly UIMessageLike[];
  /** Minimum ms between recomputations (default 34, see {@link useCoalesced}). Read on first render only. */
  windowMs?: number;
  /** Map a tool call to a human header, as for {@link messagesToAgentEvents}. */
  formatToolHeader?: ToolHeaderFormatter;
}

export interface UseAgentTimelineResult {
  /** The timeline for `<AgentTimeline events>`: prefix then thread. */
  events: readonly AgentEvent[];
  /** Usage of the most recent turn that reported any, or `undefined`. */
  usage: TurnUsage | undefined;
}

function lastUsage(messages: readonly UIMessageLike[]): TurnUsage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const usage = message === undefined ? undefined : readTurnUsage(message);
    if (usage !== undefined) return usage;
  }
  return undefined;
}

/**
 * The timeline of a framework `useAgent()` client: `prefix` + `agent.thread` projected through
 * {@link messagesToAgentEvents}, recomputed at most once per window (with a trailing update), plus the
 * last reported usage.
 *
 * Pass a module-stable `prefix` and `formatToolHeader`: a new identity invalidates the projection.
 */
export function useAgentTimeline(
  agent: AgentTimelineSource,
  options: UseAgentTimelineOptions = {},
): UseAgentTimelineResult {
  const { prefix, windowMs, formatToolHeader } = options;
  const thread = agent.thread;
  // One key object per (thread, prefix, formatter) identity — `useCoalesced` compares by `!==`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the deps ARE the key's inputs
  const key = useMemo(() => ({}), [thread, prefix, formatToolHeader]);
  return useCoalesced<UseAgentTimelineResult>(
    () => {
      const messages = prefix === undefined ? thread : [...prefix, ...thread];
      return {
        events: messagesToAgentEvents(
          messages,
          formatToolHeader === undefined ? undefined : { formatToolHeader },
        ),
        usage: lastUsage(thread),
      };
    },
    key,
    windowMs === undefined ? {} : { windowMs },
  );
}
