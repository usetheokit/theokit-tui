// M23 agent-decision model (plan m23-agent-decision-surfaces T1.1, ADR D2/D3):
// the ink-free types + the pure keyboard oracle every fixed choice bar shares.
// ApprovalPrompt / PlanApproval render a `ChoiceRow` over `resolveChoiceKey`;
// QuestionPrompt carries `QuestionAnswer`. No app state machine lives here — the
// decision leaves each component via a single callback (the M15 declarative rule).

/** The value a choice emits (default set: `once` | `always` | `reject`). */
export type ApprovalDecision = string;

/** One entry on a fixed choice bar. */
export interface ApprovalChoice {
  value: string;
  label: string;
}

/** A QuestionPrompt answer: selected option values + optional free text. */
export interface QuestionAnswer {
  values: string[];
  text?: string;
}

/** A PlanApproval decision: approve, or revise with optional feedback. */
export type PlanDecision = { kind: "approve" } | { kind: "revise"; feedback?: string };

/** The canonical approval triad (opencode parity — ADR D3). Override-able. */
export const DEFAULT_APPROVAL_CHOICES: readonly ApprovalChoice[] = [
  { value: "once", label: "Allow once" },
  { value: "always", label: "Allow always" },
  { value: "reject", label: "Reject" },
];

/** The minimal key shape the choice-bar oracle reads (projected from `Key`). */
export interface ChoiceKey {
  leftArrow: boolean;
  rightArrow: boolean;
  /** Vertical navigation (numbered/vertical ChoiceRow): down = next, up = prev. */
  upArrow: boolean;
  downArrow: boolean;
  return: boolean;
  escape: boolean;
}

/** The action a keypress resolves to on a choice bar. */
export type ChoiceKeyAction =
  | { type: "move"; index: number }
  | { type: "commit" }
  | { type: "cancel" };

/**
 * Resolve one keypress over a `count`-choice bar at active `index` to an action
 * (or `undefined` when the key is unbound). Pure: ←/→ (and ↑/↓ for the vertical
 * layout) move (wrapping), Enter commits the active choice, Esc cancels, a digit
 * `1..count` jumps to that choice. Arrows on an empty bar are a no-op.
 */
export function resolveChoiceKey(
  input: string,
  key: ChoiceKey,
  count: number,
  index: number,
): ChoiceKeyAction | undefined {
  if (key.return) return { type: "commit" };
  if (key.escape) return { type: "cancel" };
  if (count <= 0) return undefined;
  if (key.rightArrow || key.downArrow) return { type: "move", index: (index + 1) % count };
  if (key.leftArrow || key.upArrow) return { type: "move", index: (index - 1 + count) % count };
  if (/^[1-9]$/.test(input)) {
    const nth = Number(input) - 1;
    if (nth < count) return { type: "move", index: nth };
  }
  return undefined;
}
