import { Box, render, Text } from "ink";
import { useState, type ReactNode } from "react";

import {
  AgentStreaming,
  AgentTimeline,
  AppStatusBar,
  ApprovalPrompt,
  ChatThread,
  ChoiceRow,
  CodeBlock,
  CollapsibleBlock,
  ContextWindowBar,
  CostMeter,
  DiffViewer,
  ExpandableOutput,
  MarkdownText,
  MultiStepProgress,
  PlanApproval,
  QuestionPrompt,
  SelectList,
  setTerminalTitle,
  TheoTUIProvider,
  ThinkingBlock,
  Toast,
  TodoList,
  TokenUsageChart,
  ToolCall,
  ToolCallCard,
  ToolResult,
  VERSION,
  WelcomeBanner,
  type ChatThreadMessage,
  type SelectListItem,
  type TodoItem,
} from "../src/index.js";
import { FocusProvider } from "../src/renderer/hooks/use-focus.js";
import { createInputSource } from "../src/renderer/input/input-source.js";
import { InputContext } from "../src/renderer/input/use-input.js";
import { useInput } from "../src/renderer/input/use-input.js";

// GALLERY — every @theokit/tui component in a paginated demo (n/→ next, p/←
// prev, q quit). Interactive components render with autoFocus={false} so the
// page-nav keys always reach the top handler (this is a visual gallery, not a
// driving harness). Run: `pnpm tsx examples/all-components.tsx`.

const THREAD: ChatThreadMessage[] = [
  { id: "s", role: "system", content: "Gallery session — every primitive." },
  { id: "u", role: "user", content: "Show me everything." },
  {
    id: "a",
    role: "assistant",
    markdown: true,
    content: "Here is the **full** surface — press `n` to page through it.",
  },
];

const TABLE_MD = [
  "## Markdown (with a GFM table)",
  "",
  "Inline **bold**, *italic*, `code`, and a [link](https://theo.dev).",
  "",
  "| component | milestone | status |",
  "| --- | :-: | ---: |",
  "| tables | M25 | ✓ |",
  "| intra-line diff | M25 | ✓ |",
  "| ExpandableOutput | M25 | ✓ |",
].join("\n");

const PATCH = [
  "--- a/retry.ts",
  "+++ b/retry.ts",
  "@@ -1,2 +1,2 @@",
  " const attempts = 3;",
  "-const backoff = attempt * 100;",
  "+const backoff = attempt * 250;",
  "",
].join("\n");

const TODOS: TodoItem[] = [
  { id: "1", label: "read the spec", status: "done" },
  { id: "2", label: "write the tests", status: "active" },
  { id: "3", label: "make them pass", status: "pending" },
];

const STEPS: TodoItem[] = [
  { id: "a", label: "researcher", status: "done" },
  { id: "b", label: "coder", status: "active" },
  { id: "c", label: "reviewer", status: "pending" },
];

const COLORS: SelectListItem[] = [
  { value: "red", label: "red", description: "a warm color" },
  { value: "green", label: "green", description: "a cool color" },
  { value: "blue", label: "blue", description: "the sky" },
];

const CODE = [
  "export function backoff(attempt: number): number {",
  "  return Math.min(attempt * 250, 2000);",
  "}",
].join("\n");

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box flexDirection="column" gap={1}>
      <Text color="cyan" bold>
        {title}
      </Text>
      {children}
    </Box>
  );
}

