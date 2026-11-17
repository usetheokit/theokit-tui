import type { ReactElement } from "react";

import type { ApprovalChoice } from "../agent/agent-decision.js";
import { escapeControl } from "./escape-control.js";
import { PermissionPrompt } from "./permission-prompt.js";
import type { ReviewableHook } from "./workspace-consent.js";

export interface HookReviewPromptProps {
  hook: ReviewableHook;
  /** Hooks still waiting after this one. */
  remaining: number;
  onDecision(d: "approve" | "refuse"): void;
  /** Replace the default English wording. */
  toolType?: string;
  question?: string;
  approveLabel?: string;
  refuseLabel?: string;
  newLabel?: string;
  changedLabel?: string;
  wasLabel?: string;
  nowLabel?: string;
  remainingLabel?: (remaining: number) => string;
}

/** Review one project hook. Control characters are escaped; Esc refuses (the last choice). */
export function HookReviewPrompt({
  hook,
  remaining,
  onDecision,
  toolType = "Project hook",
  question = "Allow this hook to run?",
  approveLabel = "Yes, approve this hook",
  refuseLabel = "No, refuse it this session",
  newLabel = "[new]",
  changedLabel = "[changed]",
  wasLabel = "was:",
  nowLabel = "now:",
  remainingLabel = (n) => `${n} more to review`,
}: HookReviewPromptProps): ReactElement {
  const choices: readonly ApprovalChoice[] = [
    { value: "approve", label: approveLabel },
    { value: "refuse", label: refuseLabel },
  ];
  const changed = hook.status === "modified";
  const lines = [`${changed ? changedLabel : newLabel} ${escapeControl(hook.event)}`];
  if (changed && hook.previousCommand !== undefined) {
    lines.push(`${wasLabel} ${escapeControl(hook.previousCommand)}`);
  }
  lines.push(`${changed ? `${nowLabel} ` : ""}${escapeControl(hook.command)}`);
  const command = lines.join("\n");
  return (
    <PermissionPrompt
      toolType={toolType}
      command={command}
      {...(remaining > 0 ? { description: remainingLabel(remaining) } : {})}
      question={question}
      choices={choices}
      onDecision={(v) => onDecision(v === "approve" ? "approve" : "refuse")}
    />
  );
}
