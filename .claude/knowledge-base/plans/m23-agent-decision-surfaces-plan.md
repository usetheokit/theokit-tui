---
slug: m23-agent-decision-surfaces
milestone_id: M23
created_at: 2026-07-09
goal: Ship the three V4 agent-decision surfaces — ApprovalPrompt (action preview via a children slot + once/always/reject), QuestionPrompt (SelectList options + optional free-text, per-question header), PlanApproval (markdown plan body + approve/revise) — as callback-only, composition-first components over the M15/M16/M22 primitives, with zero prop-forwarding and no app state machine in the lib.
---

# Plan: m23-agent-decision-surfaces

## Goal

Deliver the agent-decision vocabulary every coding-agent surface ships: (1) an
**ApprovalPrompt** — a titled pending-action card whose preview is a **`children`
ReactNode slot** (the app composes `<DiffViewer/>` for an edit, `<Text>$ cmd</Text>`
for a command, or any body) with a keyboard-driven `once/always/reject` choice bar,
decision emitted via a single `onDecision` callback; (2) a **QuestionPrompt** — a
per-question `header` + question text + a composed **M22 `SelectList`** (single or
multi) with an optional **"Other…" free-text** branch, answer via `onAnswer`;
(3) a **PlanApproval** — a **M13 `MarkdownText`** plan body + an `approve/revise`
choice bar, revise opening a feedback text branch. All three are **callback-only**
(no app state machine — the M15 declarative precedent) and **composition-first**
(the diff/select/markdown children are composed by the app, NEVER prop-forwarded
through the prompt — the M16 D2 lesson). A new small **`ChoiceRow`** primitive backs
the fixed choice bars; `SelectList` is reused verbatim for the filterable option
lists. App-specific policy/persistence (always-and-save, reject-with-reason,
continue-vs-halt) is OUT — the app decides via the callback.

## Baseline Context

### Files that will be touched

| File | Role | Change |
|---|---|---|
| `src/choice-row.tsx` | NEW | `ChoiceRow` — horizontal `❯`-marked fixed choice bar (←/→/number/Enter/Esc), pure-ish component over OUR M19/M20 hooks |
| `src/approval-prompt.tsx` | NEW | `ApprovalPrompt` — `title` + `children` preview slot + `ChoiceRow` (default `once/always/reject`, override-able), `onDecision` |
| `src/question-prompt.tsx` | NEW | `QuestionPrompt` — `header`+`question` + composed `SelectList` + optional "Other…" free-text branch, `onAnswer` |
| `src/plan-approval.tsx` | NEW | `PlanApproval` — `MarkdownText` body + `ChoiceRow` approve/revise + revise→feedback text branch, `onDecision` |
| `src/agent-decision-model.ts` | NEW | pure types + helpers: `ApprovalDecision`/`ApprovalChoice`/`QuestionAnswer`/`PlanDecision`, `resolveChoiceKey` table, `DEFAULT_APPROVAL_CHOICES` |
| `examples/interaction.tsx` | extend | add a scripted decision round-trip (approval → question → plan) to the M22 primitives demo |
| `src/index.ts` | exports | the 3 components + `ChoiceRow` + the decision types |

### Current callers / dependents (READ — the composition seams)

- `src/diff-viewer.tsx:220` (`DiffViewer`) + `src/diff-model.ts` — the diff the app composes INTO ApprovalPrompt's `children` slot; malformed patch throws `TypeError` (`diff-viewer.tsx:201-213`) at the child boundary, never forwarded.
- `src/markdown-text.tsx:140` (`MarkdownText`) — PlanApproval's body; streaming-safe, never throws mid-turn.
- `src/select-list.tsx:65` (`SelectList`) + `src/select-list-model.ts` (`SelectListItem`, `deriveSelectList`) — QuestionPrompt's options, composed as a child (`onSubmit(values: string[])`).
- `src/composer-editor.ts` / `src/text-buffer.ts` (M15/M21) — the grapheme text-buffer reducer reused for the QuestionPrompt "Other…" input and the PlanApproval revise feedback (NOT the full ChatComposer).
- `src/renderer/input/use-input.ts:19` (`useInput`) + `src/renderer/hooks/use-focus.ts:268` (`useFocus`) — keyboard + focus; the composer's `handleMenuKey` "return true = consumed" idiom (`chat-composer.tsx:381`) is the keyboard-leak-negative precedent.
- `src/renderer/hooks/use-overlay.tsx:67,121` (`useOverlay`) — apps MAY push a prompt as an overlay; the top overlay owns Esc-dismiss (`OverlayHost:55-65`). The prompt does NOT call `useOverlay` itself (ADR D7).
- `src/tool-call.tsx:117-131` (`ToolCallCard`) — the `children?: ReactNode` slot precedent for the preview.
- `src/index.ts:122-140` — the M22 export block; the 3 new components follow it.

