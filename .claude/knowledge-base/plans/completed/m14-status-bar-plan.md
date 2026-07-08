---
slug: m14-status-bar
milestone_id: M14
created_at: 2026-07-08
goal: AppStatusBar (model · cwd · tokens · state slots, dim separators, cwd truncate-start) + useTurnElapsed hook feeding the existing AgentStreaming.elapsedSeconds (M3 no-timer ADR untouched); own bench (ticking + static); zero new deps.
---

# Plan: m14-status-bar

## Goal

Ship `AppStatusBar` + `useTurnElapsed` per blueprint
`.claude/knowledge-base/discoveries/blueprints/m14-status-bar-blueprint.md`
(D1 four fixed AI-native slots + dim `·` separators; D2 elapsed driver as
a hook — `AgentStreaming` stays dumb per its M3 no-timer decision; D3 own
bench).
Slots: `model?`, `cwd?` (tildeified, `truncate-start`), `tokens?:
{used, limit}` (compacted via the existing `formatTokens`), `state?`.
Separators only BETWEEN present slots. Release (0.15.0) follows
READY_TO_MERGE — NEVER a plan task (M10 DV-1 rule).

## Baseline Context

Repo state: develop @ v0.14.0 published (ink 7.1.0 / react 19.2.7;
512/512 green after the M13 batch).

### Files that will be touched

| File | LoC | Role |
|---|---|---|
| `src/use-turn-elapsed.ts` | new (~50) | bounded 1 s driver: 0 when inactive, ticks while active, RESETS on re-activation, clears on unmount |
| `src/use-turn-elapsed.test.tsx` | new (~120) | fake-timer script oracles (M12 idiom) |
| `src/app-status-bar.tsx` | new (~120) | the slot row (theme tokens; separator logic; truncate-start cwd) |
| `src/app-status-bar.test.tsx` | new (~180) | slot/separator/width/degrade oracles + ≤ 2 snapshots |
| `src/index.ts` | — | export both + types |
| `tests/export-surface.test.ts` | — | entry asserts |
| `examples/chat.tsx` + `tests/example-chat.integration.test.ts` | — | bar under the thread + `AgentStreaming elapsedSeconds={useTurnElapsed(...)}` + smoke asserts |
| `benchmarks/app-status-bar.bench.tsx` | new | ticking + static modes |
| `docs/benchmarks/m14-status-bar-baseline.json` | new | committed baseline (`load_1min_at_start`, stack provenance) |
| `CHANGELOG.md` | — | per task |

### Current callers / dependents

- `AgentStreaming.elapsedSeconds` EXISTS (M3) with human formatting and a
  tested no-internal-timer contract — the hook plugs into it unchanged.
- `formatTokens` (src/format.ts) is module-internal — the bar becomes its
  second internal consumer (no entry re-export needed).
- No existing component changes — the bar is a NEW leaf.

### Domain glossary

- **slot row** = one `<Box flexWrap="nowrap">`; each present slot is a Box
  (cwd flexShrink 1, others 0); `<Text dimColor> · </Text>` separators
  emitted between PRESENT slots only.
- **turn elapsed** = seconds since `active` became true; 0 when inactive;
  re-activation RESETS to 0 (a new turn is a new clock).
- **truncate-start** = ink Text wrap mode keeping the TAIL of the cwd (the
  informative end of a path).

### Architecture boundaries affected

None — new leaf component + new hook; `AgentStreaming`'s test-pinned
no-timer contract untouched (verified by its existing suite).

## Prior Art

- Blueprint Corners 1–4 + ADRs D1–D3 (gemini `Footer.tsx:41-66,103-165,
  170-280` FooterRow/CwdIndicator recipe; mastracode `status-duration.ts`).
- M12 driver + fake-timer + teardown oracle idiom
  (`src/welcome-banner.animated.test.tsx`).
- Test discipline per `.claude/rules/testing.md` (§ 4.1, § 6).

## ADRs

### D1 — Four fixed AI-native slots + dim `·` separators

