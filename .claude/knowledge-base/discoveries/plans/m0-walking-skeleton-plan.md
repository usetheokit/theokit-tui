# Discovery Plan: M0 Walking Skeleton — Ink 5 library scaffold + ChatMessage primitive

> **Version 1.1** (absorbs MUST FIX EC-1/EC-2 + SHOULD TEST EC-3/EC-4 from
> `reviews/m0-walking-skeleton-edge-cases-2026-07-05.md`) — Deep research over the cloned SOTA references to lock the M0 walking-skeleton
> decisions for `@theokit/tui`: ESM-only TS library packaging on Ink 5, vitest +
> ink-testing-library snapshot discipline (ANSI/width stability), the ChatMessage component API
> shape, the minimal `<TheoTUIProvider>`/theme stub, and a render-benchmark harness with real data.
> In scope: `assistant-ui/packages/react-ink` (direct analog), `ink`, `ink-ui`, `gemini-cli`.
> Output: blueprint at `.claude/knowledge-base/discoveries/blueprints/m0-walking-skeleton-blueprint.md`.

**Slug:** `m0-walking-skeleton`
**Owner:** paulohenriquevn + Claude (assisted)
**Created:** 2026-07-05
**Time budget:** 6.5h total (per-project breakdown in ADR D1)

## Context

`ROADMAP.md § M0` requires the thinnest vertical slice proving the whole toolchain: Ink 5 + tsup
(ESM-only) + vitest + `ink-testing-library` + TS strict + Apache-2.0, with one primitive
(`ChatMessage`, user/assistant roles) wrapped in a `<TheoTUIProvider>` stub, snapshot-tested, and
all gates (`format → lint → typecheck → test → build`) exiting 0. Declared M0 risks: (1) Ink 5 +
React 19 + ESM interop quirks in the build; (2) snapshot flakiness from ANSI/width. The user
additionally mandates **benchmark data** as an acceptance signal for the cycle.

