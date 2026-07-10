import { spawnSync } from "node:child_process";

import { Box, render, useApp } from "ink";
import { useEffect, useRef, useState } from "react";

import {
  AgentStreaming,
  AppStatusBar,
  ChatComposer,
  ChatThread,
  DEFAULT_COMPOSER_SHORTCUTS,
  KeyboardHelp,
  TheoTUIProvider,
  VERSION,
  WelcomeBanner,
  useTurnElapsed,
} from "../src/index.js";
import type { ChatThreadMessage } from "../src/index.js";

// Interactive M1 demo (plan T4.2, ADR D8): thread + composer + fake streaming.
// M15: the composer registers slash commands — the menu is INTERACTIVE-only
// (raw-mode stdin; a pipe cannot drive it — manually verifiable, the unit
// fake-stdin scripts are the deterministic evidence).
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
    markdown: true,
    content: [
      "## M1 highlights",
      "",
      "**ChatThread** with `Static` history and streaming.",
      "",
      "```bash",
      "npm install @theokit/tui",
      "```",
    ].join("\n"),
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
  const [streaming, setStreaming] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const stream = useFakeStreaming(setMessages);
  // M14: the lib-shipped turn clock drives AgentStreaming.elapsedSeconds.
  // NOTE: the scripted stream lasts < 1 s, so elapsed stays 0 in this demo
  // — the 1 Hz path is exercised end-to-end by the app-status-bar bench
  // (ticking mode), not here (review r2-F8, honest scope).
  const elapsed = useTurnElapsed(streaming);

  // Bang mode runner — the APP executes the shell command (the library never
  // spawns a process). The `!`-prefix + Enter routes here via onShellCommand;
  // we echo the command and append its captured output to the thread.
  const runShell = (command: string) => {
    setMessages((current) => [
      ...current,
      { id: makeId(), role: "user", content: `! ${command}` },
    ]);
    const result = spawnSync(command, { shell: true, encoding: "utf8" });
    const output =
      `${result.stdout ?? ""}${result.stderr ?? ""}`.trimEnd() || "(no output)";
    setMessages((current) => [
      ...current,
      { id: makeId(), role: "system", content: output },
    ]);
  };

  useEffect(() => {
    if (!interactive) {
      // Scripted demo: one streamed reply, then exit cleanly (piped smoke).
      setStreaming(true);
      stream(() => {
        setStreaming(false);
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
        <ChatThread
          header={
            <WelcomeBanner
              name="Theo TUI"
              version={VERSION}
              hints={["/help for commands"]}
            />
          }
          messages={messages}
        />
        {streaming && (
          <AgentStreaming
            thought="composing the reply"
            elapsedSeconds={elapsed}
            showCancelHint
          />
        )}
        <AppStatusBar
          model="theokit-demo"
          cwd={process.cwd()}
          tokens={{ used: 12_300, limit: 128_000 }}
          state={streaming ? "streaming" : "idle"}
        />
        {interactive && (
          <ChatComposer
            placeholder="Type a message (Enter sends · / commands · @ files · ! shell · ? help)"
            commands={[
              { name: "help", description: "show available commands" },
              { name: "clear", description: "clear the thread" },
              { name: "model", description: "switch the model" },
            ]}
            hint="? toggles shortcuts · @ browses files · ! runs a shell command"
            bordered
            onSubmit={(text) => {
              setMessages((current) => [
                ...current,
                { id: makeId(), role: "user", content: text },
              ]);
              stream();
            }}
            onShellCommand={runShell}
            onHelpToggle={() => setHelpOpen((open) => !open)}
          />
        )}
        {interactive && helpOpen && (
          <KeyboardHelp shortcuts={DEFAULT_COMPOSER_SHORTCUTS} />
        )}
      </Box>
    </TheoTUIProvider>
  );
}

render(<App />);
