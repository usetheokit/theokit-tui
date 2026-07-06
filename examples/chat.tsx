import { Box, render, useApp } from "ink";
import { useEffect, useRef, useState } from "react";

import { ChatComposer, ChatThread, TheoTUIProvider } from "../src/index.js";
import type { ChatThreadMessage } from "../src/index.js";

// Interactive M1 demo (plan T4.2, ADR D8): thread + composer + fake streaming.
// In non-TTY runs (pnpm example:chat | cat) the composer is NOT MOUNTED —
// ink's useInput requires raw-mode stdin (SEPA brief) — and a scripted
// streaming reply plays instead, so the piped smoke stays honest.
const interactive = Boolean(process.stdin.isTTY);

const REPLY =
  "Streaming reply: tokens arrive one at a time, appended in place.";

let nextId = 0;
const makeId = () => `msg-${nextId++}`;

const initialMessages: ChatThreadMessage[] = [
  { id: makeId(), role: "system", content: "Demo session — M1 chat surface." },
  { id: makeId(), role: "user", content: "What ships in M1?" },
  {
    id: makeId(),
    role: "assistant",
    content: "ChatThread with Static history, ChatComposer and streaming.",
  },
];

function useFakeStreaming(
  setMessages: React.Dispatch<React.SetStateAction<ChatThreadMessage[]>>,
) {
  // Per-stream handles in a Set: overlapping submits each clear their OWN
  // interval (review F-arch-1/F-dom-1 — a shared ref froze the second reply
  // and leaked the first interval).
  const timers = useRef(new Set<ReturnType<typeof setInterval>>());

  const stream = (onDone?: () => void) => {
    const id = makeId();
    const tokens = REPLY.split(" ");
    let index = 0;
    setMessages((current) => [
      ...current,
      { id, role: "assistant", content: "" },
    ]);
    const handle = setInterval(() => {
      index += 1;
      const content = tokens.slice(0, index).join(" ");
      setMessages((current) => {
        const last = current[current.length - 1];
        if (last === undefined || last.id !== id) {
          return current;
        }
        // Streaming contract (ADR D2): replace the LAST message object.
        return [...current.slice(0, -1), { ...last, content }];
      });
      if (index >= tokens.length) {
        clearInterval(handle);
        timers.current.delete(handle);
        onDone?.();
      }
    }, 60);
    timers.current.add(handle);
  };

  useEffect(
    () => () => {
      for (const handle of timers.current) {
        clearInterval(handle);
      }
    },
    [],
  );

  return stream;
}

function App() {
  const { exit } = useApp();
  const [messages, setMessages] = useState(initialMessages);
  const stream = useFakeStreaming(setMessages);

  useEffect(() => {
    if (!interactive) {
      // Scripted demo: one streamed reply, then exit cleanly (piped smoke).
      stream(() => {
        setTimeout(() => {
          exit();
        }, 100);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <ChatThread messages={messages} />
        {interactive && (
          <ChatComposer
            placeholder="Type a message (Enter sends, Ctrl+J newline, Ctrl+C quits)"
            onSubmit={(text) => {
              setMessages((current) => [
                ...current,
                { id: makeId(), role: "user", content: text },
              ]);
              stream();
            }}
          />
        )}
      </Box>
    </TheoTUIProvider>
  );
}

render(<App />);
