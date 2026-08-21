import { Text } from "ink";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { stripAnsi } from "../src/format/ansi.js";
import {
  AgentStreaming,
  AgentTimeline,
  ApprovalPrompt,
  AppStatusBar,
  Banner,
  ChatComposer,
  ChatMessage,
  ChatThread,
  ChoiceRow,
  CodeBlock,
  CollapsibleBlock,
  ContextWindowBar,
  CostMeter,
  DEFAULT_APPROVAL_CHOICES,
  DiffViewer,
  ExpandableOutput,
  FreeTextInput,
  Image,
  KeyboardHelp,
  MarkdownText,
  MultiStepProgress,
  Pager,
  PlanApproval,
  ProgressActivity,
  ProgressBar,
  QuestionPrompt,
  SelectList,
  Stack,
  ThinkingBlock,
  Toast,
  TodoList,
  TokenUsageChart,
  ToolCall,
  ToolCallCard,
  ToolResult,
  UsagePanel,
  WelcomeBanner,
  WindowedList,
} from "../src/index.js";
import type { LayoutMarginProps } from "../src/layout/layout-props.js";
import { renderFrame } from "./fixtures/helpers.js";

// Universal margin contract (LayoutMarginProps). Every public visual component
// accepts the margin family and applies it to its root layout. Oracle: passing
// `marginTop={2}` adds EXACTLY two blank lines above the component's content vs
// the no-margin baseline — a differential check immune to any internal leading
// margin a component already carries.
async function leadingBlanks(node: ReactElement): Promise<number> {
  const raw = await renderFrame(node);

  const plain = stripAnsi(raw);
  const lines = plain.split("\n");
  let n = 0;
  while (n < lines.length && lines[n]?.trim() === "") n += 1;
  return n;
}

const noop = (): void => {};
const TODO = [{ id: "a", label: "shipped", status: "done" as const }];
const STEPS = [
  { id: "1", label: "clone", status: "done" as const },
  { id: "2", label: "build", status: "active" as const },
];
const OPTIONS = [
  { value: "red", label: "red" },
  { value: "green", label: "green" },
];
const PATCH = `--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n`;

