import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { AgentTimeline } from "./agent-timeline.js";
import type { AgentStreamEvent } from "./agent-stream-event.js";
import { useAgentStream } from "./use-agent-stream.js";
import type {
  AgentStreamSource,
  UseAgentStreamResult,
} from "./use-agent-stream.js";

// T2.2 (plan m7-stream-adapter, ADR D5): both reconnect shapes pinned.
// (1) producer-side exactly-once (subscribe()-style resume — the mirror's
// reconnect scenario, timer-free); (2) reset+refold via a NEW factory
// identity (the Run.stream() TOTAL-replay shape — re-calling stream() always
// replays from index 0, sdk-source-proven). Zero adapter changes expected:
// these tests PROVE the D4 design carries both.

const delta = (text: string): AgentStreamEvent => ({
  type: "text-delta",
  text,
});

async function ticks(count = 20): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

/**
 * Producer-side exactly-once resume: internal lastEventId; the "connection
 * drop" at `dropAfter` does NOT advance it (the event is retried after the
 * invisible reconnect), so the consumer sees ONE continuous stream — the
 * real SDK subscribe() auto-reconnect contract, rebuilt timer-free.
 */
async function* resumingStream(
  texts: string[],
  dropAfter: number,
): AsyncGenerator<AgentStreamEvent> {
  let lastEventId = 0;
  let dropped = false;
  while (lastEventId < texts.length) {
    if (!dropped && lastEventId === dropAfter) {
      // The drop: producer reconnects with Last-Event-ID and retries the
      // SAME event — no yield, no advance, invisible to the consumer.
      dropped = true;
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      continue;
    }
    yield delta(texts[lastEventId]!);
    lastEventId += 1;
  }
}

interface Captured {
  current?: UseAgentStreamResult;
}

function Probe({
  source,
  captured,
}: {
  source?: AgentStreamSource;
  captured: Captured;
}) {
  const result = useAgentStream(source);
  captured.current = result;
  return <Text>{result.status}</Text>;
}

/** Fail-fast state access — the probe always captures after render. */
function requireState(captured: Captured): UseAgentStreamResult {
  if (captured.current === undefined) {
    throw new Error("probe captured no state");
  }
  return captured.current;
}

/** The clean-single-fold oracle: done, one fresh-id message, boundary-safe. */
function expectCleanSingleFold(
  state: UseAgentStreamResult,
  text: string,
): void {
  expect(state.status).toBe("done");
  expect(finalMessageText(state)).toBe(text);
  expect(state.events).toHaveLength(1);
  expect(state.events[0]).toMatchObject({ id: "msg-1" });
  const ids = state.events.map((event) => event.id);
  const uniqueIds = new Set(ids);
  expect(uniqueIds.size).toBe(ids.length);
  // The M3 boundary oracle re-used — the folded state renders clean.
  const boundary = render(
    createElement(AgentTimeline, { events: state.events }),
  );
  boundary.unmount();
}

function finalMessageText(state: UseAgentStreamResult | undefined): string {
  const message = state?.events.find((event) => event.kind === "message");
  return message?.kind === "message" ? message.text : "";
}

describe("useAgentStream reconnect (D5)", () => {
  it("reconnect_resumes_exactly_once", async () => {
    const captured: Captured = {};
    const { unmount } = render(
      <Probe
        source={resumingStream(["a", "b", "c", "d", "e"], 2)}
        captured={captured}
      />,
    );
    await ticks();
    expect(captured.current?.status).toBe("done");
    const text = finalMessageText(captured.current);
    // No duplicate of a,b; no loss of c,d,e — exactly-once end to end.
    expect(text).toBe("abcde");
    expect(captured.current?.events).toHaveLength(1);
    unmount();
  });

  // The Run.stream() shape: EVERY (re-)call replays from index 0.
  async function* dropsMidway(): AsyncGenerator<AgentStreamEvent> {
    yield delta("a");
    yield delta("b");
    throw new Error("connection reset");
  }
  async function* totalReplay(): AsyncGenerator<AgentStreamEvent> {
    yield delta("a");
    yield delta("b");
    yield delta("c");
  }

  it("reattach_with_replaying_factory_refolds_fresh", async () => {
    // A drop mid-stream surfaces as the error state; re-attaching with a
    // NEW factory identity resets and refolds the TOTAL replay — final
    // state identical to one clean fold, zero duplicate ids.
    const captured: Captured = {};
    const attemptOne: AgentStreamSource = () => dropsMidway();
    const { rerender, unmount } = render(
      <Probe source={attemptOne} captured={captured} />,
    );
    await ticks();
    const afterDrop = requireState(captured);
    expect(afterDrop.status).toBe("error");
    expect(afterDrop.error?.message).toBe("connection reset");
    expect(finalMessageText(afterDrop)).toBe("ab");

    const attemptTwo: AgentStreamSource = () => totalReplay();
    rerender(<Probe source={attemptTwo} captured={captured} />);
    await ticks();
    // Identical to a single clean fold: one message, fresh ids, no dups.
    expectCleanSingleFold(requireState(captured), "abc");
    unmount();
  });
});