### Domain glossary

- **children preview slot** — ApprovalPrompt's `children: ReactNode`; the app composes the preview (diff/command/body). Never a diff-prop union (ADR D1).
- **choice bar / `ChoiceRow`** — a horizontal fixed set of `{value,label}` choices with a `❯` active marker, ←/→ + number-key + Enter navigation, Esc→last (safe/reject). Distinct from `SelectList` (which is a filterable windowed vertical list).
- **callback-only** — the component holds only local UI state (highlighted choice, free-text buffer); the decision leaves via ONE callback; no `status`/`state` prop, no app state machine (ADR D2).
- **"Other…" sentinel** — a synthetic `SelectListItem` in QuestionPrompt that, when selected, reveals a text input; answer carries `{ values, text }` (ADR D6, gemini idiom).
- **`QuestionAnswer`** — `{ values: string[]; text?: string }` (multi = many values; free-text = `text`).
- **`PlanDecision`** — `{ kind: "approve" } | { kind: "revise"; feedback?: string }`.

### Architecture boundaries affected

- `src/agent-decision-model.ts` is ink-free (types + a pure key-resolver table) — same posture as `select-list-model`/`pager-model`.
- The three components + `ChoiceRow` consume OUR M19/M20 hooks (ADR D-hooks, mirrors M22 A3) — new code, no Ink-drop debt.
- Rendering is in-band (ADR D7); NO `output-engine`/`renderer` change. Overlay usage is the app's call.
- No new dependency (parsimony rung 4): DiffViewer/MarkdownText/SelectList/text-buffer all already shipped.

## Prior Art

