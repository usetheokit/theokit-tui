# Discovery Plan: M3 Agent surface — AgentEvent/AgentTimeline/AgentStreaming

**Slug:** `m3-agent-surface`
**Owner:** paulohenriquevn + Claude (assisted)
**Created:** 2026-07-06
**Time budget:** 6h (per-project breakdown in ADR D1)

## Context

`ROADMAP.md § M3` — Agent surface: `AgentEvent` (thinking/action), `AgentTimeline` (ordered
event log), `AgentStreaming` (live in-progress indicator); MUST compose with M1/M2 primitives
(a timeline mixes messages + tool-calls); snapshot tests for a representative multi-event
turn. Depends on M2 (RELEASED-pending: review READY_TO_MERGE at `de0504f`). Roadmap risks:
(1) timeline layout with heterogeneous item heights; (2) event ordering under concurrency.
We own ChatThread's windowed `<Static>` history (M1) and the tool-card family (M2) — the
central design question is whether `AgentTimeline` builds ON ChatThread's windowing or is a
sibling with its own item dispatch.

## Objective

Answer the 6 research questions below with cited evidence from the local reference clones so
`/to-plan` can write the M3 implementation plan with zero unresolved design questions.

## In-Scope / Out-of-Scope

### In-Scope (per reference project)

- `gemini-cli` — production agent timeline: `HistoryItemDisplay` heterogeneous dispatch,
  pending-vs-static zones, `LoadingIndicator` (spinner + thought + elapsed + cancel hint).
- `assistant-ui/react-ink` — the API-sibling: `messagePart`/`thread`/`chainOfThought`/`loading`
  primitives (our npm-package shape).
- `codex` — second production opinion (Rust): `history_cell` heterogeneous cells,
  `status_indicator_widget`, `streaming/` — patterns only, no code reuse.
- `ink` — `<Static>` semantics only where the timeline evidence references it (M1 already
  studied it; no re-study).

### Out-of-Scope (explicit)

- Stream adapters / event transport (M7 owns `AgentEvent` ingestion; M3 renders props).
- Markdown rendering inside events (M4 code surface owns rich content).
- Keybind interactivity on timeline items (focus/expand — M6+).
- Theming beyond existing tokens (M6).

## ADRs

### D1 — Time budget + stop conditions

**Decision:** `gemini-cli`: 3h; `assistant-ui/react-ink`: 1.5h; `codex`: 1h (skim);
`ink`: 0.5h (only if Static questions surface). Total 6h.

**Rationale:** gemini-cli has the deepest production timeline (HistoryItemDisplay + pending
zone + LoadingIndicator with thought streaming); react-ink is the API shape we ship as a
package; codex is the orthogonal second source (Rust TUI, different layout engine).

**Stop condition — per question (mandatory):** Fase A returning empty matches on the named
hotspots → try ONE alternative Grep spelling; still empty → mark the question `blocked` with
the attempted patterns recorded. Never fabricate.

**Stop condition — per project (mandatory):** Budget exhausted with questions pending → mark
remaining questions `blocked (budget)` in the blueprint; they seed the next discovery.

**Anti-pattern:** NEVER fabricate Fase B answers (Unbreakable Rule 3).

**Consequences:** Blocked questions surface in the blueprint as next-discovery seed.

### D2 — AgentTimeline's relationship to ChatThread is evidence-first

**Decision:** Q2 studies how gemini splits static history vs the live pending zone and how
items are keyed/ordered, then decides: (a) AgentTimeline WRAPS ChatThread (events lowered to
messages), (b) AgentTimeline REUSES the windowed-Static pattern with its own event Row
dispatch, or (c) AgentTimeline composes both — the blueprint must pick ONE with evidence.

**Rationale:** Roadmap risk 1 (heterogeneous heights) and the M1 windowing invariants
(Static rows frozen; identity-memoized live tail) interact — a wrong wrapper choice forces a
rewrite at M4/M5 when diffs/charts join the timeline. This mirrors M2's D2 (evidence-first
dependency decision) applied to internal composition.

**Alternatives considered:** decide by API symmetry alone (rejected: the M1 window-growth
hazard and Static graduation semantics are load-bearing constraints, not cosmetics).

