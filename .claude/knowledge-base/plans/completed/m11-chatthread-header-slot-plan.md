---
slug: m11-chatthread-header-slot
milestone_id: M11
created_at: 2026-07-08
goal: header? mount-time slot folded as the first item of the existing single Static on ChatThread + AgentTimeline, resolving the recorded M9 banner-sinking drawback with the mount-freeze design; zero new deps; headerless bench re-run evidence.
---

# Plan: m11-chatthread-header-slot

## Goal

Add `header?: ReactElement` to ChatThread and AgentTimeline per blueprint
`.claude/knowledge-base/discoveries/blueprints/m11-chatthread-header-slot-blueprint.md`
(mount-freeze design — two corruption traps numerically traced and closed),
prove the recorded M9 banner-sinking drawback resolved (header pinned
above graduated scrollback), keep the single-`<Static>` invariant, ship the example/smoke/
degrade evidence and the headerless bench re-run. Release (0.12.0) follows
READY_TO_MERGE — NEVER a plan task (M10 DV-1 rule).

## Baseline Context

Repo state: develop @ v0.11.1 published (ink 7.1.0/react 19.2.7; 462/462).

### Files that will be touched

| File | LoC | Role |
|---|---|---|
| `src/chat-thread.tsx` | ~90 | header prop + mount-freeze + sentinel union + key validation |
| `src/agent-timeline.tsx` | ~210 | same |
| `src/chat-thread.test.tsx` / `src/agent-timeline.test.tsx` | ~230/~470 | oracle set a–f |
| `tests/export-surface.test.ts` | — | props presence note (type-only — no new export) |
| `examples/chat.tsx` + `tests/example-chat.integration.test.ts` | — | banner in the slot + 3 asserts |
| `tests/fixtures/no-color-probe.tsx` | — | banner moves INTO the slot |
| `CHANGELOG.md` | — | per task |

### Current callers / dependents

- ChatThread consumers: examples/chat.tsx, no-color-probe fixture,
  public-api scenes, chat-thread bench (HEADERLESS — untouched).
- AgentTimeline consumers: examples/agent+stream+live, scenes, benches.
- New prop is optional — every existing call site unchanged.

### Domain glossary

- **mount-freeze** = `useRef(header).current` — the first render's value is
  the component's header forever (content/identity/PRESENCE changes ignored).
- **sentinel** = reserved union item (`key "__theokit_tui_header__"`) that
  renders the frozen header as Static item[0].
- **same-length trap** = removal + graduation in one commit keeps
  `items.length` constant → ink Static's length-keyed effect never refires →
  permanent row loss (the bug mount-freeze makes impossible).

### Architecture boundaries affected

None — pure composition over the existing Static; single-consumer invariant
preserved (the header enters the EXISTING Static, never a second one).

## Prior Art

- Blueprint (Corner 1 oracle set, Corner 4 design — consumed verbatim).
- Mount-time prop precedent: `src/chat-thread.tsx:23-29` (windowSize).
- M10 DV-1 rule (release outside the plan).

## ADRs

### D1 — Sentinel union + mount-freeze

**Decision:** `const frozenHeader = useRef(header).current`; items =
`frozenHeader !== undefined ? [SENTINEL, ...prefix] : prefix`; Static mounts
when `frozenHeader !== undefined || prefix.length > 0`; sentinel key
`"__theokit_tui_header__"` rejected as row id at the validation boundary.
**Rationale:** blueprint Corner 4 — the naive design has two numerically
traced permanent-corruption traps (late-arrival duplication; same-length
skip); freezing the length contribution eliminates both plus the
Static-unmount buffer reset.
**Alternatives considered:** naive sentinel (rejected: the traps);
latch-once-printed (rejected: still duplicates on late arrival); separate
`<Static>` (FORBIDDEN — single-consumer invariant); throw-on-change
(rejected: legitimate re-renders recreate elements each frame).
**Consequences:** header is a MOUNT-TIME prop — documented + pinned.

### D2 — Mount-time immutability contract

