# Discovery Plan: M1 Chat surface core — ChatThread + ChatComposer + streaming render

> **Version 1.1** (absorbs MUST FIX EC-1/EC-2 + SHOULD TEST EC-3 from
> `reviews/m1-chat-surface-edge-cases-2026-07-06.md`) — Deep research over the cloned SOTA references to lock the M1 decisions for
> `@theokit/tui`: ChatThread structure (`<Static>` history vs dynamic tail, windowing/memo),
> streaming append-in-place render (perf/flicker), ChatComposer multi-line input (`useInput`,
> text buffer, cursor), system-role extension of ChatMessage, test idioms for input/streaming/
> Static, and the benchmark extension for thread workloads. In scope:
> `assistant-ui/packages/react-ink` (direct analog — ThreadMessages windowing + ComposerInput/
> useTextBuffer), `gemini-cli` (production Static + InputPrompt/Composer), `ink` (Static +
> use-input sources), `ink-ui` (text-input). Output blueprint:
> `.claude/knowledge-base/discoveries/blueprints/m1-chat-surface-blueprint.md`.

**Slug:** `m1-chat-surface`
**Owner:** paulohenriquevn + Claude (assisted)
**Created:** 2026-07-06
**Time budget:** 6.5h (per-project breakdown in ADR D1)

## Context