**Decision:** props `model?/cwd?/tokens?/state?`; one row; separators
between present slots; cwd `wrap="truncate-start"` + flexShrink 1; state
never shrinks.
**Rationale:** blueprint D1 — gemini's FooterRow reduced to the AI-native
minimum; no config system (their width-estimation machinery exists FOR
the config system we don't have).
**Alternatives considered:** generic `items[]` (rejected: one step from
the out-of-scope generic layout widget); bordered box (rejected: peers
render a line; a border spends a row).
**Consequences:** adding a 5th slot later is an additive prop (OCP).

### D2 — `useTurnElapsed(active)` hook; AgentStreaming stays dumb

**Decision:** `useState(0)` + `useEffect([active])`: on activation reset
to 0 and `setInterval(1000)` increments; cleanup clears; inactive renders
0. The consumer wires `elapsedSeconds={useTurnElapsed(streaming)}`.
**Rationale:** blueprint D2 — DoD-2 "integrated" is satisfied by the lib
SHIPPING the driver while AgentStreaming's test-pinned no-timer contract
stays intact.
**Alternatives considered:** `autoElapsed` prop (rejected: violates the
no-timer contract); caller-only (rejected: fails DoD-2).
**Consequences:** unbounded while active (a turn has no known end) —
externally stopped via `active=false`, unlike M12's self-clearing N.

### D3 — Evidence: own bench (ticking + static)

**Decision:** `benchmarks/app-status-bar.bench.tsx` — `ticking` mode
(REAL timers, 10 one-second ticks through the hook path, ms/frame + wall)
and `static` mode (150-step rerender loop, bar present, no ticking);
baseline committed with `load_1min_at_start` (M12 convention).
**Rationale:** the ticking bar is a per-frame path — the M9 flip
condition fires; real timers per the M12 precedent (fake timers don't
measure the engine).
**Alternatives considered:** compressed tick interval for the bench
(rejected: measures a cadence nobody ships); reusing the metrics-footer
bench (rejected: different workload).
**Consequences:** the ticking mode takes ~10 s wall per run — acceptable
(3 measured runs keep the mode under a minute).

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| ink `Box`/`Text` | existing ^7.1.0 | no | platform primitives |
| `node:os.homedir` | node stdlib | no | rung 2 — cwd tildeify is a prefix replace |
| `formatTokens` (internal) | — | no | M5 formatter reused |

**NEW packages: (none).** Manifest untouched (pinned by existing tests).

## Critical paths

- `src/use-turn-elapsed.ts` activation/reset/teardown branches — 100%
  lines.
- `src/app-status-bar.tsx` slot/separator emission — 100% lines.

## Phase 1: The pieces

### T1.1 — useTurnElapsed hook (RED first — executed, not conceptual)

#### Objective

The bounded driver with the full fake-timer script.

#### Why this step (action + reasoning)

1. **What:** RED — the five oracles below, run RED before any hook code;
   GREEN — the D2 shape.
2. **Why now:** the hook is the smallest piece and the example + bench
   both consume it.

#### Evidence

- Blueprint Corner 4 driver contract + M12 fake-timer idiom.

#### TDD

```
RED:     inactive_renders_zero() — harness component prints the hook value; render with active={false}; const frame = instance.lastFrame() ?? ""; expect(frame).toContain("elapsed:0")
RED:     active_ticks_once_per_second() — active={true}; act(advance 3000ms); expect(lastFrame()).toContain("elapsed:3")
RED:     deactivation_freezes_then_reactivation_resets() — active true, advance 5s, set active false (rerender); advance 9s; frame still shows the FROZEN pre-deactivation behavior contract: value returns 0 when inactive (design: inactive === 0); reactivate; advance 2000ms; expect(lastFrame()).toContain("elapsed:2") — NOT 7 (EC-2 reset)
RED:     unmount_mid_turn_leaves_no_timers() — active, advance 2s, unmount; expect(vi.getTimerCount()).toBe(0) (M12 oracle f idiom)
RED:     rapid_toggle_does_not_leak_intervals() — toggle active true/false/true across rerenders; expect(vi.getTimerCount()).toBe(1) while active; deactivate; expect(vi.getTimerCount()).toBe(0)
VERIFY:  pnpm vitest run src/use-turn-elapsed.test.tsx
```

#### Files to edit

```
src/use-turn-elapsed.ts / src/use-turn-elapsed.test.tsx / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/use-turn-elapsed.test.tsx` exits 0; coverage report shows `use-turn-elapsed.ts` at 100% lines
- [ ] `wc -l src/use-turn-elapsed.ts` ≤ 70
- [ ] `pnpm vitest run src/use-turn-elapsed.test.tsx` exits NON-ZERO
  before `src/use-turn-elapsed.ts` exists (exit code recorded in the
  progress notes — M13 review F-7 demands executed REDs)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

### T1.2 — AppStatusBar component

#### Objective

The slot row with separator/width/degrade oracles.

#### Why this step (action + reasoning)

1. **What:** RED — the oracles below (executed); GREEN — the D1 layout.
2. **Why now:** completes the pieces before wiring.

#### Evidence

- Blueprint Corner 1 (a)–(d)/(g) + Corner 4 row recipe.

#### TDD

```
RED:     all_slots_render_in_order_with_separators() — render <AppStatusBar model="gpt-x" cwd="/home/u/proj" tokens={{used:12300, limit:128000}} state="streaming"/> at width 80; strip ANSI; expect order model < cwd < tokens < state via indexOf; const seps = frame.split("·").length - 1; expect(seps).toBe(3)
RED:     missing_slots_emit_no_dangling_separator() — only model + state; const seps = frame.split("·").length - 1; expect(seps).toBe(1); expect(frame).not.toContain("· ·")
RED:     tokens_render_compacted() — used 12300 limit 128000; expect(stripped).toContain("12.3k/128k") (formatTokens reuse)
RED:     cwd_tildeifies_and_truncates_start_at_narrow_width() — cwd under homedir renders with ~ prefix; at width 30 the cwd slot keeps its TAIL (expect(stripped).toContain(basename)); state slot text intact
RED:     monochrome_theme_keeps_separators_drops_color() — no-color theme; zero color-class SGR; separator "·" present; expect(frame).toMatchSnapshot("status-bar-monochrome") (snapshot 1 of ≤ 2, anchored)
RED:     full_bar_scene_snapshot() — width 80 all slots; anchored toContain("gpt-x") then toMatchSnapshot("status-bar-full") (snapshot 2 of ≤ 2)
RED:     invalid_tokens_throw_typed() — tokens={{used:-1, limit:0}}; expect TypeError naming AppStatusBar (negative case, testing.md § 4.1)
VERIFY:  pnpm vitest run src/app-status-bar.test.tsx
```

#### Files to edit

```
src/app-status-bar.tsx / src/app-status-bar.test.tsx
src/index.ts / tests/export-surface.test.ts / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/app-status-bar.test.tsx` exits 0; coverage report shows `app-status-bar.tsx` at 100% lines
- [ ] `wc -l src/app-status-bar.tsx` ≤ 150
- [ ] `git diff --numstat <m14-base>..HEAD -- '**/__snapshots__/**'` shows insertions-only and ≤ 2 new snapshot entries

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 2: Wiring + evidence

### T2.1 — Example integration + smoke

#### Objective

Bar under the thread + elapsed wired through AgentStreaming.

#### Why this step (action + reasoning)

1. **What:** RED — smoke asserts (executed); GREEN — `examples/chat.tsx`
   mounts `<AppStatusBar model cwd tokens state>` under the thread and
   drives `AgentStreaming elapsedSeconds={useTurnElapsed(streaming)}`.
2. **Why now:** wiring over converged pieces.

#### Evidence

- Blueprint Corner 3 example/smoke shape; pipe = single final frame (M10).

#### TDD

```
RED:     chat_example_status_bar_asserts() — extend the smoke: expect(out).toContain("theokit-demo") (model slot); const seps = out.split("·").length - 1; expect(seps).toBeGreaterThanOrEqual(2); bar appears BELOW the last thread row (indexOf ordering)
VERIFY:  pnpm vitest run tests/example-chat.integration.test.ts (3 consecutive exit-0 runs)
```

#### Files to edit

```
examples/chat.tsx / tests/example-chat.integration.test.ts / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] 3 consecutive `pnpm vitest run tests/example-chat.integration.test.ts` invocations exit 0

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

### T2.2 — OWN bench + committed baseline

#### Objective

The D3 bench: ticking + static modes.

#### Why this step (action + reasoning)

1. **What:** RED — baseline-contract test (executed; ENOENT first);
   GREEN — the bench + one load-gated run committed.
2. **Why now:** terminal evidence step (release follows review, NOT here).

#### Evidence

- Blueprint Corner 3 bench shape; M12 bench conventions.

#### TDD

```
RED:     m14_status_bar_baseline_contract() — const baseline = JSON.parse(read docs/benchmarks/m14-status-bar-baseline.json); expect(baseline.stack.ink).toBe("7.1.0"); const modeNames = baseline.modes.map(pick mode); expect(modeNames).toEqual(expect.arrayContaining(["ticking", "static"])); expect(baseline.load_1min_at_start).toBeLessThan(4); every aggregate finite
VERIFY:  pnpm vitest run tests/bench-banner-baseline.test.ts
```

#### Files to edit

```
benchmarks/app-status-bar.bench.tsx / docs/benchmarks/m14-status-bar-baseline.json
tests/bench-banner-baseline.test.ts / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] Baseline JSON field `load_1min_at_start` parses < 4 via the contract test
- [ ] Baseline JSON ticking-mode `wall_ms.mean` is between 9000 and 12000 (10 real 1 s ticks)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Edge cases absorbed

