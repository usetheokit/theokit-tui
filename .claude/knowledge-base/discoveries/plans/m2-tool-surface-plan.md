# Discovery Plan: M2 Tool-use surface — ToolCall/ToolCallCard/ToolResult + status lifecycle

> **Version 1.1** (absorbs MUST FIX EC-1 + SHOULD TEST EC-2 from
> `reviews/m2-tool-surface-edge-cases-2026-07-06.md`) — Deep research over the cloned SOTA references to lock the M2 decisions for
> `@theokit/tui`: tool-call card anatomy (name/args/status), status lifecycle rendering
> (running → success/failed, spinner idiom), ToolResult collapsed/expanded + long-output
> truncation, shell-envelope (`{stdout, stderr, exitCode}`) rendering, spinner dependency
> choice (ink-spinner vs ink-ui pattern vs hand-rolled), test idioms for animated/status
> components, and the bench design. In scope: `gemini-cli` (production tool-message family —
> ToolMessage/ShellToolMessage/ToolResultDisplay + overflow tests), `assistant-ui/react-ink`
> (ToolFallback card + toolkit), `ink-ui` (spinner internals), `codex` (ratatui exec_cell —
> layout inspiration only). Output blueprint:
> `.claude/knowledge-base/discoveries/blueprints/m2-tool-surface-blueprint.md`.

**Slug:** `m2-tool-surface`
**Owner:** paulohenriquevn + Claude (assisted)
**Created:** 2026-07-06
**Time budget:** 6h (per-project breakdown in ADR D1)

## Context

