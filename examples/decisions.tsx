import { Box, render, Text } from "ink";
import { useState } from "react";

import {
  ApprovalPrompt,
  DiffViewer,
  FreeTextInput,
  InkInputProvider,
  PlanApproval,
  QuestionPrompt,
  type PlanDecision,
  type QuestionAnswer,
} from "../src/index.js";

// M23 example: a scripted agent-decision ROUND-TRIP — ApprovalPrompt (composing a
// DiffViewer preview) → QuestionPrompt (options + free text) → FreeTextInput
// (single-line prompt) → PlanApproval (markdown body + approve/revise). Each
// surface is callback-only; the app owns the sequencing (this state machine lives
// HERE, never in the lib). Run:
// `pnpm tsx examples/decisions.tsx`. Requires a raw-mode TTY.

const PATCH = [
  "--- a/config.ts",
  "+++ b/config.ts",
  "@@ -1,3 +1,3 @@",
  " export const config = {",
  "-  retries: 3,",
  "+  retries: 5,",
  " };",
  "",
].join("\n");

const PLAN = "# Plan\n\n1. Bump retries to 5\n2. Add a regression test\n";

type Stage = "approve" | "question" | "freetext" | "plan" | "done";

function Demo() {
  const [stage, setStage] = useState<Stage>("approve");
  const [log, setLog] = useState<string[]>([]);
  const record = (line: string): void => setLog((prev) => [...prev, line]);

  if (stage === "approve") {
    return (
      <ApprovalPrompt
        title="Apply this edit?"
        onDecision={(d) => {
          record(`approval: ${d}`);
          setStage("question");
        }}
      >
        <DiffViewer patch={PATCH} />
      </ApprovalPrompt>
    );
  }
  if (stage === "question") {
    return (
      <QuestionPrompt
        header="Follow-up"
        question="Which environments should this ship to?"
        options={[
          { value: "dev", label: "dev" },
          { value: "staging", label: "staging" },
          { value: "prod", label: "prod" },
        ]}
        multi
        allowFreeText
        onAnswer={(a: QuestionAnswer) => {
          record(`question: ${JSON.stringify(a)}`);
          setStage("freetext");
        }}
      />
    );
  }
  if (stage === "freetext") {
    return (
      <FreeTextInput
        label="Commit message:"
        onSubmit={(text) => {
          record(`freetext: ${text}`);
          setStage("plan");
        }}
      />
    );
  }
  if (stage === "plan") {
    return (
      <PlanApproval
        plan={PLAN}
        onDecision={(d: PlanDecision) => {
          record(`plan: ${JSON.stringify(d)}`);
          setStage("done");
        }}
      />
    );
  }
  return (
    <Box flexDirection="column">
      <Text>Decision round-trip complete:</Text>
      {log.map((line, index) => (
        <Text key={index} dimColor>
          {"  "}
          {line}
        </Text>
      ))}
    </Box>
  );
}

// One <InkInputProvider> at the composition root bridges Ink's stdin to the
// library's input+focus system, so the decision prompts receive keys under Ink.
const instance = render(
  <InkInputProvider>
    <Demo />
  </InkInputProvider>,
);

// Piped (non-TTY) — print the first decision frame once, then exit cleanly so
// the smoke test is deterministic (mirrors examples/chat.tsx's ADR D8 exit).
if (!process.stdin.isTTY) {
  setTimeout(() => {
    instance.unmount();
    process.exit(0);
  }, 300);
}