**Consequences:** The M3 plan's ADRs carry the composition verdict + the event-identity
contract (ids, ordering) it implies.

### D3 — Render-layer boundary (M7 unchanged): events arrive via props

**Decision:** All lifecycle evidence is read at the RENDER layer — how analogs display an
already-ordered event list. Scheduling/streaming transport is out of scope (M7).

**Rationale:** Same boundary as M1 D3 / M2 D3; roadmap risk 2 ("event ordering under
concurrency") is answered by an ORDERING CONTRACT on the props (ids + caller-ordered array +
duplicate guard), not by studying schedulers.

**Alternatives considered:** studying gemini's useGeminiStream event pipeline now (rejected —
YAGNI/M7).

**Consequences:** The M3 API will be `events`-prop-driven; M7's adapter emits ordered events.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | Event taxonomy + heterogeneous dispatch: how do analogs TYPE the timeline items (message/tool/thinking/info) and dispatch each to a renderer? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/types.ts`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/HistoryItemDisplay.tsx`, `.claude/knowledge-base/references/codex/codex-rs/tui/src/history_cell/`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/messagePart/` | Grep `HistoryItem\|type.*=.*"` in `types.ts`; Glob `history_cell/*` + `messagePart/*` and `wc -l` each (EC-2 sampling) | Read `HistoryItemDisplay.tsx` end-to-end; read the union/enum regions of `types.ts` and `history_cell` mod; read messagePart dispatch | Event-union table (analog → variants) + dispatch idiom; `AgentEvent` v0 union proposal (thinking/action/message scoping vs roadmap) marked as proposal — citations per row |
| Q2 | Timeline ordering + static/pending split: how does gemini key, order and freeze history items vs the live zone; what protects against duplicate/out-of-order arrival? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/HistoryItemDisplay.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx` (Static/pending regions — M1 evidence `AppContainer.tsx:609` staticAreaMaxItemHeight already cited in the M1 blueprint), `.claude/knowledge-base/references/codex/codex-rs/tui/src/insert_history.rs` | Grep `Static\|pendingHistory\|key=\|\.id` in `AppContainer.tsx` (sample — file > 800 lines, record regions); skim `insert_history.rs` | Read the Static/pending + key-assignment regions; map id semantics | D2 composition verdict inputs: wraps-ChatThread vs sibling-windowed vs compose; event-identity/ordering contract (ids, duplicate guard) for roadmap risk 2 — citations |
| Q3 | Thinking/streaming presentation: how are reasoning/thought events and the live "working" state rendered (glyph, dim/italic, thought subject, elapsed time, cancel hint)? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.tsx`, `.claude/knowledge-base/references/codex/codex-rs/tui/src/status_indicator_widget.rs`, `.claude/knowledge-base/references/codex/codex-rs/tui/src/history_cell/` (reasoning cell), `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/chainOfThought/`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/loading/` | Grep `thought\|Thought\|elapsed\|reasoning` across the named files; Glob the two react-ink primitive dirs | Read `LoadingIndicator.tsx` end-to-end; read the reasoning-cell + status-widget display regions; read chainOfThought/loading primitives | AgentEvent(thinking) visual contract + AgentStreaming v0 anatomy (spinner reuse from M2, thought line, elapsed?, cancel hint?) — citations; explicit YAGNI list |
| Q4 | Testing multi-event timelines: how are mixed static/pending scenes, item dispatch and ordering asserted; snapshot idioms for heterogeneous rows? | tests | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/HistoryItemDisplay.test.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.test.tsx` | `wc -l` first (EC-2); Grep `toMatchSnapshot\|lastFrame\|rerender` in both | Read the harness + representative cases (sampling recorded if > 800 lines) | Test-idiom table: mixed-scene snapshots, dispatch oracles, pending-zone assertions, ordering/duplicate negative cases — `path:line` per row; M3 strategy mapping onto our renderFrame/env-pin kit |
| Q5 | Dependencies: does the agent surface need ANY new package (elapsed-time ticker, id generation, thought cycling), or is everything covered by ink + ink-spinner + stdlib? | deps | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.tsx` (its imports), `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json` | Grep `^import` in `LoadingIndicator.tsx`; Grep `depend` in both package.json manifests | Trace each non-react import of the indicator (hooks like elapsed-time/phrase-cycler — internal or dep?); confirm react-ink adds no timeline-specific dep | Rule 9 verdict inputs: expected NO new runtime dep (elapsed = ~15-LoC internal hook; ids = caller-provided per D3) — evidence that analogs also hand-roll these — citations |
| Q6 | Bench design for heterogeneous timelines (roadmap risk 1): what do analogs bound for mixed-height items in Static, and what should the M3 bench measure? | tools | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx` (staticAreaMaxItemHeight region — M1 blueprint citation), `.claude/knowledge-base/references/codex/codex-rs/tui/src/insert_history.rs`, our `benchmarks/sampling.ts` + `benchmarks/tool-cards.bench.tsx` (M2 harness) | Grep `staticAreaMaxItemHeight\|maxItemHeight` in `AppContainer.tsx`; skim `insert_history.rs` height handling | Read the height-bounding regions; map to our windowed-Static invariants | M3 bench workload proposal: mixed timeline (messages + tool cards + thinking events) streaming under windowing, metrics (same harness), height-bound constants adopted/adapted — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q4 | Covered |
| Dependencies | Q5 | Covered |
| Tools | Q6 | Covered |
| Techniques | Q1, Q2, Q3 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Edge cases absorbed (from /discover-edge-cases 2026-07-06)

