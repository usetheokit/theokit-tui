import type { ReactElement } from "react";

import type { ApprovalChoice } from "../agent/agent-decision.js";
import { PermissionPrompt } from "./permission-prompt.js";
import type { ReviewableHook } from "./workspace-consent.js";

const NAMED: Record<string, string> = { "\r": "\\r", "\n": "\\n", "\t": "\\t" };

/**
 * Show C0/C1 control characters and DEL as visible escapes, so what a prompt displays is what would
 * run. A literal backslash is doubled, so a real carriage return (`\r`) and the two characters
 * `\` + `r` (`\\r`) never look alike.
 */
export function escapeControl(text: string): string {
  return text.replace(/[\\\u0000-\u001f\u007f-\u009f]/g, (c) => {
    if (c === "\\") return "\\\\";
    const named = NAMED[c];
    if (named !== undefined) return named;
    return `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}

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
  /** Shown after `was:` when a modified hook carries no `previousCommand`. */
  unavailableLabel?: string;
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
  unavailableLabel = "(unavailable)",
  remainingLabel = (n) => `${n} more to review`,
}: HookReviewPromptProps): ReactElement {
  const choices: readonly ApprovalChoice[] = [
    { value: "approve", label: approveLabel },
    { value: "refuse", label: refuseLabel },
  ];
  const changed = hook.status === "modified";
  const lines = [`${changed ? changedLabel : newLabel} ${escapeControl(hook.event)}`];
  if (changed) {
    const previous =
      hook.previousCommand === undefined ? unavailableLabel : escapeControl(hook.previousCommand);
    lines.push(`${wasLabel} ${previous}`);
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
