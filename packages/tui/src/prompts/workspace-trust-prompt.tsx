import type { ReactElement } from "react";

import type { ApprovalChoice } from "../agent/agent-decision.js";
import { escapeControl } from "./hook-review-prompt.js";
import { PermissionPrompt } from "./permission-prompt.js";

export interface WorkspaceTrustPromptProps {
  dir: string;
  description?: string;
  onDecision(d: "trust" | "quit"): void;
  /** Replace the default English wording. */
  toolType?: string;
  question?: string;
  trustLabel?: string;
  quitLabel?: string;
}

/** Ask whether to trust a directory. Esc quits (the last choice). */
export function WorkspaceTrustPrompt({
  dir,
  description,
  onDecision,
  toolType = "Do you trust the files in this folder?",
  question = "Trust this folder?",
  trustLabel = "Yes, I trust this folder",
  quitLabel = "No, exit",
}: WorkspaceTrustPromptProps): ReactElement {
  const choices: readonly ApprovalChoice[] = [
    { value: "trust", label: trustLabel },
    { value: "quit", label: quitLabel },
  ];
  return (
    <PermissionPrompt
      toolType={toolType}
      command={escapeControl(dir)}
      {...(description !== undefined ? { description } : {})}
      question={question}
      choices={choices}
      onDecision={(v) => onDecision(v === "trust" ? "trust" : "quit")}
    />
  );
}