**Decision:** first render wins; later content/identity/presence changes are
ignored by design (gemini parity WITHOUT refreshStatic/clearTerminal).
**Alternatives considered:** refreshStatic escape (rejected: host-app
machinery, not library's).
**Consequences:** oracles (c)/(d) pin it; prop docs state it.

### D3 — Evidence

**Decision:** zero new deps; NO new bench/mode; ONE load-gated headerless
chat-thread bench re-run vs M10 baselines (the M9 flip condition FIRES —
chat-thread.tsx is a benched file); example/smoke/degrade deltas per
blueprint Corner 3.
**Alternatives considered:** header bench mode (rejected: steady-state
delta is zero by design — would measure startup noise).
**Consequences:** re-run table in the implementation log.

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| ink `Static` | existing ^7.1.0 | no | the platform primitive — composition only |
| react `ReactElement` type | existing peer | no | type-only |

**NEW packages: (none).** Manifest untouched (pinned by existing tests).

## Critical paths

- `src/chat-thread.tsx` + `src/agent-timeline.tsx` header/union branches —
  100% line coverage on the new branches.

## Phase 1: The slot in both components

### T1.1 — ChatThread header slot + oracle suite

#### Objective
The mount-freeze slot in ChatThread with oracles (a)–(e).

#### Why this step (action + reasoning)

1. **What:** RED — oracles a–e for ChatThread; GREEN — the D1 design.
2. **Why now:** ChatThread is the smaller surface; the pattern then mirrors.

#### Evidence
- Blueprint Corner 1 (harness fact: lastFrame order proves static-above)
  + Corner 4 design.

#### Files to edit
```
src/chat-thread.tsx / src/chat-thread.test.tsx / CHANGELOG.md
```

#### TDD
```
RED:     header_stays_above_graduated_history() — mount <ChatThread header={<Text>BANNER</Text>} messages={thread(6)} windowSize={4} windowOverscan={2}/>; append via rerender to thread(20) with ticks; const frame = lastFrame(); expect(frame.indexOf("BANNER")).toBeGreaterThanOrEqual(0); expect(frame.indexOf("BANNER")).toBeLessThan(frame.indexOf("msg 0")); expect(frame.indexOf("msg 0")).toBeLessThan(frame.indexOf("msg 19")); expect(frame.split("BANNER").length - 1).toBe(1) (oracle a+b — the banner-sinking drawback proof)
RED:     header_change_is_ignored_after_mount() — after graduation, rerender with header={<Text>CHANGED</Text>}; expect(frame).toContain("BANNER"); expect(frame).not.toContain("CHANGED"); row-render spy count unchanged by the header swap (oracle c)
RED:     header_removal_is_ignored_and_loses_no_rows() — after graduation, ONE rerender with header={undefined} AND one more message appended (the same-length trap); then more appends; every message text appears exactly once and "BANNER" appears exactly once (oracle d — kills a non-frozen design)
RED:     late_header_is_ignored() — mount WITHOUT header, graduate rows, rerender WITH header={<Text>LATE</Text>}; expect(frame).not.toContain("LATE"); no duplicated rows (mount-freeze contract, blueprint late-arrival trap)
RED:     sentinel_key_collision_throws_typed() — const bad = () => ChatThread({ header: <Text>B</Text>, messages: [{ id: "__theokit_tui_header__", role: "user", content: "x" }] }); expect(bad).toThrow(TypeError); message names the reserved key (oracle e)
VERIFY:  pnpm vitest run src/chat-thread.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suite exits 0; new branches 100% lines (`pnpm test:coverage` file report)
- [ ] `wc -l src/chat-thread.tsx` ≤ 130

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T1.2 — AgentTimeline header slot (mirror) + snapshot

#### Objective
Same design mirrored + oracle (f) heterogeneous + ≤1 snapshot (g).

#### Why this step (action + reasoning)

1. **What:** RED — mirrored oracles + heterogeneous-graduation extension +
   1 representative snapshot; GREEN — mirror the D1 design.
2. **Why now:** completes the DoD's "both components".

#### Evidence
- Blueprint Corner 1 (f)/(g); `src/agent-timeline.test.tsx:394-416` template.

#### Files to edit
```
src/agent-timeline.tsx / src/agent-timeline.test.tsx / CHANGELOG.md
```

#### TDD
```
RED:     header_above_heterogeneous_graduated_events() — heterogeneous events + header={<Text>BANNER</Text>}; graduate past the window; const frame = lastFrame(); expect(frame.indexOf("BANNER")).toBeLessThan(frame.indexOf(firstGraduatedText)); const count = frame.split("BANNER").length - 1; expect(count).toBe(1) (oracle a/f)
RED:     timeline_header_mount_freeze_mirrors_chatthread() — mount headerless, graduate, rerender with header={<Text>LATE</Text>}; expect(lastFrame()).not.toContain("LATE"); then a mounted-header instance: rerender header={undefined} + one append; every event text appears exactly once (compact c/d mirror)
RED:     timeline_header_scene_matches_snapshot() — const frame = await renderFrame(scene with header at width 60); expect(frame).toContain("BANNER"); expect(frame).toContain("✓"); expect(frame).toMatchSnapshot("timeline-header-scene") (oracle g — the ONE new snapshot)
RED:     reserved_event_id_throws_typed() — const bad = () => AgentTimeline({ header: <Text>B</Text>, events: [{ id: "__theokit_tui_header__", kind: "message", role: "user", text: "x" }] }); expect(bad).toThrow(TypeError) (oracle e mirror)
VERIFY:  pnpm vitest run src/agent-timeline.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suite exits 0; ≤ 1 new snapshot TOTAL for M11 — `git diff --stat <m11-base>..HEAD -- '**/__snapshots__/**'` insertions-only, 1 file

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Phase 2: Wiring + evidence

### T2.1 — Example + smoke + degrade fixture + headerless bench re-run

#### Objective
Wiring pillars + the D3 evidence.

#### Why this step (action + reasoning)

1. **What:** RED — smoke asserts (contain/order/print-once); GREEN —
   banner into `examples/chat.tsx` slot + fixture move; then the load-gated
   headerless chat-thread bench re-run + table.
2. **Why now:** terminal evidence step (release follows review, NOT here).

#### Evidence
- Blueprint Corner 3 (incl. the deterministic pipe-contract counting).

#### Files to edit
```
examples/chat.tsx / tests/example-chat.integration.test.ts
tests/fixtures/no-color-probe.tsx / tests/degrade-matrix.integration.test.tsx (only if asserts shift)
CHANGELOG.md
```

#### TDD
```
RED:     chat_example_header_asserts() — extend the existing smoke: expect(out).toContain("Theo TUI"); expect(out.indexOf("Theo TUI")).toBeLessThan(out.indexOf("What ships in M1?")); const once = out.split("Theo TUI").length - 1; expect(once).toBe(1) (deterministic under the ink7 single-final-frame pipe contract)
GREEN:   banner into the chat example slot; fixture banner moved INTO the ChatThread header slot (3 degrade scenes exercise header-in-Static free)
VERIFY:  pnpm vitest run tests/example-chat.integration.test.ts tests/degrade-matrix.integration.test.tsx; headerless bench re-run table drafted
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Smoke + degrade green 3× consecutively
- [ ] Headerless chat-thread bench re-run (load < 4, FORCE_COLOR=1) vs M10 baselines: both metrics within 1σ OR explained (table in the log)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Edge cases absorbed

(the blueprint IS the absorption: late-arrival trap, same-length trap,
unmount buffer reset, sentinel-key collision, exit-path note — each mapped
to an oracle above)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M11 DoD-1: header folded as first item of the EXISTING Static (ROADMAP § M11) | T1.1, T1.2 | sentinel union + mount condition |
| 2 | M11 DoD-2: M9 drawback resolved with pinned-above test (ROADMAP § M11) | T1.1, T1.2 | oracle (a) both components |
| 3 | M11 DoD-3: immutable-header contract decided + documented (ROADMAP § M11) | T1.1 | D2 mount-freeze + oracles (c)/(d) + late-arrival |
| 4 | M11 DoD-3b: single-Static invariant pinned (ROADMAP § M11) | T1.1, T1.2 | design uses the existing Static; no new Static import (review guard) |
| 5 | M11 DoD-4: example + snapshot within budget (ROADMAP § M11) | T1.2, T2.1 | 1 snapshot; chat example slot + smoke |
| 6 | M11 DoD-5: gates/coverage/CHANGELOG (ROADMAP § M11) | T1.1, T1.2, T2.1 | per-task gates-gated commits + CHANGELOG entries |
| 7 | Windowing suite extended with header scenarios (ROADMAP § M11 risks) | T1.1, T1.2 | oracles a–f extend the graduation suites |
| 8 | Bench evidence (M9 flip condition fires — benched file touched) | T2.1 | headerless re-run + table |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Mount-time-only header surprises consumers expecting reactivity | Medium | prop docs state the contract loudly; oracles pin it; gemini parity precedent | implement |
| Static now mounts with header even when nothing graduated (new exit-path behavior — ink7 skip-final-render engages) | Low | example smoke pins content under the pipe contract; blueprint exit note | implement |
| Sentinel key collision with a caller id | Low | boundary TypeError (oracle e) | implement |
| chat-thread.tsx is a benched file | Low | headerless re-run vs M10 baselines (D3) | implement |

## Failure scenarios (when I/O external)

(none — no external I/O)

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D3.)

## Test Plan

Oracles a–g + example/degrade deltas + headerless bench re-run; two
consecutive full runs green.

## Final Phase: Integration Validation (MANDATORY)

- `run_validation.py m11-chatthread-header-slot` exit 0; `/code-quality`
  PASS; coverage: new branches 100% lines.
- Review (6 roles) BEFORE any release — the release chain (0.12.0 minor)
  runs only on READY_TO_MERGE (M10 DV-1 rule).

## Global Definition of Done

- [ ] All tasks committed gates-gated (1 task = 1 commit)
- [ ] 462+ tests green; oracles a–g present; zero weakened tests
- [ ] ≤1 new snapshot; manifest untouched
- [ ] Headerless bench table in the log
- [ ] Plan archived post-release