- **Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m23-agent-decision-surfaces-blueprint.md` (this cycle) — the peer synthesis, ADRs D1-D7, the SelectList-filter-UI gap, and the two constraint risks.
- **ApprovalPrompt:** opencode `packages/tui/src/routes/session/permission.tsx:20,405-406` (once/always/reject union + button bar), gemini-cli `packages/core/src/tools/tools.ts:1095-1101` (`ToolConfirmationOutcome`) + `ToolConfirmationMessage.tsx:603-629` (inline DiffRenderer-in-approval), codex `codex-rs/protocol/src/protocol.rs:4046-4078` (`ReviewDecision`).
- **QuestionPrompt:** gemini-cli `packages/core/src/confirmation-bus/types.ts:185-198` (`Question` w/ `header`+`multiSelect`), `AskUserDialog.tsx` ChoiceQuestionView ("Other" free-text branch).
- **PlanApproval:** gemini-cli `ExitPlanModeDialog.tsx:37,58-59,263-275` (markdown body + approve + `onFeedback` revise) — the sole full reference; codex `history_cell/plans.rs:114-126` (plan markdown render).
- **Ours:** `diff-viewer.tsx`, `markdown-text.tsx`, `select-list.tsx`, `composer-editor.ts`/`text-buffer.ts`, `tool-call.tsx:117-131` (children slot), `chat-composer.tsx:381` (menu-key-consumed leak idiom).

## ADRs

### D1 — ApprovalPrompt preview is a `children` ReactNode slot, NOT a diff-prop union
**Alternative rejected:** a discriminated `preview: {command} | {diff} | ReactNode` prop — forces the prompt to forward `patch`/`maxLines` into DiffViewer (the M16 D2 coupling the ROADMAP forbids). Chosen: `children: ReactNode`; the app composes `<ApprovalPrompt><DiffViewer patch={p}/></ApprovalPrompt>`, the prompt never touches diff props. Precedent: `ToolCallCard` accepts `children` (`tool-call.tsx:131`). Enforced by review: ApprovalPrompt props contain no `patch`/`maxLines`/`contextLines`.

### D2 — Callback-only decision contract; components hold only local UI state
**Alternative rejected:** a `status`/`state` prop + `onStateChange` (a mini state machine) — leaks app semantics into the lib (ROADMAP risk 1). Chosen: one callback per component (`onDecision`/`onAnswer`); local state is only the highlighted choice + the free-text buffer. The M15 rule ("dispatch/execution stays with the app") binds. Enforced by test: an instance emits exactly one decision and holds no "approved" memory.

### D3 — ApprovalPrompt choices default to `once/always/reject`, override-able
**Alternative rejected:** hard-code the 3-value union — too rigid (codex has 4+, gemini 7). Chosen: `choices?: ApprovalChoice[]` defaulting to `DEFAULT_APPROVAL_CHOICES = [{value:"once"},{value:"always"},{value:"reject"}]`; emitted value is the choice's `value` string; the lib never enumerates policy semantics.

### D4 — New `ChoiceRow` primitive for fixed choice bars; SelectList reused only for QuestionPrompt option lists
**Alternative rejected:** force `SelectList` for the 3-item approval set — its always-on `filter:` line + counter (`select-list.tsx:154`) is wrong UX for a fixed bar; OR add a `filterable?:boolean` prop to SelectList (muddies its SRP). Chosen: a thin `ChoiceRow` (horizontal bar, no filter). `SelectList` stays untouched and is composed verbatim inside QuestionPrompt (its exact filterable-list use case). DRY holds at the *model* level (shared decision types), not by contorting the list UI.

### D5 — Single `reject` token; the app decides continue-vs-halt
**Alternative rejected:** model codex's `Denied` (continue) vs `Abort` (halt). Chosen: emit one `"reject"`; continue-vs-halt and reject-with-reason are app concerns resolved in the `onDecision` callback (compose a follow-up QuestionPrompt if a reason is wanted).

### D6 — QuestionPrompt free-text via an injected "Other…" sentinel option (gemini idiom)
**Alternative rejected:** an always-visible separate text field below the options (gemini `type:'text'`) — deferred (YAGNI). Chosen: when `allowFreeText`, inject a synthetic "Other…" `SelectListItem`; selecting it reveals a mini text input (reuse the M15 text-buffer reducer). Answer = `{ values, text }`.

### D7 — Rendering is in-band; overlay usage is the app's call (prompt never calls `useOverlay`)
**Alternative rejected:** ApprovalPrompt calls `useOverlay().push` internally — couples the lib to the overlay provider and re-introduces app-orchestration. Chosen: the three components render in-band like every M1-M21 component; an app that wants a modal wraps them in `useOverlay().push(...)`. Esc-arbitration (overlay-pop vs prompt-reject) is documented as the app's call (edge case 5).

## Dependencies

No new runtime or dev dependency (Unbreakable Rule 9 / parsimony rung 4). Every seam
— `DiffViewer` (M16), `MarkdownText` (M13), `SelectList` (M22), the text-buffer
reducer (M15/M21), the M19/M20 input/focus hooks, `useOverlay` (M22) — is already
declared and shipped in this package. `## Dependencies` deliberately lists none:
`/deps-audit` runs against the existing `package.json`, unchanged.

## Critical paths

- `src/agent-decision-model.ts` — `resolveChoiceKey` (the keyboard oracle for every choice bar; a leak here mis-fires decisions).
- `src/approval-prompt.tsx` — the `children` slot + `onDecision` wiring (the composition contract for the milestone).
- `src/question-prompt.tsx` — the SelectList↔free-text branch (answer-shape correctness).

## Phase 1: ChoiceRow primitive + ApprovalPrompt

### T1.1 — `agent-decision-model.ts` (types + `resolveChoiceKey`) + `ChoiceRow` component

