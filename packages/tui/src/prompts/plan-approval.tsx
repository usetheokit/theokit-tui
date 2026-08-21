import { Box } from "ink";
import { useState } from "react";

import type { ApprovalChoice, PlanDecision } from "../agent/agent-decision.js";
import { FreeTextInput } from "../chat/free-text-input.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { MarkdownText } from "../markdown/markdown-text.js";
import { ChoiceRow } from "./choice-row.js";

// M23 PlanApproval (plan m23-agent-decision-surfaces T3.1, ADR D2): the Claude
// Code plan-mode idiom — a proposed-plan markdown body (M13 MarkdownText,
// streaming-safe) + a ChoiceRow of approve/revise. `revise` reveals a feedback
// text input (the shared FreeTextInput); Enter emits the feedback (empty
// allowed). Esc on the choice bar is a SAFE default → revise (never auto-approve).
// The decision leaves via one `onDecision(PlanDecision)` callback; no app state.

const PLAN_CHOICES: readonly ApprovalChoice[] = [
  { value: "approve", label: "Approve" },
  { value: "revise", label: "Revise" },
];

export interface PlanApprovalProps extends LayoutMarginProps {
  /** The proposed plan, as markdown (streaming partials are safe). */
  plan: string;
  onDecision: (decision: PlanDecision) => void;
  autoFocus?: boolean;
}

export function PlanApproval({ plan, onDecision, autoFocus = true, ...margin }: PlanApprovalProps) {
  const [revising, setRevising] = useState(false);

  const handleCommit = (value: string): void => {
    if (value === "approve") {
      onDecision({ kind: "approve" });
    } else {
      setRevising(true); // reveal the feedback input
    }
  };

  return (
    <Box flexDirection="column" {...margin}>
      <MarkdownText text={plan} />
      {revising ? (
        <FreeTextInput
          label="Type feedback:"
          onSubmit={(feedback) => onDecision({ kind: "revise", feedback })}
          onCancel={() => setRevising(false)} // Esc → back to the choice bar
        />
      ) : (
        <ChoiceRow
          choices={PLAN_CHOICES}
          onCommit={handleCommit}
          onCancel={() => setRevising(true)} // Esc → revise, never approve
          autoFocus={autoFocus}
        />
      )}
    </Box>
  );
}
