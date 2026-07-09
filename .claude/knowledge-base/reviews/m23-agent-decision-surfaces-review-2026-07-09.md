# Review — m23-agent-decision-surfaces (2026-07-09)

**Verdict:** READY_TO_MERGE

## Method

Adversarial 2-perspective review of the M23 diff (commits `4748caa..b9cebd0`):
a Staff-Engineer architecture/wiring/composition reviewer (callback-only contract,
prop-forwarding, focus/input hazards, wiring triad, complexity) plus the standing
gate suite (`pnpm gates` — prettier, lint, typecheck, 949 tests, build) run twice
consecutively, and a node-pty e2e of one full approve flow.

## Findings (all resolved before merge)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| HIGH-1 | HIGH | `FreeTextInput` subscribed to input unconditionally (`isActive:true`) → could steal keys meant for another focused surface; fragile double raw-mode hold. | Gated `useInput` on `isFocused` (like every sibling — ChoiceRow/SelectList/ChatComposer). Free-text tests made deterministic with an atomic burst-retry (`typeWhenReady`); production is race-free (a human types after focus settles). |
| HIGH-2 | HIGH | No way to cancel out of the free-text branch (Esc was a silent no-op) — a dead-end UX, asymmetric with ChoiceRow's Esc. | `FreeTextInput` gained `onCancel`, fired on the M20 Esc-blur edge (the only way to lose focus in the exclusive branch). QuestionPrompt cancels back to the options; PlanApproval back to the choice bar. Regression tests added. |
| MED-1 | MEDIUM | `FreeTextInput` was a public export with only transitive coverage; no export-surface pin for any M23 symbol. | Added `src/free-text-input.test.tsx` (insert/backspace/empty-submit/Esc-cancel) + a `public_entry_exposes_agent_decision_surface` pin for all 5 components + the decision types. |
| MED-2 | MEDIUM | `ChoiceRow` did not resync `index`/`indexRef` when the `choices` prop shrank → stale marker + `undefined` commit for a dynamic choice set (ADR D3). | Added a clamp effect; regression test re-renders with a shorter `choices` and asserts the commit lands on the clamped choice. |
| LOW-1 | LOW | `resolveChoiceKey` resolves Enter/Esc before the empty-bar guard (commit/cancel not no-ops on an empty bar). | Left as documented — no caller renders an empty ChoiceRow; guarded by `if (choice)` at the commit site. |

## Confirmed clean

- ADR D1 (no prop-forwarding): `ApprovalPrompt` exposes no `patch`/`maxLines`/`contextLines`/`items`; the DiffViewer composes as a child (round-trip test).
- ADR D2 (callback-only): no `status`/state-machine prop; no stale-closure reads (QuestionPrompt `handleSubmit` reads `pendingValues` in render; `useInput` refreshes its handler ref each render).
- Malformed-diff throw propagates at the child boundary (caller's responsibility — matches the plan).
- `agent-decision-model.ts` pure, ink-free, `resolveChoiceKey` cyclomatic ≤ 10.
- Wiring triad: every exported symbol has a caller (example/test) + integration test + observable behavior. PTY e2e drives one full approve flow over the real raw-mode path through the V4 renderer.

## Evidence

- `pnpm gates` green twice consecutively (949 tests).
- New pure module `agent-decision-model.ts` 100% line-covered; new components 100% of their branches exercised.
- `tests/renderer/approval-pty-e2e.integration.test.ts` — real raw-mode approve flow → `DECISION=always`.