#### Objective
A pure decision-model module (types + a table-driven `resolveChoiceKey(input, key, count, index)` → `{type:"move",index}` | `{type:"commit"}` | `{type:"cancel"}` | undefined) and a `ChoiceRow` component that renders a horizontal `❯`-marked `{value,label}[]` bar over OUR M19/M20 hooks, binds ←/→ (+ optional number keys) to move, Enter to commit the active choice, Esc to cancel (→ last/safe choice). Monochrome-degrade: the `❯` glyph marks the active choice without color.

#### Why this step
ChoiceRow is the shared spine of ApprovalPrompt and PlanApproval; building it first with its own leak-negative + degrade tests establishes the keyboard contract once (DRY) before two consumers depend on it.

#### Evidence
Blueprint ADR D4 + Coverage Corner 1.A keyboard model (opencode button bar `permission.tsx:544-626`); `select-list.tsx:158-161` (glyph-marker degrade precedent); `chat-composer.tsx:381` (leak-consumed idiom).

#### TDD
- RED `agent-decision-model.test.ts`: `resolveChoiceKey` — `test_right_arrow_moves_to_next_choice`, `test_right_arrow_wraps_at_last`, `test_left_arrow_wraps_at_first`, `test_number_key_selects_nth_choice`, `test_enter_commits_active`, `test_escape_cancels`, `test_unbound_key_returns_undefined`. Assert on the returned action object (pure, no render).
- RED `choice-row.test.tsx` (itl-adapter): `test_renders_choices_with_active_marker`, `test_right_arrow_moves_marker`, `test_enter_calls_onCommit_with_active_value`, `test_escape_calls_onCancel`, `test_marker_survives_no_color_theme`, `test_key_is_consumed_not_leaked_to_sibling_handler` (spy on a sibling `useInput`).
- GREEN: table-driven resolver (complexity ≤10) + the component.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `resolveChoiceKey` is pure, table-driven, 100% line-covered; complexity ≤10.
- [ ] `ChoiceRow` active marker is a `❯` glyph present under `themes["no-color"]`.
- [ ] A ChoiceRow keystroke does NOT reach a sibling `useInput` handler (leak-negative green).
- [ ] `pnpm gates` green.

#### DoD
- [ ] `agent-decision-model.ts` + `choice-row.tsx` land with co-located tests, 100% line coverage on the new pure module, CHANGELOG `[Unreleased] § Added` updated.

### T1.2 — `ApprovalPrompt` (children slot + ChoiceRow + onDecision)

#### Objective
`ApprovalPrompt({ title, children, choices?, onDecision, autoFocus? })`: renders `title`, then the `children` preview slot verbatim, then a `ChoiceRow` defaulting to `DEFAULT_APPROVAL_CHOICES` (`once/always/reject`). Enter on a choice → `onDecision(value)`; Esc → `onDecision("reject")` (safe default). Holds no app state.

#### Why this step
This is the milestone's flagship composition contract — proving `<ApprovalPrompt><DiffViewer/></ApprovalPrompt>` round-trips with zero diff-prop-forwarding validates D1+D2 for the whole surface.

#### Evidence
Blueprint ADR D1/D2/D3/D5; opencode `permission.tsx:405`; `tool-call.tsx:117-131` (children slot); `diff-viewer.tsx:220`.

#### TDD
- RED `approval-prompt.test.tsx` (itl-adapter): `test_renders_title_and_children_preview`, `test_default_choices_are_once_always_reject`, `test_enter_on_always_emits_always`, `test_escape_emits_reject`, `test_custom_choices_override_default`, `test_composes_a_DiffViewer_child_without_forwarding_patch` (render `<ApprovalPrompt><DiffViewer patch={PATCH}/></ApprovalPrompt>`, assert diff lines appear AND ApprovalPrompt received no `patch` prop — by construction), `test_emits_exactly_one_decision_and_holds_no_state` (two Enters → one call).
- GREEN: compose `ChoiceRow`; no diff/preview logic inside.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] ApprovalPrompt props contain NO `patch`/`maxLines`/`contextLines`/`items` (D1 enforced by the type + review).
- [ ] Default choices `once/always/reject`; Esc → `reject`.
- [ ] A DiffViewer composed as a child renders inside the approval; the prompt forwards no diff props.
- [ ] Exactly one `onDecision` per commit; no post-decision state retained.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `approval-prompt.tsx` exported from `src/index.ts`; CHANGELOG updated; co-located tests 100% of the component's branches exercised.