const PAGES: { title: string; body: ReactNode }[] = [
  {
    title: "1/7 · Chat & agent",
    body: (
      <Box flexDirection="column" gap={1}>
        <WelcomeBanner
          name="Theo TUI"
          version={VERSION}
          tagline="every component, one gallery"
        />
        <ChatThread messages={THREAD} />
        <AgentStreaming
          thought="planning the demo"
          elapsedSeconds={3}
          showCancelHint
        />
        <AgentTimeline
          events={[
            { id: "t1", kind: "thinking", text: "inspecting the surface" },
            { id: "t2", kind: "tool", name: "grep", status: "success" },
            { id: "t3", kind: "message", role: "assistant", text: "ready" },
          ]}
        />
      </Box>
    ),
  },
  {
    title: "2/7 · Markdown · code · diff",
    body: (
      <Box flexDirection="column" gap={1}>
        <MarkdownText text={TABLE_MD} />
        <CodeBlock code={CODE} language="ts" showLineNumbers />
        <Text dimColor>DiffViewer (intra-line word highlight):</Text>
        <DiffViewer patch={PATCH} intraLineHighlight />
        <Text dimColor>ExpandableOutput (ctrl+o to expand):</Text>
        <ExpandableOutput
          collapsed={<Text dimColor>first 2 lines …</Text>}
          expanded={
            <Text dimColor>
              line 1{"\n"}line 2{"\n"}line 3{"\n"}line 4
            </Text>
          }
          hiddenCount={2}
          autoFocus={false}
        />
      </Box>
    ),
  },
  {
    title: "3/7 · Tool cards & results",
    body: (
      <Box flexDirection="column" gap={1}>
        <ToolCall name="search files" status="running" />
        <ToolCallCard
          name="bash pnpm vitest run"
          status="failed"
          summary="reproduce the flake"
          result={{
            kind: "output",
            shell: { stdout: "573 passed", stderr: "1 flaky", exitCode: 1 },
          }}
        />
        <ToolCallCard
          name="edit retry.ts"
          status="success"
          summary="linear capped backoff"
          result={{ kind: "diff", patch: PATCH }}
        />
        <Text dimColor>ToolResult (interactive — ctrl+o):</Text>
        <ToolResult
          lines={Array.from({ length: 12 }, (_, i) => `log line ${i}`)}
          maxLines={4}
          interactive
        />
      </Box>
    ),
  },
  {
    title: "4/7 · Metrics & status",
    body: (
      <Box flexDirection="column" gap={1}>
        <ContextWindowBar
          usedTokens={23_400}
          limitTokens={128_000}
          width={60}
        />
        <TokenUsageChart usage={{ input: 1800, output: 640 }} />
        <CostMeter costUsd={0.0842} />
        <AppStatusBar
          model="theo-demo-1"
          cwd={process.cwd()}
          tokens={{ used: 23_400, limit: 128_000 }}
          state="idle"
        />
      </Box>
    ),
  },
  {
    title: "5/7 · Live progress",
    body: (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>TodoList (☐/◐/☑):</Text>
        <TodoList items={TODOS} />
        <Text dimColor>MultiStepProgress (subagent lanes):</Text>
        <MultiStepProgress steps={STEPS} groupLabel="3 subagents" />
        <ThinkingBlock>
          The reasoning body renders **markdown** when expanded.
        </ThinkingBlock>
        <CollapsibleBlock
          summary={<Text>tool output (space/enter)</Text>}
          autoFocus={false}
        >
          <Text dimColor>… expanded body …</Text>
        </CollapsibleBlock>
        <Toast
          message="build finished ✓"
          durationMs={9_999_999}
          onDismiss={() => {}}
        />
      </Box>
    ),
  },
  {
    title: "6/7 · Agent decisions",
    body: (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>ApprovalPrompt (composes a DiffViewer preview):</Text>
        <ApprovalPrompt
          title="Apply this edit?"
          onDecision={() => {}}
          autoFocus={false}
        >
          <DiffViewer patch={PATCH} />
        </ApprovalPrompt>
        <Text dimColor>QuestionPrompt (SelectList + free text):</Text>
        <QuestionPrompt
          header="Follow-up"
          question="Which environments?"
          options={COLORS}
          multi
          onAnswer={() => {}}
          autoFocus={false}
        />
        <Text dimColor>PlanApproval + ChoiceRow:</Text>
        <PlanApproval
          plan={"# Plan\n\n1. Ship it\n2. Celebrate"}
          onDecision={() => {}}
          autoFocus={false}
        />
      </Box>
    ),
  },
  {
    title: "7/7 · Interaction primitives",
    body: (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>SelectList (fuzzy, single/multi):</Text>
        <SelectList items={COLORS} onSubmit={() => {}} autoFocus={false} />
        <Text dimColor>ChoiceRow (fixed choice bar):</Text>
        <ChoiceRow
          choices={[
            { value: "once", label: "Allow once" },
            { value: "always", label: "Allow always" },
            { value: "reject", label: "Reject" },
          ]}
          onCommit={() => {}}
          autoFocus={false}
        />
        <Text dimColor>
          Pager: a full-screen scroll viewport (pushed via useOverlay in real
          apps).
        </Text>
        <Text dimColor>
          Image: kitty/iTerm2 inline images with a [Image: …] text fallback.
        </Text>
        <Text dimColor>
          notify() / setTerminalTitle() / osc8Link(): OSC helpers (title set on
          mount).
        </Text>
      </Box>
    ),
  },
];

function Gallery() {
  const [page, setPage] = useState(0);
  const total = PAGES.length;
  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      exitApp();
    } else if (input === "n" || key.rightArrow || input === " ") {
      setPage((p) => Math.min(p + 1, total - 1));
    } else if (input === "p" || key.leftArrow) {
      setPage((p) => Math.max(p - 1, 0));
    }
  });
  const current = PAGES[page]!;
  return (
    <TheoTUIProvider>
      <Box flexDirection="column" width={96}>
        <Page title={current.title}>{current.body}</Page>
        <Box marginTop={1}>
          <Text dimColor>
            [{page + 1}/{total}] n/→ next · p/← prev · q quit — @theokit/tui v
            {VERSION}
          </Text>
        </Box>
      </Box>
    </TheoTUIProvider>
  );
}

// Wire OUR input + focus (the composition root an app owns).
const source = createInputSource(process.stdin as never, (d) =>
  process.stdout.write(d),
);
source.start();
setTerminalTitle("Theo TUI — component gallery");

const instance = render(
  <InputContext.Provider value={source}>
    <FocusProvider>
      <Gallery />
    </FocusProvider>
  </InputContext.Provider>,
);

function exitApp(): void {
  instance.unmount();
  source.stop();
  process.exit(0);
}

// Piped (non-TTY) — the gallery is interactive; print the first page then exit.
if (!process.stdin.isTTY) {
  setTimeout(exitApp, 300);
}