// Each case builds its element from margin props so the SAME element can be
// rendered with and without a margin. `{...m}` typechecks ONLY if the component
// accepts LayoutMarginProps — so this table doubles as the compile-time proof
// that every listed component exposes the margin API.
const CASES: Array<[string, (m: LayoutMarginProps) => ReactElement]> = [
  [
    "ChatMessage",
    (m) => (
      <ChatMessage {...m} role="assistant">
        hi
      </ChatMessage>
    ),
  ],
  [
    "ChatThread",
    (m) => <ChatThread {...m} messages={[{ id: "a", role: "user", content: "hi" }]} />,
  ],
  ["ToolCall", (m) => <ToolCall {...m} name="read" status="success" />],
  ["ToolCallCard", (m) => <ToolCallCard {...m} name="read" status="success" />],
  ["ToolResult", (m) => <ToolResult {...m}>output line</ToolResult>],
  ["CodeBlock", (m) => <CodeBlock {...m} code="const x = 1" />],
  ["MarkdownText", (m) => <MarkdownText {...m} text="**hi**" />],
  ["DiffViewer", (m) => <DiffViewer {...m} patch={PATCH} />],
  [
    "AgentTimeline",
    (m) => (
      <AgentTimeline
        {...m}
        events={[{ id: "m1", kind: "message", role: "assistant", text: "hi" }]}
      />
    ),
  ],
  ["AgentStreaming", (m) => <AgentStreaming {...m} thought="thinking" />],
  ["AppStatusBar", (m) => <AppStatusBar {...m} model="opus" />],
  [
    "ContextWindowBar",
    (m) => <ContextWindowBar {...m} usedTokens={64_000} limitTokens={128_000} />,
  ],
  ["TokenUsageChart", (m) => <TokenUsageChart {...m} usage={{ input: 1000, output: 500 }} />],
  ["CostMeter", (m) => <CostMeter {...m} costUsd={1.23} />],
  [
    "UsagePanel",
    (m) => (
      <UsagePanel
        {...m}
        usage={{
          inputTokens: 12_000,
          outputTokens: 3_000,
          totalTokens: 15_000,
        }}
        contextWindow={128_000}
      />
    ),
  ],
  ["ChatComposer", (m) => <ChatComposer {...m} onSubmit={noop} />],
  ["WelcomeBanner", (m) => <WelcomeBanner {...m} name="Theo" />],
  ["Image", (m) => <Image {...m} base64Data="AAAA" mimeType="image/png" />],
  ["Pager", (m) => <Pager {...m} content={"line1\nline2"} onClose={noop} />],
  ["WindowedList", (m) => <WindowedList {...m} rows={["a", "b", "c"]} selected={1} />],
  [
    "SelectList",
    (m) => <SelectList {...m} items={[{ value: "a", label: "apple" }]} onSubmit={noop} />,
  ],
  [
    "ChoiceRow",
    (m) => <ChoiceRow {...m} choices={[...DEFAULT_APPROVAL_CHOICES]} onCommit={noop} />,
  ],
  [
    "ApprovalPrompt",
    (m) => (
      <ApprovalPrompt {...m} title="Run?" onDecision={noop}>
        <Text>body</Text>
      </ApprovalPrompt>
    ),
  ],
  [
    "QuestionPrompt",
    (m) => (
      <QuestionPrompt {...m} header="Q" question="pick one" options={OPTIONS} onAnswer={noop} />
    ),
  ],
  ["PlanApproval", (m) => <PlanApproval {...m} plan="# Plan" onDecision={noop} />],
  ["FreeTextInput", (m) => <FreeTextInput {...m} label="Name" onSubmit={noop} />],
  ["TodoList", (m) => <TodoList {...m} items={TODO} />],
  ["MultiStepProgress", (m) => <MultiStepProgress {...m} steps={STEPS} />],
  [
    "CollapsibleBlock",
    (m) => (
      <CollapsibleBlock {...m} summary="sum">
        <Text>body</Text>
      </CollapsibleBlock>
    ),
  ],
  [
    "ThinkingBlock",
    (m) => (
      <ThinkingBlock {...m}>
        <Text>thinking</Text>
      </ThinkingBlock>
    ),
  ],
  ["Toast", (m) => <Toast {...m} message="done" onDismiss={noop} />],
  [
    "ExpandableOutput",
    (m) => (
      <ExpandableOutput
        {...m}
        collapsed={<Text>c</Text>}
        expanded={<Text>e</Text>}
        hiddenCount={3}
      />
    ),
  ],
  ["KeyboardHelp", (m) => <KeyboardHelp {...m} shortcuts={[{ keys: "?", description: "help" }]} />],
  ["Banner", (m) => <Banner {...m} name="Theo" />],
  [
    "Stack",
    (m) => (
      <Stack {...m}>
        <Text>x</Text>
      </Stack>
    ),
  ],
  ["ProgressBar", (m) => <ProgressBar {...m} percent={50} />],
  ["ProgressActivity", (m) => <ProgressActivity {...m} label="Compacting…" percent={10} />],
];

describe("universal margin contract (LayoutMarginProps)", () => {
  it("covers_every_public_visual_component", () => {
    // Guard against silent drift: if a new component ships, add it here.
    expect(CASES.length).toBe(37);
  });

  for (const [name, make] of CASES) {
    it(`${name}_applies_marginTop_to_its_root`, async () => {
      const base = await leadingBlanks(make({}));
      const withMargin = await leadingBlanks(make({ marginTop: 2 }));
      expect(withMargin - base, `${name} marginTop`).toBe(2);
    });
  }
});