## Phase 2: QuestionPrompt (SelectList options + optional free-text)

### T2.1 — `QuestionPrompt` (header + question + SelectList + "Other…" branch)

#### Objective
`QuestionPrompt({ header, question, options, multi?, allowFreeText?, onAnswer })`:
renders `header` (emphasis) + `question`, composes `<SelectList items={optionsPlusOther} multi={multi}/>`. On SelectList submit: if the "Other…" sentinel is among the values and `allowFreeText`, reveal a text input (M15 buffer); Enter there → `onAnswer({ values: realValues, text })`. Otherwise `onAnswer({ values })`. Empty submit (no selection, no text) is a no-op.

#### Why this step
QuestionPrompt is the only surface that REUSES SelectList (D4) — proving the composition (single, multi, and the free-text branch) confirms SelectList generalizes to a decision surface without modification.

#### Evidence
Blueprint ADR D6 + Coverage Corner 1.B; gemini `confirmation-bus/types.ts:185-198`; `select-list.tsx:65`; `select-list-model.ts:38-45` (count===0 handling); `composer-editor.ts` (buffer reducer).

#### TDD
- RED `question-prompt.test.tsx` (itl-adapter): `test_renders_header_and_question`, `test_single_select_answer_carries_one_value`, `test_multi_select_answer_carries_many_values`, `test_other_sentinel_reveals_free_text_input`, `test_free_text_answer_carries_text_and_no_sentinel_value`, `test_empty_submit_is_a_noop` (Enter with nothing selected + no text → no `onAnswer`), `test_no_free_text_when_allowFreeText_false` (no "Other…" injected), `test_empty_options_renders_without_crash`.
- GREEN: compose SelectList; the "Other…" injection + branch is the only new logic (keep ≤10 complexity via a helper).

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] Single → `{values:[v]}`; multi → `{values:[...]}`; free-text → `{values, text}` with no sentinel value leaking into `values`.
- [ ] `allowFreeText:false` injects no "Other…" option.
- [ ] Empty submit emits nothing; empty options do not crash.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `question-prompt.tsx` exported; CHANGELOG updated; branch coverage of the free-text/no-free-text/empty paths green.

## Phase 3: PlanApproval (markdown body + approve/revise)

### T3.1 — `PlanApproval` (MarkdownText body + ChoiceRow approve/revise + feedback branch)

#### Objective
`PlanApproval({ plan, onDecision })`: renders `<MarkdownText text={plan}/>` then a
`ChoiceRow` of `approve/revise`. `approve` → `onDecision({kind:"approve"})`. `revise`
→ reveal a feedback text input (M15 buffer); Enter → `onDecision({kind:"revise", feedback})`
(empty feedback allowed — bare "keep planning"). Esc from the choice bar → treated as
`revise` with no feedback (safe: never auto-approve).

#### Why this step
PlanApproval closes the decision vocabulary and reuses BOTH ChoiceRow (Phase 1) and
the free-text branch pattern (Phase 2) — a pure composition, lowest new-logic phase,
validates the ChoiceRow spine under a second consumer.

#### Evidence
Blueprint ADR D2 + Coverage Corner 1.C; gemini `ExitPlanModeDialog.tsx:37,263-275`; `markdown-text.tsx:140` (streaming-safe body).

#### TDD
- RED `plan-approval.test.tsx` (itl-adapter): `test_renders_plan_markdown_body`, `test_approve_emits_approve`, `test_revise_reveals_feedback_input`, `test_revise_with_feedback_emits_feedback`, `test_revise_with_empty_feedback_is_allowed`, `test_escape_never_auto_approves` (Esc → revise, not approve), `test_streaming_body_updates_while_choice_focused` (re-render with a longer `plan` prop, choice bar still responsive).
- GREEN: compose MarkdownText + ChoiceRow + the feedback branch.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `approve` → `{kind:"approve"}`; `revise` → `{kind:"revise", feedback?}`.
- [ ] Esc never yields `approve` (safe default).
- [ ] Streaming a longer `plan` does not break the choice bar.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `plan-approval.tsx` exported; CHANGELOG updated; approve/revise/empty-feedback/esc branches covered.