`ROADMAP.md § M2` requires: `ToolCall`/`ToolCallCard` with status lifecycle
(running → success/failed), `ToolResult` (collapsed/expanded output; shell-envelope
`{stdout,stderr,exitCode}` aware), spinner while `running` (via `ink-spinner`), snapshot tests
across all statuses + long/truncated output. Declared risks: long tool output overflowing the
viewport; status transitions racing the stream. v0.2.0 (M1) shipped ChatThread/ChatComposer with
the identity-memo streaming contract — tool cards will live inside thread rows, so the same
memo/Static discipline applies. Per `rules/testing.md` (determinism) the spinner's animation
must be testable without flake (ink-ui's `frames` idiom from the M1 research). `ink-spinner` is
the FIRST new runtime dependency since M0 — its ink-5 compatibility and cost must be evidenced
(Rule 9 evaluation is mandatory in the plan's Dependencies table).

## Objective

Produce a blueprint that lets `/to-plan` write the M2 plan with zero unresolved questions on:
tool-card component decomposition and props, status→visual mapping, collapse/truncation
mechanics for long output, shell-envelope layout, spinner dependency decision, test strategy
for animated/status components, and the M2 bench design.

- [ ] All research questions answered with citations to `.claude/knowledge-base/references/`
- [ ] Cross-cutting comparison table populated for every in-scope reference project
- [ ] Recommendations give one concrete decision proposal per research question
- [ ] `/discover-confidence` verdict ≥ SHIPPABLE_WITH_CAVEATS

## In-Scope / Out-of-Scope

### In-Scope (per reference project)

| Project | In-scope subdirectories | Reason |
|---|---|---|
| `.claude/knowledge-base/references/gemini-cli/` | `packages/cli/src/ui/components/messages/ToolMessage.tsx` (165 LoC), `ShellToolMessage.tsx` (222), `ToolResultDisplay.tsx` (308), `ToolShared.tsx` (314), `ToolGroupMessage.tsx`, tests `ToolResultDisplayOverflow.test.tsx` + `ToolMessage.test.tsx` + `ShellToolMessage.test.tsx` | Production tool-card family: status lifecycle, shell envelope, overflow/truncation — the richest evidence |
| `.claude/knowledge-base/references/assistant-ui/packages/react-ink/` | `src/primitives/toolCall/ToolFallback.tsx`, `src/primitives/toolCall.ts`, `src/toolkit.ts` (+`toolkit.test.ts`), `src/primitives/messagePart/` (renderToolCall wiring) | Direct analog's tool-call card + toolkit contract |
| `.claude/knowledge-base/references/ink-ui/` | `source/components/spinner/` (4 files: spinner.tsx, use-spinner.ts, theme.ts) | Spinner implementation contrast (cli-spinners + timer hook) for the dependency decision |
| `.claude/knowledge-base/references/codex/` | `codex-rs/tui/src/exec_cell/` + `exec_command.rs` (SKIM only — layout inspiration) | High-craft shell-output cell layout (truncation/head-tail policy) in a production agent TUI |

### Out-of-Scope (explicit)

| Project / Subdir | Why excluded |
|---|---|
| `.claude/knowledge-base/references/bubbletea/`, `bubbles/` | Go — spinner/viewport inspiration already covered by ink-native evidence |
| `.claude/knowledge-base/references/ink/` | Framework contracts already mapped in M0/M1 blueprints (Static/useInput/testing) — no new ink surface needed for M2 |
| gemini-cli tool EXECUTION/scheduling logic (`packages/core`) | `@theokit/tui` renders; execution is `@theokit/sdk` (roadmap out-of-scope) |
| react-ink runtime/store internals | M7 boundary (same as M1 ADR D3) |
| codex beyond `exec_cell`/`exec_command` | Rust runtime irrelevant to rendering decisions |

## ADRs

### D1 — Time budget + stop conditions

**Decision:** `gemini-cli`: 3h; `assistant-ui/react-ink`: 1.5h; `ink-ui`: 0.5h; `codex`: 1h (skim). Total 6h.

**Rationale:** gemini-cli has the deepest production evidence (5 tool components + overflow
regression tests); react-ink contributes the analog card + toolkit contract; ink-ui is a
4-file read for the spinner decision; codex is bounded layout inspiration. Alternatives: equal
split (wastes budget); skipping codex (kept: roadmap explicitly maps codex to M2 for
tool-output layout).

**Stop condition — per question (mandatory):** When a question's Fase A returns empty matches
after 3 consecutive retries with different query variants, mark the question BLOCKED with
reason "Fase A exhausted — no hotspots found" and continue. Do NOT pad with unrelated hotspots.

**Stop condition — per project (mandatory):** Budget exhausted with questions pending → mark
them BLOCKED "budget exhausted" and continue; if every remaining project is in the same state,
emit `<promise>BLUEPRINT_BLOCKED</promise>` (never `BLUEPRINT_COMPLETE` from a partial state).

**Anti-pattern:** NEVER fabricate Fase B answers (Unbreakable Rule 3).

**Consequences:** Blocked questions surface in the blueprint as next-discovery seed.

### D2 — Spinner dependency decision is evidence-first, not roadmap-literal

**Decision:** Q5 evaluates `ink-spinner` (roadmap-named) AGAINST the ink-ui pattern
(cli-spinners + interval hook, ~4 small files) and a minimal hand-rolled frame hook — the
blueprint recommends with evidence (size, deps, ink-5 peer compat, testability); the roadmap's
"via ink-spinner" is the default UNLESS the evidence disqualifies it (peer conflict with
ink ^5 would be disqualifying).

**Rationale:** Rule 9 requires evaluated alternatives, not name-dropping; ink-spinner is tiny
but its peer range must accept ink 5 + react 18 (registry check at `/deps-audit` — the clone
tree may not carry it). ink-ui's spinner shows the exact internals we'd own if we hand-rolled.

**Alternatives considered:** adopt ink-spinner blind (rejected: violates Rule 9 evaluation);
always hand-roll (rejected: reinventing a maintained 30-line lib is vanity unless peers block).

**Consequences:** The M2 plan's Dependencies table carries the decision with the registry
evidence; if ink-spinner is disqualified, the fallback is a ~20-line internal hook modeled on
ink-ui's `use-spinner.ts`.

### D3 — Render-layer boundary (M7 unchanged): status arrives via props

**Decision:** All lifecycle evidence is read at the RENDER layer — how the analogs map a
status value to visuals (spinner/glyph/color) and how cards re-render on transition. State
management/scheduling stays out (M7).

**Rationale:** Same boundary as M1 ADR D3; roadmap risk "status transitions racing the stream"
is a RENDER concern here (does a transition repaint cleanly inside a memoized thread row?).

**Alternatives considered:** studying gemini-cli's tool scheduler now (rejected — YAGNI/M7).

**Consequences:** The M2 API will be `status`-prop-driven; M7's adapter emits transitions.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | Tool-card anatomy + status lifecycle rendering: how are name/args/status composed and how does each status (pending/running/success/failed/canceled) map to glyph/color/spinner? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolMessage.tsx`, `ToolShared.tsx`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/toolCall/ToolFallback.tsx` | Text-shape — files pre-validated; Grep `status\|Status` in `ToolShared.tsx` for the mapping table | Read `ToolMessage.tsx` + `ToolShared.tsx` end-to-end; read `ToolFallback.tsx` end-to-end | Status→visual mapping table with citations; card layout (header/args/body) decomposition; ToolCallCard v0 API proposal marked as proposal |
| Q2 | Long-output handling: collapsed vs expanded, truncation policy (head/tail? max lines?), overflow protection inside the thread | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolResultDisplay.tsx`, `.claude/knowledge-base/references/codex/codex-rs/tui/src/exec_cell/` | Grep `truncat\|maxHeight\|availableTerminalHeight\|collapse\|expand` in `ToolResultDisplay.tsx`; Glob `exec_cell/*` and skim the output-layout region | Read `ToolResultDisplay.tsx` end-to-end; codex exec_cell: `wc -l` first (EC-2) — > 800 lines → read only the truncation/layout region (grep `truncat\|head\|tail\|lines`) and record the sampling | Truncation/collapse contract for M2: constants, indicator text ("… +N lines"), interaction with Static/thread rows — citations per claim |
| Q3 | Shell-envelope rendering: how is `{stdout, stderr, exitCode}` laid out (stderr coloring, exit-code badge, empty-output case)? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ShellToolMessage.tsx`, `.claude/knowledge-base/references/codex/codex-rs/tui/src/exec_command.rs` | Text-shape — pre-validated | Read `ShellToolMessage.tsx` end-to-end; skim `exec_command.rs` for exit-code/stderr presentation | ToolResult shell-mode layout proposal: stderr distinction, exit-code visual, empty stdout handling — citations |
| Q4 | Testing status/animated components: how are spinner frames, status transitions and overflow asserted deterministically? | tests | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolResultDisplayOverflow.test.tsx`, `ToolMessage.test.tsx`, `ShellToolMessage.test.tsx` (sample if > 800 lines each), `.claude/knowledge-base/references/ink-ui/test/spinner.tsx` | `wc -l` first (EC discipline from M1); Grep `frames\|advance\|vi.useFakeTimers\|rerender` in the test files | Read the harness + representative cases of each (sampling recorded if large); re-read `ink-ui/test/spinner.tsx` frames idiom | Test-idiom table: spinner determinism (fake timers? frames dedup?), transition assertions, overflow oracles — `path:line` per row |
| Q5 | Spinner dependency: what exactly does a terminal spinner need (frames source, interval hook, unmount cleanup) and does `ink-spinner` fit ink ^5 + react ^18? | deps | `.claude/knowledge-base/references/ink-ui/source/components/spinner/` (all 4 files), `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json` (does production use ink-spinner?) + npm registry (deps-audit confirms peers) | Text-shape — pre-validated | Read all 4 spinner files end-to-end; adoption evidence PRE-VALIDATED (EC-1): `assistant-ui/packages/react-ink/package.json:46` = `"ink-spinner": "^5.0.0"`, `gemini-cli/packages/cli/package.json:54` = `"ink-spinner": "5.0.0"` — additionally grep each analog's ink-spinner USAGE site; peer ranges defer to /deps-audit registry | Dependency decision inputs: internals size (~LoC), deps (cli-spinners?), what ink-spinner would need to satisfy (peer table filled by /deps-audit) — D2 verdict ingredients |
| Q6 | What do the analogs bound/measure for long tool output (height constants, line caps) and what should the M2 bench measure (N cards + status transitions + long output under the M1 thread)? | tools | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolResultDisplay.tsx` (+ `ToolGroupMessage.tsx` height plumbing), M1 evidence `AppContainer.tsx:609` (staticAreaMaxItemHeight — already cited in the M1 blueprint) | Grep `availableTerminalHeight\|maxHeight\|MAX_\|lines` in the two files | Read the height-constant plumbing regions | M2 bench design: workload (thread + N tool cards + K transitions + long-output card), metrics (same harness), truncation constants adopted/adapted — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q4 | Covered |
| Dependencies | Q5 | Covered |
| Tools | Q6 | Covered |
| Techniques | Q1, Q2, Q3 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

| Checkpoint | Assertion | Action if fails |
|---|---|---|
| Before answering Qx | Every cited `.claude/knowledge-base/references/{...}` path exists (all pre-validated 2026-07-06) | Mark Qx BLOCKED "path not found", continue |
| Per-question Fase A budget | ≥ 1 hotspot OR 3 retries | BLOCKED "Fase A exhausted"; continue |
| Q4 sampling (M1 EC-3 discipline) | `wc -l` before reading; > 800 lines → sample harness + 2-3 representative cases, record the sampling | Never silent-truncate |
| Q5 registry gap | ink-spinner absent from clones → answer internals from ink-ui + defer peer check to `/deps-audit`, honestly noted | Do not fabricate peer data |
| After answering Qx | ≥ 1 citation `path:line` in the blueprint section | Re-iterate Qx (1 retry max) |
| Per-project budget | ADR D1 respected | BLOCKED remaining Qx; advance |
| Before promising complete | 4 corners populated + ≥ 1 ADR | Refuse promise, continue |

## Acceptance Criteria

- [ ] All 6 research questions answered OR explicitly BLOCKED with reason
- [ ] All four coverage corners populated in the blueprint
- [ ] Every citation resolves on disk
- [ ] ≥ 1 ADR section synthesizing decisions
- [ ] Blueprint proposes: ToolCallCard/ToolResult API, status→visual map, truncation/collapse
      contract, shell-envelope layout, spinner decision inputs, test strategy, bench design
- [ ] Time budget respected (ADR D1)
- [ ] `/discover-confidence` ≥ SHIPPABLE_WITH_CAVEATS
- [ ] Blueprint at `.claude/knowledge-base/discoveries/blueprints/m2-tool-surface-blueprint.md`

## Global Definition of Done

- [ ] All phases completed (plan → edge-cases → plan-confidence → execute → confidence)
- [ ] Final verdict recorded in the blueprint header
- [ ] No fabricated citations; Coverage Matrix 100%
- [ ] ADRs reference project rules: D2 cites Rule 9 (evaluated alternatives); D3 cites YAGNI +
      the M7 roadmap boundary; Context cites `rules/testing.md` determinism