(discovery MUST-FIX set: EC-1 dangling separators → T1.2 oracle; EC-2
reset-on-reactivation → T1.1 oracle; EC-3 narrow-width priority → T1.2
oracle; EC-4 ticking bench → T2.2 mode)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M14 DoD-1: AppStatusBar slots model·cwd·tokens·state (ROADMAP § M14) | T1.2 | D1 slot row |
| 2 | M14 DoD-2: elapsed/state integrated with AgentStreaming (ROADMAP § M14) | T1.1, T2.1 | useTurnElapsed + example wiring |
| 3 | M14 DoD-3: responsive width + degrade ladder (ROADMAP § M14) | T1.2 | truncate-start/narrow/monochrome oracles |
| 4 | M14 DoD-4: example + smoke + OWN bench (ROADMAP § M14) | T2.1, T2.2 | smoke asserts + ticking/static baseline |
| 5 | M14 DoD-5: gates/coverage/CHANGELOG (ROADMAP § M14) | T1.1, T1.2, T2.1, T2.2 | gates-gated commits |
| 6 | M14 risk-1: elapsed timer flake surface (ROADMAP § M14) | T1.1 | fake-timer determinism + teardown oracles |
| 7 | M14 risk-2: scope creep toward generic layout (ROADMAP § M14) | T1.2 | fixed 4-slot API (D1) |
| 8 | M3 no-timer ADR preserved (blueprint D2) | T1.1 | hook is separate; AgentStreaming suite untouched |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| 1 Hz repaint cost on large scenes | Medium | benched (ticking mode); consumers can pass elapsed less often | implement |
| Unbounded interval while active (long turns) | Low | cleared on deactivate/unmount (oracles); a turn without end is the caller's semantic | implement |
| Fixed slots may not fit every consumer | Low | additive props later (OCP); state slot takes free text | implement |
| Ticking bench takes ~10 s/run wall | Low | 3 measured runs; documented in methodology | implement |

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D3.)

## Test Plan

Hook fake-timer script + slot/separator/width/degrade oracles + smoke +
baseline contract; discipline per `.claude/rules/testing.md` (§ 4.1
negative cases — invalid tokens; § 6 determinism — clock faked in unit
suites, real only in the bench). Two consecutive full runs green.

## Final Phase: Integration Validation (MANDATORY)

- `run_validation.py m14-status-bar` exit 0; `/code-quality` PASS;
  coverage: hook + bar 100% lines.
- Review (multi-role) BEFORE any release — the release chain (0.15.0
  minor) runs only on READY_TO_MERGE (M10 DV-1 rule).

## Global Definition of Done

- [ ] All tasks committed gates-gated (1 task = 1 commit, `gates && commit`)
- [ ] 512+ tests green; zero weakened tests
- [ ] ≤ 2 new snapshots; manifest untouched
- [ ] Bench baseline committed (`load_1min_at_start` < 4)
- [ ] Plan archived post-release
