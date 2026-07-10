import { Box, render, useApp } from "ink";
import { useEffect, useRef, useState } from "react";

import {
  AgentStreaming,
  AppStatusBar,
  ChatComposer,
  ChatThread,
  ContextWindowBar,
  CostMeter,
  TheoTUIProvider,
  ToolCallCard,
  VERSION,
  WelcomeBanner,
  useTurnElapsed,
} from "../src/index.js";
import type { ChatThreadMessage } from "../src/index.js";

// SHOWCASE — every shipped primitive in ONE scripted agent turn
// (M0–M16): animated WelcomeBanner in the ChatThread header slot,
// markdown assistant reply, per-kind ToolCallCards (diff/output/preview),
// AgentStreaming driven by useTurnElapsed, metrics row, AppStatusBar and
// the slash-command ChatComposer. Piped (non-TTY) runs play the whole
// script deterministically and exit (banner degrades to static, composer
// not mounted — raw-mode stdin required); interactive runs keep the
// composer with `/` autocomplete at the end.
//   pnpm example:showcase          (interactive)
//   pnpm example:showcase | cat    (scripted, deterministic)
const interactive = Boolean(process.stdin.isTTY);

let nextId = 0;
const makeId = () => `msg-${nextId++}`;

const MARKDOWN_REPLY = [
  "## Plan",
  "",
  "1. Reproduce the **flaky retry** with `pnpm vitest run`",
  "2. Patch the backoff in *retry.ts*",
  "",
  "```ts",
  "const backoff = attempt * 250; // linear, capped",
  "```",
  "",
  "Details: [retry docs](https://theo.dev/retry)",
].join("\n");

const initialMessages: ChatThreadMessage[] = [
  {
    id: makeId(),
    role: "system",
    content: "Showcase session — every @theokit/tui primitive, one turn.",
  },
  { id: makeId(), role: "user", content: "Fix the flaky retry test." },
];

const REPLY_TOKENS =
  "Reproduced the flake, patched the backoff and re-ran the suite — all green.".split(
    " ",
  );

type Stage = "thinking" | "tools" | "typing" | "done";

function Demo() {
  const { exit } = useApp();
  const [messages, setMessages] = useState(initialMessages);
  const [stage, setStage] = useState<Stage>("thinking");
  const streaming = stage === "thinking" || stage === "typing";
  const elapsed = useTurnElapsed(streaming);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Scripted turn: thinking → markdown plan → tool cards → typed reply →
  // (piped) exit. Every timer is tracked and cleared on unmount.
  useEffect(() => {
    const later = (ms: number, fn: () => void) => {
      const handle = setTimeout(fn, ms);
      timers.current.add(handle);
    };
    later(900, () => {
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          markdown: true,
          content: MARKDOWN_REPLY,
        },
      ]);
      setStage("tools");
    });
    later(2100, () => {
      setStage("typing");
      const id = makeId();
      setMessages((current) => [
        ...current,
        { id, role: "assistant", content: "" },
      ]);
      REPLY_TOKENS.forEach((_, index) => {
        later(120 * (index + 1), () => {
          setMessages((current) => {
            const last = current[current.length - 1];
            if (last === undefined || last.id !== id) {
              return current;
            }
            const content = REPLY_TOKENS.slice(0, index + 1).join(" ");
            return [...current.slice(0, -1), { ...last, content }];
          });
        });
      });
      later(120 * REPLY_TOKENS.length + 300, () => {
        setStage("done");
      });
    });
    const tracked = timers.current;
    return () => {
      for (const handle of tracked) {
        clearTimeout(handle);
      }
    };
  }, []);

  useEffect(() => {
    if (!interactive && stage === "done") {
      const handle = setTimeout(() => {
        exit();
      }, 150);
      return () => {
        clearTimeout(handle);
      };
    }
    return undefined;
  }, [stage, exit]);

  const showTools = stage !== "thinking";
  return (
    <TheoTUIProvider>
      <Box flexDirection="column" width={72}>
        <ChatThread
          header={
            <WelcomeBanner
              name="Theo TUI Showcase"
              version={VERSION}
              tagline="Every primitive, one agent turn"
              hints={["/help for commands", "esc cancels a running turn"]}
              animated
            />
          }
          messages={messages}
        />
        {showTools && (
          <Box flexDirection="column" marginTop={1}>
            <ToolCallCard
              name="Bash"
              status="failed"
              summary="pnpm vitest run retry"
              result={{
                kind: "output",
                shell: {
                  stdout: "573 passed",
                  stderr: "1 flaky: retry_backoff_caps",
                  exitCode: 1,
                },
              }}
            />
            <ToolCallCard
              name="Edit"
              status="success"
              summary="retry.ts"
              result={{
                kind: "diff",
                patch: [
                  "--- a/retry.ts",
                  "+++ b/retry.ts",
                  "@@ -1,2 +1,2 @@",
                  " const attempts = 3;",
                  "-const backoff = 0;",
                  "+const backoff = attempt * 250;",
                  "",
                ].join("\n"),
              }}
            />
            <ToolCallCard
              name="Read"
              status="success"
              summary="retry.test.ts"
              result={{
                kind: "preview",
                text: [
                  'it("retry_backoff_caps", () => {',
                  "  const waits = plan(3);",
                  "  expect(waits).toEqual([250, 500, 750]);",
                  "});",
                  "// tail of file …",
                ].join("\n"),
                language: "ts",
                maxLines: 4,
              }}
            />
          </Box>
        )}
        {streaming && (
          <Box marginTop={1}>
            <AgentStreaming
              thought={
                stage === "thinking"
                  ? "inspecting the failing retry test"
                  : "writing the summary"
              }
              elapsedSeconds={elapsed}
              showCancelHint
            />
          </Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <ContextWindowBar
            usedTokens={23_400}
            limitTokens={128_000}
            width={60}
          />
          <CostMeter costUsd={0.0842} />
        </Box>
        <AppStatusBar
          model="theo-demo-1"
          cwd={process.cwd()}
          tokens={{ used: 23_400, limit: 128_000 }}
          state={streaming ? "streaming" : stage === "tools" ? "tools" : "idle"}
        />
        {interactive && (
          <ChatComposer
            placeholder="Type a message ('/' commands · '@' files · Enter sends)"
            commands={[
              { name: "help", description: "show available commands" },
              { name: "clear", description: "clear the thread" },
              { name: "model", description: "switch the model" },
              { name: "retry", description: "re-run the failing test" },
            ]}
            hint="esc dismisses · Alt+Enter newline · @ browses files (try @~/) · Ctrl+C quits"
            bordered
            onSubmit={(text) => {
              setMessages((current) => [
                ...current,
                { id: makeId(), role: "user", content: text },
              ]);
            }}
          />
        )}
      </Box>
    </TheoTUIProvider>
  );
}

render(<Demo />);
