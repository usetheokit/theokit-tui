import { Box, Text } from "ink";
import type { ReactNode } from "react";

import {
  type ApprovalChoice,
  type ApprovalDecision,
  DEFAULT_APPROVAL_CHOICES,
} from "../agent/agent-decision.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { useTheoTheme } from "../theme/theme.js";
import { ChoiceRow } from "./choice-row.js";

// M23 ApprovalPrompt (plan m23-agent-decision-surfaces T1.2, ADR D1/D2/D3/D5): a
// titled pending-action card. The PREVIEW is a `children` slot — the app composes
// `<DiffViewer/>` for an edit, `<Text>$ cmd</Text>` for a command, or any body;
// the prompt never touches diff/preview props (no prop-forwarding — the M16 D2
// lesson). Choices default to the canonical once/always/reject triad (override-
// able), Enter commits, Esc → reject (the safe default). The decision leaves via
// ONE `onDecision` callback; the component holds no app state (callback-only —
// the M15 declarative rule).

export interface ApprovalPromptProps extends LayoutMarginProps {
  /** The heading (e.g. "Run command?" / "Apply edit?"). */
  title: string;
  /** The preview — composed by the app (DiffViewer / command line / any body). */
  children: ReactNode;
  /** The choice bar; defaults to once/always/reject (ADR D3). */
  choices?: readonly ApprovalChoice[];
  /** Called with the chosen value; Esc yields `"reject"`. */
  onDecision: (decision: ApprovalDecision) => void;
  autoFocus?: boolean;
}

export function ApprovalPrompt({
  title,
  children,
  choices = DEFAULT_APPROVAL_CHOICES,
  onDecision,
  autoFocus = true,
  ...margin
}: ApprovalPromptProps) {
  const theme = useTheoTheme();
  return (
    <Box flexDirection="column" {...margin}>
      <Text color={theme.accent}>{title}</Text>
      {children}
      <ChoiceRow
        choices={choices}
        onCommit={onDecision}
        onCancel={() => onDecision("reject")}
        autoFocus={autoFocus}
      />
    </Box>
  );
}