- **EC-1 (MUST-FIX, absorbed into Q1/Q3):** react-ink's `messagePart`/`chainOfThought`/
  `loading` primitives may be THIN RE-EXPORTS of web assistant-ui logic. If Fase B finds only
  re-export shims, follow EXACTLY ONE hop into the shared package for the render contract,
  record the boundary crossing in the citation, and do NOT chase further (budget guard).
- **EC-2 (MUST-FIX, absorbed into Q2):** If gemini shows NO duplicate/out-of-order guard at
  the render layer (ids come pre-ordered from useHistory), the ordering contract falls back
  to OUR M1 precedent (`assertUniqueIds`, caller-ordered array) — record as
  "internal precedent, analog silent", never fabricate analog evidence.
- **EC-3 (SHOULD, absorbed into Q5):** `LoadingIndicator` imports likely include CONTEXT
  plumbing (StreamingContext etc.). Classify each import as render-dep vs transport-plumbing
  (M7) — only render-deps feed the Rule 9 verdict.
- **EC-4 (SHOULD, absorbed into Q6):** `AppContainer.tsx` and codex files > 800 lines: EC-2
  sampling discipline (wc -l first, read named regions only, record the sampling) — already
  mandated per question; re-stated here as a hard checkpoint.

## Halt-loop Checkpoints

- After each question: citations verified on disk (`Path.exists`) before recording.
- After Q1-Q3 (techniques block): D2 composition verdict drafted — if evidence is
  insufficient, expand Q2's Fase B before proceeding (budget-permitting).
- Before blueprint synthesis: every question `done` or `blocked` with reason; EC sampling
  recorded for any file > 800 lines.

## Acceptance Criteria

- [ ] All 6 questions answered with `path:line` citations that resolve on disk (or honestly `blocked`)
- [ ] Blueprint drafted at `.claude/knowledge-base/discoveries/blueprints/m3-agent-surface-blueprint.md` with 4/4 corners populated and ≥ 1 ADR incl. the D2 composition verdict
- [ ] `python3 .claude/skills/discover-confidence/scripts/run_blueprint_score.py` on the blueprint returns verdict ≥ SHIPPABLE_WITH_CAVEATS
- [ ] Zero fabricated citations — `grep -oE '\.claude/knowledge-base/references/[^ )`":]+'` sweep passes existence check

## Global Definition of Done

- [ ] Blueprint SHIPPABLE(_WITH_CAVEATS) committed on `develop`
- [ ] `/to-plan` can start with zero unresolved design questions (D2 verdict + event union + streaming anatomy + test strategy + bench design all locked)