## Phase 4: Example + e2e + close-out

### T4.1 — scripted decision round-trip example + overlay integration + PTY e2e + house standard

#### Objective
Extend `examples/interaction.tsx` with a scripted decision round-trip (ApprovalPrompt
composing a DiffViewer → QuestionPrompt → PlanApproval), each pushed via `useOverlay`
to prove the overlay-integration + Esc-arbitration (edge case 5). Add a PTY e2e that
drives ONE full approve flow end-to-end (render → focus → arrow → Enter → assert the
emitted decision) via the existing e2e harness. Wire `src/index.ts` exports + types.

#### Why this step / Evidence
The example is the wiring-triad caller; the PTY e2e is the integration test the ROADMAP
DoD demands ("PTY e2e for one full approve flow"); the leak-negative + decision oracles
(Phases 1-3) are the observable behavior. Evidence: ROADMAP M23 DoD bullets 4-5;
`use-overlay.tsx:55-65` (Esc-dismiss arbitration); the M22 `examples/interaction.tsx`
+ existing PTY e2e pattern.

#### TDD
- RED: a PTY e2e (`tests/*.e2e` per the harness convention) that spawns the example, sends the approve keystrokes, and asserts the decision line on stdout. RED first = the example/exports don't exist yet.
- GREEN: the example + exports; e2e goes green.
- Overlay-integration test (itl-adapter): push an ApprovalPrompt via `useOverlay`, assert Esc pops the overlay (app-owned) and the prompt's own choice-Esc is documented (edge case 5).

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — terminal / PTY)
- PTY spawn failure or a truncated frame → the e2e asserts on a settled frame (poll-based waitFor, not a fixed sleep), matching the itl-adapter determinism posture; a flaky fixed-timeout e2e is forbidden (testing.md § 6).

#### Acceptance Criteria
- [ ] `examples/interaction.tsx` runs the three prompts as a scripted round-trip; smoke-clean.
- [ ] PTY e2e drives one full approve flow and asserts the emitted decision.
- [ ] All three components + `ChoiceRow` + decision types exported from `src/index.ts`.
- [ ] `pnpm gates` green twice consecutively.

#### DoD
- [ ] Example + e2e + exports land; CHANGELOG `[Unreleased]` complete; VERSION bump prepared for release; per-file size budget respected.

## Edge cases absorbed

Absorbed from the blueprint § Edge cases (MUST-FIX owners = the phase that ships the surface):
1. Keyboard-leak negative (T1.1 ChoiceRow + each prompt test).
2. Malformed diff in the slot throws at the child boundary — documented as caller's responsibility (T1.2 test asserts the prompt itself does not validate).
3. Empty options in QuestionPrompt (T2.1 `test_empty_options_renders_without_crash`).
4. Multi-select Enter with zero selected → `{values:[]}` no-op vs emit — DECIDED: empty submit is a no-op (T2.1).
5. Esc arbitration under overlay (T4.1 overlay-integration test + documented).
6. Monochrome degrade of the choice marker (T1.1 `test_marker_survives_no_color_theme`).
7. Streaming plan body (T3.1 `test_streaming_body_updates_while_choice_focused`).
8. Revise with empty feedback allowed (T3.1 `test_revise_with_empty_feedback_is_allowed`).

## Coverage Matrix