`ROADMAP.md § M1` requires: `ChatMessage` with user/assistant/**system** roles, `ChatThread`
(scroll/viewport, `<Static>` for history), `ChatComposer` (multi-line input via `useInput`),
streaming render (message renders incrementally as tokens arrive, append-in-place), snapshot
tests per role + streaming sequence, readable in NO_COLOR. Declared risks: viewport/scroll
correctness with variable terminal height; streaming re-render perf/flicker. M0 shipped the
walking skeleton (v0.1.0 released): `ChatMessage` (user/assistant), theme stub, benchmark
harness with committed baseline (mean 11.246 ± 0.358 ms/frame on a 100-message + 300-token
workload rendered as a plain Box column — no windowing yet). Per `rules/testing.md` (determinism)
and the M0 review learnings (chalk import-time color pinning; Ink trailing-space trim; `<Static>`
items never re-render), M1's design must be locked by evidence before planning.

## Objective

Produce a blueprint that lets `/to-plan` write the M1 implementation plan with zero unresolved
questions on: thread composition (Static/tail split, windowing), streaming render state shape,
composer input handling (multi-line, submit semantics, cursor), role extension, test strategy
for interactive/streaming components, and the bench extension.

- [ ] All research questions answered with citations to `.claude/knowledge-base/references/`
- [ ] Cross-cutting comparison table populated for every in-scope reference project
- [ ] Recommendations give one concrete decision proposal per research question
- [ ] `/discover-confidence` verdict ≥ SHIPPABLE_WITH_CAVEATS

## In-Scope / Out-of-Scope

### In-Scope (per reference project)

| Project | In-scope subdirectories | Reason |
|---|---|---|
| `.claude/knowledge-base/references/assistant-ui/packages/react-ink/` | `src/primitives/thread/` (ThreadMessages.tsx + test), `src/primitives/composer/` (ComposerRoot/Input/Send, useTextBuffer.ts), `src/tests/ComposerInput.test.tsx`, `benchmarks/long-thread.bench.tsx` (windowed/memo modes) | Direct analog — thread windowing + multi-line composer already built in Ink |
| `.claude/knowledge-base/references/gemini-cli/` | `packages/cli/src/ui/AppContainer.tsx` (Static usage), `packages/cli/src/ui/components/Composer.tsx`, `packages/cli/src/ui/components/InputPrompt.tsx` (+ `.test.tsx`) | Production-scale Static history + input prompt (buffer, keybinds, submit) |
| `.claude/knowledge-base/references/ink/` | `src/components/Static.tsx`, `src/hooks/use-input.ts`, `src/hooks/use-paste.ts`, `test/static.tsx` (if present in `test/`) | The framework contracts we build on — Static semantics + input hook API |
| `.claude/knowledge-base/references/ink-ui/` | `source/components/text-input/` | Minimal single-line input idiom (contrast for the multi-line decision) |

### Out-of-Scope (explicit)

| Project / Subdir | Why excluded |
|---|---|
| `.claude/knowledge-base/references/codex/`, `bubbletea/` | Rust/Go — layout inspiration for M2/M4/M6; no bearing on Ink thread/composer APIs |
| `.claude/knowledge-base/references/bubbles/` | Go viewport/textarea — the roadmap maps it to M1/M5 as inspiration, but Ink-native evidence (react-ink + gemini-cli) is sufficient and cheaper; revisit only if Ink evidence is thin (ADR D2) |
| `assistant-ui` outside `packages/react-ink/` | Web packages — different surface |
| `gemini-cli` outside `packages/cli/src/ui/` | Agent/runtime logic is `@theokit/sdk` territory |
| react-ink runtime/store internals (`@assistant-ui/core`) | M7 owns the stream adapter; M1 renders from explicit props/state only |
| Any `dist/`, lockfiles beyond version pins | Build artifacts / noise |

## ADRs

### D1 — Time budget + stop conditions

**Decision:** `assistant-ui/packages/react-ink`: 3h; `gemini-cli`: 2h; `ink`: 1h; `ink-ui`: 0.5h. Total 6.5h.

**Rationale:** react-ink has BOTH target components already built in Ink (deepest dive);
gemini-cli is the production evidence for Static + input at scale; ink is consulted for the
framework contracts only; ink-ui is a 1-file contrast read. Alternatives: equal split (wastes
budget on low-yield repos); adding bubbles (rejected for now — see D2).

**Stop condition — per question (mandatory):** When a question's Fase A returns empty matches
after 3 consecutive retries with different query variants (pattern → kind-based → alternate
path → broader scope), mark the question BLOCKED with reason "Fase A exhausted — no hotspots
found" and continue to the next. Do NOT pad with unrelated hotspots from a different question's
scope.

**Stop condition — per project (mandatory):** When a project's time budget is exhausted with N
questions still pending, mark all remaining questions for that project as BLOCKED with reason
"budget exhausted" and continue with the next project. If every remaining project is in the same
state (every question either `done` or honestly `blocked`), emit
`<promise>BLUEPRINT_BLOCKED</promise>` (NOT `BLUEPRINT_COMPLETE`) with the honest
blocked-questions report. Never emit `BLUEPRINT_COMPLETE` from a state with blocked questions.

**Anti-pattern:** NEVER fabricate Fase B answers to close a question whose Fase A was exhausted.
Honest BLOCKED with reason is required (Unbreakable Rule 3).

**Consequences:** Blocked questions surface in the blueprint's `## Blocked questions` section as
next-discovery seed.

### D2 — Ink-native evidence only; bubbles (Go) deferred

**Decision:** Answer M1 questions exclusively from the Ink-native references (react-ink,
gemini-cli, ink, ink-ui); the Go `bubbles` viewport/textarea stays out of scope.

**Rationale:** Both target components exist in production Ink code (validated pre-flight:
`react-ink/src/primitives/thread/ThreadMessages.tsx` — windowing grep hit;
`composer/useTextBuffer.ts`; `gemini-cli/.../InputPrompt.tsx`). Cross-paradigm translation from
bubbletea's Elm architecture costs budget without adding Ink-applicable API evidence (KISS).
Alternative: include bubbles for viewport-design theory — rejected: Ink has no imperative
viewport; scrollback is delegated to the terminal via `<Static>` (to be confirmed by Q1).

**Consequences:** If Q1 reveals Ink-native scroll evidence is insufficient, the blueprint marks
it BLOCKED and a follow-up discovery adds bubbles.

### D3 — Streaming evidence at render layer only (M7 boundary respected)

**Decision:** Q2 investigates HOW the analogs re-render a growing message (state shape, memo,
Static/tail split, flicker control) — NOT how they consume LLM streams (adapters/runtimes are
M7).

**Rationale:** Roadmap M1 DoD says "a message renders incrementally as tokens arrive
(append-in-place)"; the input is plain props/state at M1. react-ink's benchmark drives streaming
via `core.setMessages()` — we read the RENDER consequences (memo boundaries, window), not the
store. Alternative: study the runtime now — rejected (YAGNI; M7 has its own discovery).

**Consequences:** Blueprint's streaming section cites render-layer evidence only; M7 re-enters
DISCOVER for the adapter.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | How is a chat thread composed for the terminal — `<Static>` history vs dynamic tail, windowing, memo boundaries, and what "scroll/viewport" actually means in Ink? | techniques | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/thread/`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx`, `.claude/knowledge-base/references/ink/src/components/Static.tsx` | Glob `src/primitives/thread/*.tsx`; Grep `Static\|window\|memo` in `thread/` and in `gemini-cli/packages/cli/src/ui/AppContainer.tsx` | Read `ThreadMessages.tsx` end-to-end; read the Static-using regions of `AppContainer.tsx`; read `Static.tsx` header/docs + props | ChatThread v0 design: composition model (Static/tail split? window size? memo per item?), citations per claim, explicit statement of Ink's scroll semantics |
| Q2 | How does a streaming (growing) message render without flicker/perf collapse — state shape, memo strategy, what stays out of `<Static>`? | techniques | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/long-thread.bench.tsx`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/thread/ThreadMessages.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx` | Grep `memo\|windowed\|legacy` in `benchmarks/long-thread.bench.tsx`; Grep `pending\|stream` in `AppContainer.tsx` (message tail region) | Read the three render modes in the bench (legacy/memo/windowed) + how gemini-cli renders the pending/streaming message OUTSIDE Static | Streaming-render contract for M1: which subtree re-renders per token, memo boundaries, Static exclusion rule — with measured evidence from the bench modes where available |
| Q3 | How is multi-line terminal input implemented — text buffer (cursor, insert, newline), `useInput` handling, submit vs newline keybinding? | techniques | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/composer/` (`ComposerInput.tsx`, `useTextBuffer.ts`, `ComposerRoot.tsx`, `ComposerSend.tsx`), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/InputPrompt.tsx`, `.claude/knowledge-base/references/ink-ui/source/components/text-input/` | Glob `composer/*.tsx` + `composer/*.ts`; Grep `useInput\|return\\b.*newline\|meta\|shift` in `ComposerInput.tsx`, `useTextBuffer.ts`, `InputPrompt.tsx` | Read `useTextBuffer.ts` + `ComposerInput.tsx` end-to-end; read `InputPrompt.tsx` key-handling region; skim ink-ui `text-input` for the single-line contrast | ChatComposer v0 design: buffer data structure, cursor ops, submit semantics (Enter submits? how is newline inserted?), controlled-vs-uncontrolled prop shape — citations per claim |
| Q4 | How do the analogs test interactive input and thread rendering — stdin simulation, frame sequences, async settling? | tests | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/tests/ComposerInput.test.tsx`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/thread/ThreadMessages.test.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/InputPrompt.test.tsx` | Text-shape — SKIP Fase A; targets pre-validated | Read `ComposerInput.test.tsx` + `ThreadMessages.test.tsx` end-to-end; read `ink/test/hooks-use-input.tsx` key-encoding regions (EC-2 — authoritative stdin byte sequences); skim `InputPrompt.test.tsx` idioms — if > 800 lines, sample harness setup + 2 key-handling tests and record the sampling (EC-3) | Test-idiom table: stdin.write patterns, escape sequences for special keys, settle/wait strategy, what is asserted (frame vs state) — with `path:line` |
| Q5 | How is `<Static>` output tested and how do frame sequences assert streaming updates? | tests | `.claude/knowledge-base/references/ink/test/components.tsx`, `.claude/knowledge-base/references/ink/test/render.tsx`, `.claude/knowledge-base/references/ink/src/components/Static.tsx` | `grep -rln '<Static' ink/test/` (EC-1: content grep, not filename — verified hits: components.tsx, render.tsx, render-to-string.tsx) | Read the Static regions of `components.tsx` (primary) + `render.tsx`; capture how `frames`/`lastFrame` behave with Static content | Static-testing contract: what ink-testing-library exposes for Static output, gotchas (double-print, frame accumulation) — citations |
| Q6 | Do the analogs need extra runtime deps for thread/composer (measuring width, wrapping, key parsing), or does ink's built-in surface suffice — confirming M1 adds ZERO new runtime deps? | deps | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json`, `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json` | Text-shape — SKIP Fase A | Read both dependency blocks; cross-check any thread/composer-specific import found in Q1/Q3 reads against them | Verdict: list of composer/thread-relevant deps in each analog (name+version+purpose) and the ZERO-new-deps conclusion for M1 (or the counter-evidence) |
| Q7 | How does the react-ink long-thread benchmark implement its `windowed` and `memo` modes, and what should the M1 bench extension measure (thread + streaming + composer keystroke latency?) | tools | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/long-thread.bench.tsx` | Grep `windowed\|N_WINDOW\|slice` in the bench file | Read the mode-implementation regions end-to-end (component defs + trial driver) | M1 bench design: workloads (windowed thread vs plain column; streaming tail), metrics, how it extends the existing harness + baseline JSON — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q4, Q5 | Covered |
| Dependencies | Q6 | Covered |
| Tools | Q7 | Covered |
| Techniques | Q1, Q2, Q3 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

| Checkpoint | Assertion | Action if fails |
|---|---|---|
| Before answering Qx | Every `.claude/knowledge-base/references/{...}` path declared in the question exists | Mark Qx BLOCKED with reason "path not found", continue to next |
| Per-question Fase A budget | Fase A returned ≥ 1 hotspot OR 3 query-variant retries attempted | After 3 empty retries, mark Qx BLOCKED "Fase A exhausted"; continue |
| Q5 static-test location | `grep -rln '<Static' ink/test/` returns ≥ 1 file (pre-verified: components.tsx) | If regression, answer Q5 from `Static.tsx` source, honestly noting the gap |
| Q4 InputPrompt sampling (EC-3) | `wc -l` before reading; > 800 lines → sample harness + 2 key tests, record sampling | Never silent-truncate — the blueprint states what was sampled |
| After answering Qx | Blueprint section under Qx has ≥ 1 citation with `path:line` | Re-iterate Qx (1 retry max) |
| Mid-loop sanity | Total citations ≥ 1 / 200 words of blueprint prose | Add citations to under-cited paragraphs (1 retry max) |
| Per-project time budget | Project budget (ADR D1) not exhausted | Mark remaining Qx for that project BLOCKED "budget exhausted"; advance |
| Before promising complete | All 4 coverage corners populated + ≥ 1 ADR section in blueprint | Refuse promise, continue iterating |

## Acceptance Criteria

- [ ] All 7 research questions answered OR explicitly BLOCKED with reason
- [ ] All four coverage corners have populated sections in the blueprint
- [ ] Every citation in the blueprint points to a real `.claude/knowledge-base/references/{...}` path
- [ ] At least one ADR section in the blueprint synthesizes decisions taken
- [ ] Blueprint proposes: ChatThread composition, streaming-render contract, ChatComposer API +
      buffer design, system-role extension note, test strategy (input/streaming/Static), bench
      extension design
- [ ] Time budget respected per project (ADR D1)
- [ ] `/discover-confidence` verdict ≥ SHIPPABLE_WITH_CAVEATS
- [ ] Blueprint saved at `.claude/knowledge-base/discoveries/blueprints/m1-chat-surface-blueprint.md`

## Global Definition of Done

- [ ] All phases completed (plan → edge-cases → plan-confidence → execute → confidence → improve if needed → re-score)
- [ ] Final `/discover-confidence` verdict recorded in the blueprint header
- [ ] No fabricated citations
- [ ] Coverage Matrix 100% covered
- [ ] ADRs reference at least one project rule: D2 cites KISS; D3 cites YAGNI + the M7 roadmap
      boundary; Context cites `rules/testing.md` determinism discipline
