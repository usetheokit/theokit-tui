import { Box, Text } from "ink";
import type { ReactNode } from "react";

import type {
  ApprovalChoice,
  ApprovalDecision,
} from "../agent/agent-decision.js";
import { ChoiceRow } from "./choice-row.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";

// PermissionPrompt — the Claude Code tool-approval card:
//
//   ─────────────────────────────────────────────
//    Bash command
//
//      npm install 2>&1 | tail -8
//      Install SDK dev deps
//
//    Permission rule Bash(npm *) requires confirmation for this command.
//    /permissions to update rules
//
//    Do you want to proceed?
//    ❯ 1. Yes
//      2. No
//
// A top-ruled frame around a tool-type header, the command + description, an
// optional permission-rule note, the question, and a VERTICAL NUMBERED choice
// list (reusing ChoiceRow — the keyboard oracle already supports digit-jump).
// Enter commits the active choice; Esc is the safe default (the LAST choice —
// "reject/No"). Callback-only: the decision leaves via one `onDecision`.

/** The default Yes/No choices (reject is the last → the Esc safe default). */
export const DEFAULT_PERMISSION_CHOICES: readonly ApprovalChoice[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export interface PermissionPromptProps extends LayoutMarginProps {
  /** The tool-type header, e.g. `Bash command`. Non-empty. */
  toolType: string;
  /** The command / action being approved (rendered on its own line). */
  command: ReactNode;
  /** An optional one-line description under the command. */
  description?: string;
  /** An optional permission-rule note, e.g. `Permission rule Bash(npm *) …`. */
  ruleNote?: string;
  /** An optional secondary hint, e.g. `/permissions to update rules`. */
  hint?: string;
  /** The question line. Default `Do you want to proceed?`. */
  question?: string;
  /** The vertical numbered choices. Default Yes/No (Esc → the last one). */
  choices?: readonly ApprovalChoice[];
  /** Called with the chosen value; Esc yields the LAST choice's value. */
  onDecision: (decision: ApprovalDecision) => void;
  autoFocus?: boolean;
}

/** The command line + its optional description, indented under the header. */
function CommandBlock({
  command,
  description,
}: {
  command: ReactNode;
  description: string | undefined;
}) {
  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Text>{command}</Text>
      {description !== undefined && <Text dimColor>{description}</Text>}
    </Box>
  );
}

/** The optional permission-rule note + hint; renders nothing when both absent. */
function NoteBlock({
  ruleNote,
  hint,
}: {
  ruleNote: string | undefined;
  hint: string | undefined;
}) {
  if (ruleNote === undefined && hint === undefined) return null;
  return (
    <Box flexDirection="column" marginTop={1}>
      {ruleNote !== undefined && <Text dimColor>{ruleNote}</Text>}
      {hint !== undefined && <Text dimColor>{hint}</Text>}
    </Box>
  );
}

export function PermissionPrompt({
  toolType,
  command,
  description,
  ruleNote,
  hint,
  question = "Do you want to proceed?",
  choices = DEFAULT_PERMISSION_CHOICES,
  onDecision,
  autoFocus = true,
  ...margin
}: PermissionPromptProps) {
  // Boundary validation FIRST (F10 idiom).
  if (typeof toolType !== "string" || toolType.trim() === "") {
    throw new TypeError(
      `PermissionPrompt: toolType must be a non-empty string — got ${String(toolType)}`,
    );
  }
  const theme = useTheoTheme();
  const mono = isMonochrome(theme);
  const accent = mono ? {} : { color: theme.accent };
  // Esc → the last choice (the safe default: reject / No).
  const safeValue = choices[choices.length - 1]?.value;
  return (
    <Box
      flexDirection="column"
      width="100%"
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      {...(mono ? {} : { borderColor: theme.accent })}
      paddingX={1}
      {...pickMargin(margin)}
    >
      <Text {...accent}>{toolType}</Text>
      <CommandBlock command={command} description={description} />
      <NoteBlock ruleNote={ruleNote} hint={hint} />
      <Box flexDirection="column" marginTop={1}>
        <Text>{question}</Text>
        <ChoiceRow
          choices={choices}
          orientation="vertical"
          numbered
          onCommit={onDecision}
          onCancel={() => {
            if (safeValue !== undefined) onDecision(safeValue);
          }}
          autoFocus={autoFocus}
        />
      </Box>
    </Box>
  );
}
