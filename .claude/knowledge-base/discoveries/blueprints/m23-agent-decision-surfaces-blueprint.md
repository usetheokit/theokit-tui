# BLUEPRINT — M23: Renderer V4 Agent-Decision Surfaces (ApprovalPrompt · QuestionPrompt · PlanApproval)

**Slug:** `m23-agent-decision-surfaces` · **Type:** DISCOVER blueprint (prior art + design) · **Date:** 2026-07-09 · **Milestone:** M23 (`ROADMAP.md § M23`, deps: M22)

---

## Coverage Corner 1 — Prior Art (patterns + citations)

Three peers implement the full agent-decision vocabulary; the rest are partial. All paths are under `.claude/knowledge-base/references/`.

### A. ApprovalPrompt / permission flow

**Canonical choice sets (verified).** Every mature peer converges on a **once / session / reject** spine, extended by policy-persistence and a "modify" escape:

| Peer | Enum / values | file:line (verified) |
|---|---|---|
| **gemini-cli** | `ToolConfirmationOutcome`: `proceed_once`, `proceed_always`, `proceed_always_and_save`, `proceed_always_server`, `proceed_always_tool`, `modify_with_editor`, `cancel` | `gemini-cli/packages/core/src/tools/tools.ts:1095-1101` |
| **codex** | `ReviewDecision`: `Approved`, `ApprovedForSession`, `Denied` (continue), `Abort` (halt), `TimedOut`, `+ExecpolicyAmendment/+NetworkPolicyAmendment` | `codex/codex-rs/protocol/src/protocol.rs:4046-4078` |
| **opencode** | reply string union: `"once"` / `"always"` / `"reject"`; UI option labels `{ once: "Allow once", always: "Allow always", reject: "Reject" }` | `opencode/packages/tui/src/routes/session/permission.tsx:20, 405-406` |

**The canonical minimal triad is `once` / `always` / `reject`** — exactly the ROADMAP's `always/once/reject`. opencode is the tightest match (a 3-value string union + horizontal button bar). gemini-cli/codex layer *policy persistence* (`always_and_save`, `ApprovedForSession`, execpolicy amendments) — **out of scope for M23** (that's app/policy state, and per the ROADMAP constraint the lib must not own it).

**Two distinct "reject" semantics exist in the wild** (codex `Denied` vs `Abort`, opencode reject-with-reason): "reject this action, keep going" vs "reject and stop the turn". M23 emits a single `"reject"` token — the *app* decides continue-vs-halt (callback-only). This is an ADR-worthy note (D5).

**How the pending action is previewed:**
- **command** → syntax-highlighted `$ <cmd>` string in a bordered/plain box (gemini `ToolConfirmationMessage.tsx:701-792`; opencode `permission.tsx:271-283`; codex `approval_overlay.rs:675-809`).
- **diff (edit/write tool)** → **rendered INLINE** in gemini (`DiffRenderer` in a `borderStyle="round"` box, `ToolConfirmationMessage.tsx:603-629`) and opencode (`EditBody`, scrollable unified/split, `permission.tsx:22-87`). codex renders the diff in a **separate full-screen view**, not inline. **Gemini/opencode validate the "compose a diff viewer inside the approval" idiom** — this is precisely the DiffViewer-composition seam M23 requires.
- **free body / description** → plain text with a type-specific title (opencode task/webfetch bodies, `permission.tsx:194-381`).

**Keyboard model:** two families — (a) **horizontal button bar** with ←/→ or `h`/`l` + Enter + Esc→reject (opencode `permission.tsx:544-626, 676-694`), (b) **vertical radio list** with ↑/↓ + Enter + single-key shortcuts (gemini `RadioButtonSelect`; codex list + per-option hotkeys `y`/`s`/`d`/`a`). Esc universally maps to the safe/reject option.

### B. QuestionPrompt / structured question

