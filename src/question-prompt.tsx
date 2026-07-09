import { Box, Text } from "ink";
import { useState } from "react";

import type { QuestionAnswer } from "./agent-decision-model.js";
import { FreeTextInput } from "./free-text-input.js";
import { SelectList } from "./select-list.js";
import type { SelectListItem } from "./select-list-model.js";
import { useTheoTheme } from "./theme.js";

// M23 QuestionPrompt (plan m23-agent-decision-surfaces T2.1, ADR D6): a
// per-question header + question text + a composed M22 SelectList (single or
// multi). When `allowFreeText`, a synthetic "Other…" option is injected; picking
// it reveals a mini text input (the M15 text-buffer reducer, NOT the full
// ChatComposer). The answer leaves via one `onAnswer({values,text})` callback;
// an empty submit is a no-op. Callback-only, no app state (the M15 rule).

/** The sentinel value of the injected free-text option (ADR D6). */
export const OTHER_OPTION_VALUE = "__theo_other__";

export interface QuestionPromptProps {
  /** The per-question header (emphasis). */
  header: string;
  /** The question text. */
  question: string;
  options: readonly SelectListItem[];
  /** Multi-select (space toggles). Default single. */
  multi?: boolean;
  /** Inject an "Other…" option that reveals a free-text input (ADR D6). */
  allowFreeText?: boolean;
  onAnswer: (answer: QuestionAnswer) => void;
  autoFocus?: boolean;
}

export function QuestionPrompt({
  header,
  question,
  options,
  multi = false,
  allowFreeText = false,
  onAnswer,
  autoFocus = true,
}: QuestionPromptProps) {
  const theme = useTheoTheme();
  const [pendingValues, setPendingValues] = useState<string[] | null>(null);

  const items: SelectListItem[] = allowFreeText
    ? [...options, { value: OTHER_OPTION_VALUE, label: "Other…" }]
    : [...options];

  const handleSubmit = (values: string[]): void => {
    const wantsText = allowFreeText && values.includes(OTHER_OPTION_VALUE);
    const real = values.filter((v) => v !== OTHER_OPTION_VALUE);
    if (wantsText) {
      setPendingValues(real);
      return;
    }
    if (values.length === 0) return; // empty submit is a no-op
    onAnswer({ values: real });
  };

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        {header}
      </Text>
      <Text>{question}</Text>
      {pendingValues === null ? (
        <SelectList
          items={items}
          multi={multi}
          onSubmit={handleSubmit}
          autoFocus={autoFocus}
        />
      ) : (
        <FreeTextInput
          label="Type your answer:"
          onSubmit={(text) => onAnswer({ values: pendingValues, text })}
          onCancel={() => setPendingValues(null)} // Esc → back to the options
        />
      )}
    </Box>
  );
}
