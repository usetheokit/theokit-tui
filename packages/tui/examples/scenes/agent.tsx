import { Box, render } from "ink";
import { useEffect, useState } from "react";
import type { AgentEvent } from "../../src/index.js";
import { AgentStreaming, AgentTimeline, TheoTUIProvider } from "../../src/index.js";

// Agent-turn demo (plan T3.2 — TTFATT caller): a scripted turn — thinking →
// tool running → tool success → assistant message — with a live elapsed
// ticker driving AgentStreaming (the 5-line pattern ADR D4 promises). On a
// TTY the turn animates; when piped/non-TTY (M2 dom-frontend-2 lesson) the
// FINAL scene renders statically and exits — Ink would otherwise spray erase
// sequences into logs/pagers.
const isInteractive = process.stdout.isTTY === true;

const thinkingEvent: AgentEvent = {
  id: "th1",
  kind: "thinking",
  text: "inspecting the failing test",
};

const finalTurn: AgentEvent[] = [
  thinkingEvent,
  {
    id: "tl1",
    kind: "tool",
    name: "vitest",
    status: "success",
    output: "181 passed",
  },
  { id: "ms1", kind: "message", role: "assistant", text: "All green now." },
];

const runningTurn: AgentEvent[] = [
  thinkingEvent,
  { id: "tl1", kind: "tool", name: "vitest", status: "running" },
];

function Demo() {
  const [events, setEvents] = useState<AgentEvent[]>(isInteractive ? runningTurn : finalTurn);
  const [elapsed, setElapsed] = useState(0);
  const streaming = isInteractive && events !== finalTurn;

  useEffect(() => {
    if (!isInteractive) {
      return;
    }
    // The D4 ticker pattern: the CALLER owns elapsed time.
    const ticker = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    const finish = setTimeout(() => {
      setEvents(finalTurn);
    }, 2500);
    return () => {
      clearInterval(ticker);
      clearTimeout(finish);
    };
  }, []);

  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <AgentTimeline events={events} />
        {streaming && (
          <AgentStreaming
            thought="running the test suite"
            showCancelHint
            elapsedSeconds={elapsed}
          />
        )}
      </Box>
    </TheoTUIProvider>
  );
}

const instance = render(<Demo />);
setTimeout(
  () => {
    instance.unmount();
  },
  isInteractive ? 4000 : 0,
);
