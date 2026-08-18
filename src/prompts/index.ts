// Public barrel for the prompts domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export { SelectList } from "./select-list.js";

export type { SelectListProps } from "./select-list.js";

export { deriveSelectList, windowFor } from "./select-list-model.js";
export type {
  SelectListItem,
  SelectListView,
  // T3.4 — where the selected row sits. `trailing` (the default, unchanged) keeps it at the bottom;
  // `centred` keeps it in the middle, which is what an overlay walking backwards through history
  // needs. An option on the existing clamp, never a second function beside it.
  WindowAnchor,
  WindowView,
} from "./select-list-model.js";

// M23 — agent-decision surfaces.
export { ChoiceRow } from "./choice-row.js";

export type { ChoiceRowProps } from "./choice-row.js";

export { ApprovalPrompt } from "./approval-prompt.js";

export type { ApprovalPromptProps } from "./approval-prompt.js";

export {
  PermissionPrompt,
  DEFAULT_PERMISSION_CHOICES,
} from "./permission-prompt.js";

export type { PermissionPromptProps } from "./permission-prompt.js";

export { QuestionPrompt, OTHER_OPTION_VALUE } from "./question-prompt.js";

export type { QuestionPromptProps } from "./question-prompt.js";

export { PlanApproval } from "./plan-approval.js";

export type { PlanApprovalProps } from "./plan-approval.js";

// B-003 — the presentational sibling of `SelectList`. `SelectList` owns keys and asks the user to
// choose; this one only shows where you are in a list something else is driving. It exists because
// the centred anchor and the hidden-row COUNTS were added to `windowFor` for exactly this view,
// and the view was never shipped — so the one measured consumer rebuilt the clamp by hand.
export { WindowedList } from "./windowed-list.js";

export type { WindowedListProps } from "./windowed-list.js";
