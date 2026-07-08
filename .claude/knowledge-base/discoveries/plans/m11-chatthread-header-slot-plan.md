---
slug: m11-chatthread-header-slot
milestone_id: M11
created_at: 2026-07-08
question: How does a header element fold as the FIRST item of ChatThread/AgentTimeline's existing single <Static> (gemini shape) without breaking the windowing/graduation contracts, and what is the honest immutability contract?
---

# Discovery Plan: m11-chatthread-header-slot

## Context

M11 adds `header?: ReactElement` to ChatThread + AgentTimeline, folded as
the FIRST item of the component's OWN `<Static>` — resolving the recorded
M9 D4 drawback (banner sinks below graduated history). Prior evidence (M9
research): gemini mounts its header as the first Static item
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.tsx:222-319`)
and pays for later header changes with `refreshStatic()` clearTerminal
machinery (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:646-698`)
— machinery a library must NOT own. Our components: `src/chat-thread.tsx`
(Static mounts ONLY when `prefix.length > 0`, lines 76-88) and
`src/agent-timeline.tsx` (same shape, lines 196-204); single-`<Static>`
invariant documented at `src/agent-timeline.tsx:176-182`. Stack: ink 7.1.0
(fresh M10 base).

## Objective

Blueprint locking: the item-union design (header sentinel + rows), the
Static-mount condition WITH header, the immutability contract (print-once,
later changes ignored — gemini parity without refreshStatic), id/key
collision policy, and the test strategy (drawback-resolution proof).

## In-Scope / Out-of-Scope

**In:** header slot on BOTH thread components (`.claude/knowledge-base/references/ink/src/components/Static.tsx` is the ONLY ink primitive involved); Static item-union; ordering
guarantees; immutability contract; windowing interplay; M9 banner as the
canonical header consumer.
**Out:** refreshStatic/clearTerminal (rejected by M9 D4); multiple slots;
sticky/floating headers (ink7 has no such primitive on our surface);
header inside the DYNAMIC region (that's just children composition — exists
today).

## ADRs

### D1 — Header as first Static item via a sentinel union (preliminary)

**Decision shape:** `items = header ? [HEADER_SENTINEL, ...prefix] : prefix`;
render callback dispatches sentinel → the header element with a reserved
stable key; Static mounts when `header !== undefined || prefix.length > 0`.
**Alternatives:** separate `<Static>` for the header (FORBIDDEN — single-
consumer invariant); dynamic-region header (doesn't resolve the drawback).
**Consequences:** Q1 must verify ink7 Static's items/lastIndex semantics
make the sentinel print exactly once, before any graduated row, even when
the prefix grows later.

### D2 — Print-once immutability; later header changes IGNORED (preliminary)

**Decision shape:** the first rendered header wins; identity/content changes
after print are ignored by design (gemini parity WITHOUT the refreshStatic
escape); contract documented on the prop + pinned by test.
**Alternatives:** throw on identity change (rejected shape: legitimate
re-renders recreate elements — throwing would fire constantly); re-key
remount (rejected: that's refreshStatic in disguise).
**Consequences:** Q2 verifies what ink7 Static actually does when item[0]
mutates after being consumed.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | ink7 `<Static>` semantics for the sentinel design: how items/lastIndex advance (`.claude/knowledge-base/references/ink/src/components/Static.tsx:30-33` — index state + `items.slice(index)`; full read of the 58-line module), whether item[0] prints before later-appended items ALWAYS, what happens on Static mount AFTER first render (header present but prefix empty → Static mounts at mount-time; prefix grows later), and the ink.tsx fullStaticOutput reset on Static identity change (`.claude/knowledge-base/references/ink/src/ink.tsx:543-545` — does our conditional mount trigger it?) | techniques | `.claude/knowledge-base/references/ink/src/components/Static.tsx`, `.claude/knowledge-base/references/ink/src/ink.tsx` (onStaticChange/fullStaticOutput regions), our `src/chat-thread.tsx:70-88`, `src/agent-timeline.tsx:190-204` | Grep `lastIndex\|staticOutput\|onStaticChange` | Read Static.tsx end-to-end + the ink.tsx static regions | Sentinel-design verdict: print-once ordering guaranteed/conditional — citations |
| Q2 | Immutability reality: with the sentinel at index 0 already consumed, what does ink7 do if the header element identity changes on a later render (nothing? re-print? corrupt)? And the gemini contract for comparison (their header re-print needs refreshStatic — confirming ignore-by-default) | techniques | `.claude/knowledge-base/references/ink/src/components/Static.tsx` (items effect/state), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:646-698` | Grep `useState\|useEffect\|slice` in Static.tsx | Trace the consumed-items path with a mutated item[0] | Ignore-by-design confirmed (or corrective design) — citations |
| Q3 | Test strategy: drawback-resolution proof (header stays ABOVE graduated rows after windowSize+overscan appends — the M9 D4 scenario), print-once pin (frames contain the header exactly once across N appends), immutability pin (changed header ignored), key-collision negative (row id colliding with the sentinel key), both components covered, snapshot budget | tests | our `src/chat-thread.test.tsx` + `src/agent-timeline.test.tsx` windowing suites (existing graduation tests to extend), `tests/degrade-matrix` fixture (banner already mounted ABOVE the thread — move INTO the header slot?) | Grep the existing graduation tests | Read the windowing test idioms; design the header extensions | Oracle set + budget — citations |
| Q4 | Deps: zero new deps (pure composition over ink `Static` — already the platform); confirm no companion (ink-spinner/itl) is touched; the header element type is `ReactElement` (react already a peer) | deps | our `package.json`, `.claude/knowledge-base/references/ink/src/components/Static.tsx` (the only consumed primitive), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.tsx:222-319` (gemini adds no dep for its header either) | Grep imports in the two thread components | Confirm the diff adds zero manifest lines | Rule 9 verdict — citations |
| Q5 | Evidence: bench impact NONE expected (header renders once into Static — no per-frame path; `benchmarks/chat-thread.bench.tsx` windowed mode runs headerless and stays untouched); example update (move the banner INTO the slot in `examples/banner.tsx`/`examples/chat.tsx`) + smoke deltas; no-new-bench justification per the M9/M10 convention (the M9/M10 no-new-bench precedents in `.claude/knowledge-base/implementations/`) | tools | our `benchmarks/chat-thread.bench.tsx`, `examples/banner.tsx`, `examples/chat.tsx`, `tests/example-banner.integration.test.ts` | Map the example composition | Decide example + smoke shape; write the justification + flip condition | Evidence plan — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q3 | Covered |
| Dependencies | Q4 | Covered |
| Tools | Q5 | Covered |
| Techniques | Q1, Q2 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

- Q1/Q2 done: sentinel + immutability verdicts with dual citations.
- Q3/Q4/Q5 done: oracle set + deps verdict + evidence plan.
- Blueprint: 4 corners, ADRs final, density ≥ 1.0.

## Acceptance Criteria

- Every question `done`; citations resolve; blueprint ≥ SHIPPABLE_WITH_CAVEATS.

## Global Definition of Done

- Blueprint at `discoveries/blueprints/m11-chatthread-header-slot-blueprint.md`
  consumable task-by-task by the M11 plan.