| Goal claim | Task(s) |
|---|---|
| ApprovalPrompt: action preview via children slot | T1.2 |
| ApprovalPrompt: once/always/reject, keyboard-driven, callback | T1.1 (ChoiceRow), T1.2 |
| ApprovalPrompt: diff via DiffViewer composition, no prop-forward | T1.2 (`test_composes_a_DiffViewer_child_without_forwarding_patch`) |
| QuestionPrompt: options single/multi via M22 SelectList | T2.1 |
| QuestionPrompt: optional free-text, per-question header | T2.1 |
| PlanApproval: markdown body + approve/revise | T3.1 |
| Deterministic oracles incl. keyboard-leak negatives | T1.1, T1.2, T2.1, T3.1 |
| PTY e2e for one full approve flow | T4.1 |
| Example (scripted decision round-trip) + smoke | T4.1 |
| gates/coverage/CHANGELOG | every task DoD + T4.1 |
| Callback-only (no app state machine) — risk 1 | T1.2 (`test_emits_exactly_one_decision_and_holds_no_state`), D2 |
| Composition not prop-forwarding — risk 2 | T1.2 (DiffViewer child test), D1 |

## Drawbacks & Risks

| # | Risk / drawback | Mitigation |
|---|---|---|
| 1 | `children`-slot preview shifts diff/body validation to the caller — a malformed diff throws from the DiffViewer child, not the prompt. | Documented as caller responsibility (edge case 2); the prompt's contract is "render what you're given" — the correct boundary (KISS), stated so a caller doesn't expect the prompt to guard. |
| 2 | PlanApproval leans on a single full prior-art reference (gemini `ExitPlanModeDialog`). | The design is a pure local composition (`MarkdownText` + `ChoiceRow` + the Phase-2 feedback pattern) — low novel surface, so thin cross-peer evidence stays low-risk. |
| 3 | ChoiceRow-vs-SelectList duplication could drift over time. | ChoiceRow is deliberately NOT a list (no filter, no window) — it shares the decision *types*, not the list UI; the SRP split is the point (ADR D4). |
| 4 | Esc semantics differ by context (choice-bar reject vs overlay-pop). | Documented (edge case 5), tested at T4.1; the prompt's own Esc is a safe default (reject/revise, never approve). |

## Failure scenarios (when I/O external)

The only external I/O is the terminal/PTY in T4.1's e2e. Handled: the e2e uses a
poll-based settled-frame assertion (no fixed sleep), and a spawn/truncation failure
fails the test loudly rather than hanging (testing.md § 6). All other surfaces are
pure render + in-memory callbacks — no network/DB/queue (the `## Dependencies`
section lists none), so no timeout/5xx/retry scenarios apply.

## Unresolved Questions

(none — every decision is resolved at plan time). The one open design fork from the
blueprint (ChoiceRow-new vs SelectList-`filterable`-prop) is RESOLVED in ADR D4 (new
ChoiceRow). The multi-select empty-submit behavior is RESOLVED as a no-op (edge case 4).

## Test Plan

- **Unit (pure):** `agent-decision-model.test.ts` — `resolveChoiceKey` table, 100% line coverage.
- **Component (itl-adapter):** `choice-row`, `approval-prompt`, `question-prompt`, `plan-approval` — keyboard oracles, decision-callback assertions, leak-negatives, monochrome degrade, streaming body.
- **Integration:** overlay-pushed ApprovalPrompt (Esc arbitration); `<ApprovalPrompt><DiffViewer/></ApprovalPrompt>` composition round-trip.
- **E2E (PTY):** one full approve flow via the e2e harness.
- **Regression harness:** the M22 SelectList tests stay unchanged (QuestionPrompt composes it without modification) — proof the reuse is non-invasive.

## Global Definition of Done

- [ ] All 4 phases' DoD checked.
- [ ] ApprovalPrompt / QuestionPrompt / PlanApproval / ChoiceRow + decision types exported from `src/index.ts`.
- [ ] No new dependency; no `output-engine`/`renderer` change.
- [ ] Quality gates: `pnpm gates` (prettier + lint + typecheck + test + build) green twice consecutively; new pure module 100% line-covered; complexity ≤10.
- [ ] Keyboard-leak negatives green for every prompt; DiffViewer composed with zero prop-forwarding; callback-only (no state machine) proven by test.
- [ ] PTY e2e of one approve flow green; example runs the scripted round-trip.
- [ ] CHANGELOG `[Unreleased]` complete; blueprint + plan cross-referenced.