- **gemini-cli is the exemplar.** `Question` type: `{ question, header, type: 'choice'|'text'|'yesno', options?, multiSelect?, placeholder? }` (`gemini-cli/packages/core/src/confirmation-bus/types.ts:185-198`) — note the **dedicated per-question `header`** field (the ROADMAP's "per-question header").
- **Options + free-text coexistence** via an auto-injected **"Other" option** that reveals an inline text input when highlighted (`AskUserDialog.tsx` `ChoiceQuestionView` ~758-766, custom-input branch ~936-974). Multi-select adds "All of the above" + a "Done" commit affordance.
- **Answer emission:** single = `option.label` or custom text; multi = selected labels `join(", ")` — a plain callback `onAnswer(string)` / `onSelect(value)`.
- **ink-ui / opencode ui** provide only the select **primitive** (`onSelect(value)`, optional `groupBy`, custom render) — no multi + no free-text fallback. codex `cwd_prompt.rs:76-118` is single-select only (numeric `1`/`2` shortcuts + arrows). **tau / conduit: no structured-question flow.**

### C. PlanApproval / plan-mode

- **gemini-cli `ExitPlanModeDialog` is the ONLY full implementation** and is a near-perfect blueprint: **markdown plan body rendered via `MarkdownDisplay`** + a 2-choice approve set + a **feedback (revise) text branch**:
  - `onFeedback: (feedback: string) => void` (`ExitPlanModeDialog.tsx:37`)
  - choices `Auto = 'Yes, automatically accept edits'`, `Manual = 'Yes, manually accept edits'` (`:58-59`), plus `placeholder: 'Type your feedback...'` → `onFeedback(answer)` (`:263-275`), Esc = cancel/reject, `Ctrl+G` opens `$EDITOR`.
  - The Auto/Manual split is **gemini's approval-mode concept, not M23's** — for us this collapses to a single `approve`; `revise` = the feedback branch.
- **codex** renders plan markdown (`history_cell/plans.rs:114-126`) but the approve gate is a **post-plan implementation choice** ("Yes, implement" / "clear context and implement" / "stay in Plan mode", `chatwidget/plan_implementation.rs:28-114`) with **no markdown body in the dialog and no revise-with-feedback**. mastra/assistant-ui/opencode/tau/conduit: none. **Honest gap: plan-mode is a newer idiom; only gemini-cli has the full markdown-body + approve/revise shape M23 targets.**

---

## Coverage Corner 2 — Dependencies (the integration seams — READ)

All exist and were read. The three components are **pure composition of shipped primitives** — no new subsystems.

| Seam | File | What M23 consumes | Contract note |
|---|---|---|---|
| Diff slot | `src/diff-viewer.tsx:220` + `src/diff-model.ts` | `<DiffViewer patch maxLines contextLines />` | Malformed patch throws `TypeError` (`:201-213`) — fail-fast propagates. **Compose as a child, never forward `patch` through the prompt.** |
| Plan body | `src/markdown-text.tsx:140` | `<MarkdownText text />` | Degrades to literal text, never throws mid-turn. Streaming-safe. |
| Options | `src/select-list.tsx:65` + `src/select-list-model.ts` | `SelectList` / `deriveSelectList` | **See CRITICAL GAP below.** `onSubmit(values: string[])` — always an array (single = one). |
| Overlay host | `src/renderer/hooks/use-overlay.tsx:67,121` | `useOverlay().push/pop` | In-band stack; **top overlay owns Esc-dismiss** (`OverlayHost:55-65`). Nested overlays unmount the covered one (documented state-loss limitation). |
| Input | `src/renderer/input/use-input.ts:19` | `useInput(handler, {isActive})` | Ref-counts raw mode; gate on `isFocused`. |
| Focus | `src/renderer/hooks/use-focus.ts:268` | `useFocus({autoFocus})` → `{isFocused}` | ESC-blur runs on priority channel *before* component handlers (`:197-206`) — the composer's re-focus dance (`chat-composer.tsx:401-408`) is the precedent to mirror if a prompt must survive its own Esc. |
| API-shape precedent | `src/chat-composer.tsx:20-52,469-485` | callback-only + declarative slash-menu | `onSubmit(text)`; **menu keys intercept before buffer keys and NEVER leak** (`:381, handleMenuKey`) — the keyboard-leak-negative test idiom the ROADMAP DoD demands. |
| Tool model | `src/tool-call.tsx:117-131` (`ToolCallCard`) | `children?: ReactNode` slot; `result?: ToolCardResult` union | **`ToolCallCard` is the exact `children`-slot + explicit-union precedent** for ApprovalPrompt's preview (see D1 lesson below). |
| Export surface | `src/index.ts` | add 3 components + their prop types | Follows the M22 block (`:122-140`). |

**CRITICAL GAP — SelectList is NOT a drop-in for a fixed choice bar.** `SelectList` (`src/select-list.tsx:152-177`) **always renders a `filter: …` line** and a windowed vertical list with `▲/▼` overflow and an `(i/n)` counter — it is designed for **many-item filterable** selection (the M22 generalization of the slash/mention menus). For a 3-item `once/always/reject` set this is wrong UX (a filter box over 3 fixed choices). Two clean options (ADR D4 below): reuse `SelectList` **only** for QuestionPrompt's real option lists, and build a **thin dedicated `ChoiceRow`** (horizontal button bar, opencode idiom) for the small fixed approval/plan choice sets — OR add a `filterable?: boolean` prop to SelectList to suppress the filter line. **Recommendation: dedicated `ChoiceRow` render over the same `windowFor` pure model** — reuses the *model* (DRY) without contorting the *filter-first list UI*.

---

## Coverage Corner 3 — Tools / Techniques

- **Deterministic oracles** via the itl-adapter (`tests/renderer/itl-adapter.tsx`, project convention): render → assert frame → feed keys via `stdin.write` → assert emitted callback + assert **the key did not leak** to a background handler (keyboard-leak negative, ROADMAP DoD). Precedent: `chat-composer.test.tsx`, `select-list.test.tsx`.
- **PTY e2e** for "one full approve flow" (ROADMAP DoD) via the `agent-tui` harness (references catalog, M19/M20 e2e angle).
- **Snapshot determinism**: monochrome-degrade path must be tested (marker glyphs survive color loss — M6 ladder, mirrored in `select-list.tsx:158-161`).

---

## Coverage Corner 4 — ADR-worthy Decisions (with alternatives)

### D1 — Preview modeling: `children` ReactNode slot, NOT a preview-shape prop union
**Decision.** ApprovalPrompt takes the preview as **`children: ReactNode`**. The app composes:
```tsx
<ApprovalPrompt title="Run command?" onDecision={onDecision}>
  <DiffViewer patch={patch} maxLines={40} />        {/* or */}
  <Text>$ rm -rf ./build</Text>                     {/* or any body */}
</ApprovalPrompt>
```
**Alternative rejected:** a discriminated `preview: {command} | {diff} | ReactNode` prop. This *forces prop-forwarding* — the prompt would forward `patch`/`maxLines` into DiffViewer, exactly the **M16 D2 coupling** the ROADMAP forbids. `ToolCallCard` (`tool-call.tsx`) DID take a `result` union because tool results are a closed, tool-owned data shape; an **approval preview is open (any body)** — a `children` slot is the correct KISS/OCP choice and eliminates the coupling risk entirely. (Note: `ToolCallCard` *also* accepts `children` — precedent for the slot.)

### D2 — Callback-only contract, no app state machine (mitigates ROADMAP risk 1)
**Decision.** Each component owns **only its local UI state** (which choice is highlighted, free-text buffer). The decision leaves via a **single callback**; the component holds no notion of "approved/pending/policy". Signatures:
- `ApprovalPrompt: { title: string; children: ReactNode; choices?: ApprovalChoice[]; onDecision: (d: ApprovalDecision) => void; autoFocus?; }` where `ApprovalDecision = "once" | "always" | "reject"` (opencode-parity vocabulary).
- `QuestionPrompt: { header: string; question: string; options: SelectListItem[]; multi?: boolean; allowFreeText?: boolean; onAnswer: (a: QuestionAnswer) => void; }` where `QuestionAnswer = { values: string[]; text?: string }`.
- `PlanApproval: { plan: string /* markdown */; onDecision: (d: PlanDecision) => void; }` where `PlanDecision = { kind: "approve" } | { kind: "revise"; feedback?: string }`.

**Alternative rejected:** a `status`/`state` prop + `onStateChange` (a mini state machine). That leaks app semantics into the lib (ROADMAP risk 1) — the **M15 declarative precedent** (`chat-composer.tsx`: "Completion only edits the buffer — dispatch/execution stays with the app") is the binding rule.

### D3 — Choice-set: default to `once/always/reject`, allow override
**Decision.** `ApprovalPrompt` defaults `choices` to the canonical `["once","always","reject"]` (opencode `permission.tsx:405`), but accepts a caller-supplied `ApprovalChoice[] = { value: string; label: string }[]` so apps can render `yes/no`, or add `always-for-session`. The **emitted value is the choice's `value` string** — the lib never enumerates policy semantics.
**Alternative rejected:** hard-coding the 3-value union with no override (too rigid — peers show real variance: codex has 4+, gemini 7). A caller-driven array is OCP-correct and still callback-only.

### D4 — Choice render: a dedicated `ChoiceRow` over the `windowFor` model, NOT SelectList's filter UI
**Decision.** Build a small `ChoiceRow` (horizontal `❯`-marked button bar, ←/→ or number-key select, Enter commit, Esc→last/reject) for ApprovalPrompt + PlanApproval's fixed small choice sets. It **reuses the pure `windowFor`/model DRY core** where practical but not the `filter:`-first vertical list. **QuestionPrompt reuses the full `SelectList`** (it has real, possibly-long, filterable option lists — the exact case SelectList was built for), composing it as a child.
**Alternative rejected:** forcing `SelectList` for the 3-item approval set — its always-on `filter:` line + counter is wrong for a fixed choice bar (verified `select-list.tsx:154`). **Alternative also considered:** add `filterable?: boolean` to SelectList to hide the filter — viable and lower-LoC, but muddies SelectList's single responsibility; ChoiceRow keeps concerns clean. *(This ChoiceRow-new vs SelectList-`filterable` fork is the one design fork worth confirming in /to-plan.)*

### D5 — Single `reject` token; app decides continue-vs-halt
**Decision.** Emit one `"reject"`; do not model codex's `Denied` (continue) vs `Abort` (halt). The app's callback decides. Document that reject-with-reason (opencode's textarea stage) is an **app concern** — if wanted, the app composes a follow-up QuestionPrompt.

### D6 — QuestionPrompt free-text via an "Other" sentinel option (gemini idiom)
**Decision.** When `allowFreeText`, inject a synthetic "Other…" `SelectListItem`; selecting it reveals a mini text input (reuse the composer's grapheme `text-buffer.ts` reducer, NOT the full ChatComposer). Answer = `{ values, text }`. This composes the **M22 SelectList + M15 text-buffer**, no new input engine (parsimony rung 4). **Alternative rejected:** a separate always-visible text field below options (gemini has this as `type:'text'`) — deferred; the "Other" sentinel is the minimal coexistence per the ROADMAP's "optional free-text".

### D7 — Overlay rendering is the app's choice, not baked in
**Decision.** The three components render **in-band** by default (like every M1–M21 component). An app that wants a modal wraps them in `useOverlay().push(<ApprovalPrompt…/>)` (M22). Do NOT make ApprovalPrompt call `useOverlay` internally — that would couple it to the overlay provider and re-introduce app-orchestration into the lib. **Caveat to document:** the overlay's top-level Esc-dismiss (`use-overlay.tsx:55-65`) competes with a prompt's own Esc→reject; when rendered inside an overlay, the app should let Esc pop the overlay (and treat unmount as no-decision) OR the prompt's Esc fires `reject` first. This Esc-arbitration is the M23 analog of the composer's ESC re-focus dance (`chat-composer.tsx:401-408`) — call it out in the plan's edge cases.

---

## Recommended approach per component

**ApprovalPrompt** — `title` line + **`children` preview slot** (app passes `<DiffViewer/>`, `<Text>$ cmd</Text>`, or any body) + a `ChoiceRow` of `once/always/reject` (override-able). Decision via `onDecision`. Diff-inline case is *pure composition* — the app builds `<ApprovalPrompt><DiffViewer patch={p}/></ApprovalPrompt>`; the prompt never touches `patch`. (Prior art: gemini `ToolConfirmationMessage.tsx:603-629`, opencode `permission.tsx:22-87, 405`.)

**QuestionPrompt** — per-question `header` + `question` text + composed `<SelectList items multi>` for options + optional "Other" free-text branch. Answer via `onAnswer({values, text})`. (Prior art: gemini `confirmation-bus/types.ts:185-198`, `AskUserDialog.tsx` ChoiceQuestionView.)

**PlanApproval** — `<MarkdownText text={plan}/>` body + `ChoiceRow` `approve/revise`; `revise` opens a feedback text branch → `onDecision({kind:"revise", feedback})`. (Prior art: gemini `ExitPlanModeDialog.tsx:37,58-59,263-275` — the sole full reference; markdown body + approve + feedback-revise.)

---

## Edge cases (feed /edge-case-plan)

1. **Keyboard leak (DoD negative):** a prompt's ←/→/Enter/Esc must be consumed and NOT reach a background composer/thread handler (mirror `chat-composer.tsx` `handleMenuKey` "return true = consumed"). Assert via a spy on a sibling handler.
2. **Malformed diff in the slot:** `<DiffViewer>` throws `TypeError` on bad patch (`diff-viewer.tsx:201`). Since ApprovalPrompt only *renders children*, the throw propagates from the child at the app boundary (Ink error boundary — `tool-call.tsx:194-204` documents this exact swallow). Document: validation is the caller's, not the prompt's.
3. **Empty options** in QuestionPrompt (`SelectList` handles `count===0` → `(0/0)`, `select-list-model.ts:38-45`) — Enter with no selection + no free-text = no-op (composer's whitespace-only precedent).
4. **Multi-select commit** — Enter with zero selected: emit `{values:[]}` or block? (opencode "Done"/"All" idiom — decide in plan).
5. **Esc arbitration under overlay** (D7) — Esc pops overlay vs fires reject; define which wins.
6. **Monochrome degrade** — `ChoiceRow` active marker must be a glyph (`❯`), not color-only (M6 ladder, `select-list.tsx:158`).
7. **Streaming plan body** — `MarkdownText` is streaming-safe (unclosed fence renders as code); PlanApproval body can update while the choice row is focused.
8. **`revise` with empty feedback** — allowed (bare "keep planning") vs require text — decide (gemini sends canned text on Ctrl+G edit, `ExitPlanModeDialog.tsx:167-168`).

## Constraint-risk flags (ROADMAP top risks)

- **RISK 1 — app-semantics leak:** mitigated by **D2** (callback-only, local-UI-state-only) + **D7** (overlay is app's call). No `status`/state-machine prop anywhere. Enforced by test: a component instance emits exactly one decision and holds no "approved" memory.
- **RISK 2 — prop-forwarding coupling (M16 D2):** mitigated by **D1** (`children` ReactNode slot for the preview; app composes DiffViewer/SelectList directly). **Zero diff/select props pass through the prompt.** Enforced by API review: ApprovalPrompt's props contain no `patch`/`maxLines`/`contextLines`/`items`.

---

## Proposed phase decomposition (3–4 phases)

- **Phase 1 — `ChoiceRow` primitive + ApprovalPrompt.** Build `ChoiceRow` (horizontal button bar, keyboard + monochrome-degrade + leak-negative tests). Build `ApprovalPrompt` (`title` + `children` slot + `ChoiceRow`, default `once/always/reject`, override-able). Integration test: `<ApprovalPrompt><DiffViewer/></ApprovalPrompt>` round-trip. Export. *(Establishes the callback-only + composition contract for the milestone.)*
- **Phase 2 — QuestionPrompt.** `header`+`question` + composed `SelectList` (single/multi) + "Other" free-text branch (M15 text-buffer). `onAnswer({values,text})`. Tests: single, multi, free-text coexistence, empty options.
- **Phase 3 — PlanApproval.** `MarkdownText` body + `ChoiceRow` approve/revise + revise→feedback text branch. Tests: approve, revise-with/without-feedback, streaming body.
- **Phase 4 — Wiring + e2e + example.** Scripted decision round-trip **example** (`examples/interaction.tsx` extends the M22 example), **PTY e2e** of one full approve flow (`agent-tui` harness), overlay-integration test (render prompt via `useOverlay`, Esc arbitration), index exports, CHANGELOG, coverage gate. *(Wiring triad: the example is the caller; the PTY e2e is the integration test; the leak-negative + decision assertions are the observable behavior.)*

---

**Honest caveats:** (1) PlanApproval has exactly **one** full prior-art reference (gemini `ExitPlanModeDialog`) — lower cross-peer confidence than Approval/Question; the design leans on it plus the local `MarkdownText`+`ChoiceRow` composition, which is low-risk. (2) The **ChoiceRow-new vs SelectList-`filterable`-prop** decision (D4) is the one design fork to confirm in `/to-plan`. (3) All non-gemini "reject-with-reason" and "policy-persistence" affordances are deliberately **out of scope** (app concerns) per the callback-only constraint — noted so `/edge-case-plan` doesn't re-scope them in.

## ADRs

- **ADR-1 (D1):** ApprovalPrompt preview is a `children` ReactNode slot — never a diff-prop-forwarding union. Alternatives: discriminated preview prop (rejected — reintroduces M16 D2 coupling).
- **ADR-2 (D2):** Callback-only decision contract; components hold only local UI state. Alternatives: `status` + `onStateChange` state machine (rejected — leaks app semantics).
- **ADR-3 (D4):** New `ChoiceRow` primitive for fixed small choice sets; `SelectList` reused only for QuestionPrompt's filterable option lists. Alternatives: `filterable?` prop on SelectList (rejected — muddies SRP).