The project has zero source code today — every scaffold decision made here is load-bearing for
M1–M8. Per `rules/testing.md` (test pyramid: many fast deterministic unit/snapshot tests) and
`rules/architecture.md` (composition root at the top; provider wiring at the entrypoint), the
borrowed patterns must be deterministic-snapshot-first and keep theme/provider wiring at the
library boundary. Per Unbreakable Rule 9 (don't reinvent), we copy proven configs instead of
inventing our own.

## Objective

Produce a blueprint that lets `/to-plan` write the M0 implementation plan without any unresolved
toolchain or API-shape question — package layout, exact dep/peerDep versions, build+test configs,
ChatMessage API, provider stub, snapshot-stability rules, and a benchmark harness design with
measurable metrics.

- [ ] All research questions answered with citations to `.claude/knowledge-base/references/`
- [ ] Cross-cutting comparison table populated for every in-scope reference project
- [ ] Recommendations give one concrete decision proposal per research question
- [ ] `/discover-confidence` verdict ≥ SHIPPABLE_WITH_CAVEATS

## In-Scope / Out-of-Scope

### In-Scope (per reference project)

| Project | In-scope subdirectories | Reason |
|---|---|---|
| `.claude/knowledge-base/references/assistant-ui/packages/react-ink/` | `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/primitives/message/`, `src/context/`, `src/tests/`, `benchmarks/` | The direct analog — AI-chat primitives already built in Ink, with tests AND a render benchmark |
| `.claude/knowledge-base/references/ink/` | `package.json`, `benchmark/`, `test/` (selected files) | The foundation framework — canonical build/test/bench conventions for Ink itself |
| `.claude/knowledge-base/references/ink-ui/` | `package.json`, `source/theme.tsx`, `source/components/` (1-2 components), `test/` (2-3 files) | Component-collection packaging + theming pattern + ink-testing-library test idioms |
| `.claude/knowledge-base/references/gemini-cli/` | `packages/cli/src/ui/themes/`, `packages/cli/src/ui/components/` (message rendering only) | Production-scale Ink agent CLI — theme system + message component at scale |

### Out-of-Scope (explicit)

| Project / Subdir | Why excluded |
|---|---|
| `.claude/knowledge-base/references/codex/` | Rust/ratatui — supports M2/M4 (diff/tool-output layout), irrelevant to a TS/Ink build scaffold |
| `.claude/knowledge-base/references/bubbletea/`, `bubbles/` | Go — architecture inspiration for M6/M5, no bearing on M0 toolchain decisions |
| `.claude/knowledge-base/references/assistant-ui/` outside `packages/react-ink/` | Web packages (React DOM) — different surface; only the react-ink sibling is the analog |
| `.claude/knowledge-base/references/gemini-cli/` outside `packages/cli/src/ui/` | Agent/runtime logic is `@theokit/sdk` territory (ROADMAP § out of scope) |
| `.claude/knowledge-base/references/ink/src/` internals | We consume Ink's public API; reading the reconciler internals is M1+ (streaming perf) work |
| Any `dist/`, `node_modules/`, lockfiles beyond version pins | Build artifacts / noise |

## ADRs

### D1 — Time budget + stop conditions

**Decision:** `assistant-ui/packages/react-ink`: 3h; `ink-ui`: 1.5h; `ink`: 1h; `gemini-cli`: 1h. Total 6.5h.

**Rationale:** react-ink is the closest analog (same problem, same stack, has benchmarks) → deepest
dive. ink-ui shows packaging + theming for a component collection. ink and gemini-cli are
consulted for narrow, specific questions (bench harness; theme-at-scale). Alternatives considered:
equal split (wastes budget on low-yield repos); react-ink-only deep-dive (single-source violates
`cycle-discover` ≥ 2 independent references rule).

**Stop condition — per question (mandatory):** When a question's Fase A returns empty matches after
3 consecutive retries with different query variants (pattern → kind-based → alternate path →
broader scope), mark the question BLOCKED with reason "Fase A exhausted — no hotspots found" and
continue to the next. Do NOT pad with unrelated hotspots from a different question's scope.

**Stop condition — per project (mandatory):** When a project's time budget is exhausted with N
questions still pending, mark all remaining questions for that project as BLOCKED with reason
"budget exhausted" and continue with the next project. If every remaining project is in the same
state (every question either `done` or honestly `blocked`), emit `<promise>BLUEPRINT_BLOCKED</promise>`
(NOT `BLUEPRINT_COMPLETE`) with the honest blocked-questions report. Never emit `BLUEPRINT_COMPLETE`
from a state with blocked questions.

**Anti-pattern:** NEVER fabricate Fase B answers to close a question whose Fase A was exhausted.
Honest BLOCKED with reason is required (Unbreakable Rule 3).

**Consequences:** The halt-loop stops iterating a project at budget exhaustion; blocked questions
surface in the blueprint's `## Blocked questions` section as next-discovery seed.

### D2 — Investigation depth: configs read end-to-end; source read at hotspots only

**Decision:** Package manifests, tsconfig, vitest/bench configs are read END-TO-END (they are the
deliverable). Component/test source is read only at Fase-A-identified hotspots (message primitive,
provider, 2-3 test files, bench files) — not whole-tree.

**Rationale:** M0 is a toolchain + one-component milestone; the risk mass is in configs and test
idioms, not in exhaustive component reading (KISS). Alternatives: whole-tree read (blows budget,
yields M1+ material we can't use yet); grep-only (misses config semantics like `exports` maps).

**Consequences:** Blueprint is deep on packaging/test/bench and deliberately thin on component
internals beyond the message primitive — accepted, later milestones re-enter DISCOVER.

### D3 — Benchmark corner is mandatory, not deferred

**Decision:** The benchmark question (Q5) is first-class in this discovery; the blueprint MUST
propose a concrete M0 bench harness with metrics (ops/sec or ms/render, iterations, reporter).

**Rationale:** The cycle owner explicitly requires benchmark data as an acceptance signal.
`react-ink/benchmarks/` and `ink/benchmark/` both exist (pre-validated) — prior art is available,
so this is borrowing, not inventing (Rule 9). Alternative considered: defer benchmarks to M8
analysis cycle — rejected: the requirement binds THIS cycle.

**Consequences:** M0 plan will carry a benchmark task with observable numbers; `/analysis`-grade
statistical rigor (≥3 runs, mean ± std dev) applies per `rules/analysis-golden-rule.md § 3`.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | How does react-ink snapshot/assert Ink component output deterministically — render helper, width control, ANSI handling, streaming frames? | tests | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/` | Glob `src/tests/*.test.tsx`; Grep `render\|lastFrame\|toMatchSnapshot\|columns` in `src/tests/` and `vitest.config.ts` | Read `src/tests/helpers.tsx`, `src/tests/MessageContent.test.tsx`, `vitest.config.ts` end-to-end | Table: helper → what it fixes (width/ANSI/timers) → assertion idiom, with `path:line` per row; list of flakiness mitigations |
| Q2 | How does ink-ui test components with ink-testing-library — frame assertions, theme injection in tests, color/no-color handling? | tests | `.claude/knowledge-base/references/ink-ui/` | Glob `test/*.tsx`; Grep `ink-testing-library\|lastFrame\|ThemeProvider` in `test/` | Read `test/badge.tsx` + `test/spinner.tsx` (or 2 richest hits) fully | Test idiom summary + citations; what they assert (plain text vs ANSI) |
| Q3 | Exact dependency contract: which React/Ink versions, peer vs direct deps, and `engines` do react-ink, ink-ui, and ink itself declare? | deps | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/`, `ink-ui`, `ink` | Text-shape — SKIP Fase A. Targets: the three `package.json` files | Read `assistant-ui/packages/react-ink/package.json`, `ink-ui/package.json`, `ink/package.json` end-to-end | Version matrix: package → react range → ink range → peer/direct → engines → module format |
| Q4 | What build/packaging shape does a published ESM-only Ink TS library use — `exports` map, `type: module`, tsup vs tsc, `files`, scripts pipeline, TS config strictness/JSX? | tools | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/`, `ink-ui` | Text-shape — SKIP Fase A. Targets: `package.json` scripts/exports + `tsconfig.json` | Read `assistant-ui/packages/react-ink/package.json` (scripts/exports/files), `assistant-ui/packages/react-ink/tsconfig.json`, `ink-ui/package.json` (build script) end-to-end | Recommended `package.json` skeleton + tsconfig for `@theokit/tui` M0, each field justified by a citation |
| Q5 | How is an Ink render benchmark harnessed — runner, workload, metrics reported, iteration strategy? | tools | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/`, `ink/benchmark/` | Glob `benchmarks/*` and `ink/benchmark/**`; Grep `bench\|hrtime\|performance.now` there | Read `benchmarks/long-thread.bench.tsx` + `benchmarks/run.ts` fully; skim `ink/benchmark/simple/` entry | Bench harness design for M0: workload, metric (ms/frame or ops/s), iterations, output format — with citations |
| Q6 | What is the message-component API shape in the direct analog — props/roles/parts decomposition of react-ink's message primitive, and how does gemini-cli render a chat message? | techniques | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/message/`, `gemini-cli/packages/cli/src/ui/components/messages/` | Glob `src/primitives/message/*.tsx` and take ALL matches (6 files — read-all beats pattern-matching, per EC-2); Glob `gemini-cli/packages/cli/src/ui/components/messages/*` and pick the 1-2 core message renderers (per EC-1) | Read all 6 react-ink message primitives; read the 1-2 gemini-cli message renderers found | ChatMessage v0 API proposal (props, role variants, children model) + citations; explicit ADR note of what we deliberately DON'T copy for M0 (EC-6) |
| Q7 | What is the minimal viable Provider/theme-stub pattern — react-ink context provider shape, ink-ui `theme.tsx` token structure, gemini-cli semantic tokens? | techniques | `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/context/`, `ink-ui/source/theme.tsx`, `gemini-cli/packages/cli/src/ui/themes/` | Glob `src/context/**`; Grep `createContext\|useContext` in react-ink `src/context/`; Glob `themes/semantic-tokens.ts` | Read `AssistantContext.tsx` + one provider; read `ink-ui/source/theme.tsx` fully; read `gemini-cli/.../themes/semantic-tokens.ts` | `<TheoTUIProvider>` M0 stub design: context value shape, token naming, extension seam for M6 — with citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q1, Q2 | Covered |
| Dependencies | Q3 | Covered |
| Tools | Q4, Q5 | Covered |
| Techniques | Q6, Q7 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

| Checkpoint | Assertion | Action if fails |
|---|---|---|
| Before answering Qx | Every `.claude/knowledge-base/references/{...}` path declared in the question exists | Mark Qx BLOCKED with reason "path not found", continue to next |
| Per-question Fase A budget | Fase A returned ≥ 1 hotspot OR 3 query-variant retries attempted | After 3 empty retries, mark Qx BLOCKED "Fase A exhausted"; continue |
| After answering Qx | Blueprint section under Qx has ≥ 1 citation with `path:line` | Re-iterate Qx (1 retry max) |
| Mid-loop sanity | Total citations to `.claude/knowledge-base/references/` ≥ 1 / 200 words of blueprint prose | Add citations to under-cited paragraphs (1 retry max) |
| Per-project time budget | Project budget (ADR D1) not exhausted | When exhausted, mark remaining Qx for that project BLOCKED "budget exhausted"; advance |
| Q3 version resolution (EC-3) | No recorded version reads `workspace:*`/`catalog:` — resolve via assistant-ui root `package.json`/`pnpm-workspace.yaml` first | Resolve before recording; if unresolvable, record "workspace-internal (devDep only)" honestly |
| Q5 ink-bench yield (EC-4) | `ink/benchmark/simple/index.ts` emits a numeric metric — else mark ink half low-yield in one sentence and rest on react-ink `benchmarks/run.ts` | Do not burn retries; proceed with react-ink harness as primary source |
| Before promising complete | All 4 coverage corners populated + ≥ 1 ADR section in blueprint | Refuse promise, continue iterating |

## Acceptance Criteria

- [ ] All 7 research questions answered OR explicitly BLOCKED with reason
- [ ] All four coverage corners have populated sections in the blueprint
- [ ] Every citation in the blueprint points to a real `.claude/knowledge-base/references/{...}` path
- [ ] At least one ADR section in the blueprint synthesizes decisions taken
- [ ] Blueprint proposes: package.json skeleton, tsconfig, vitest config, ChatMessage API, provider stub, snapshot-stability rules, bench harness with metric definition
- [ ] Time budget respected per project (ADR D1)
- [ ] `/discover-confidence` verdict ≥ SHIPPABLE_WITH_CAVEATS
- [ ] Blueprint saved at `.claude/knowledge-base/discoveries/blueprints/m0-walking-skeleton-blueprint.md`

## Global Definition of Done

- [ ] All phases completed (plan → edge-cases → plan-confidence → execute → confidence → improve if needed → re-score)
- [ ] Final `/discover-confidence` verdict recorded in the blueprint header
- [ ] No fabricated citations
- [ ] Coverage Matrix 100% covered
- [ ] ADRs reference at least one project rule: D2 cites KISS + `rules/testing.md` pyramid; D3 cites Rule 9 + `rules/analysis-golden-rule.md § 3` statistical rigor; Context cites `rules/architecture.md` composition-root
