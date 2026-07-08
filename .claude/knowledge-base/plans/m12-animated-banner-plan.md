---
slug: m12-animated-banner
milestone_id: M12
created_at: 2026-07-08
goal: opt-in bounded banner reveal (12 phases x 80 ms < 2 s) on WelcomeBanner, gated evaluate-once (TTY + min dims + reduced-motion + monochrome), converging structurally byte-identical to the static banner; own render bench (M9 flip condition); zero new deps.
---

# Plan: m12-animated-banner

## Goal

Add `animated?: boolean` to `WelcomeBanner` per blueprint
`.claude/knowledge-base/discoveries/blueprints/m12-animated-banner-blueprint.md`
(D1 bounded phase driver, D2 evaluate-once gate stack, D3 own-bench
evidence): a < 2 s typewriter reveal that ONLY runs on an interactive
terminal meeting minimum dimensions with motion allowed, and that lands —
structurally, by construction — on the exact static banner tree everywhere
else and at convergence. Ship the deterministic fake-timer oracle suite,
the example/pipe smoke, and the component's OWN render bench with a
committed baseline. Release (0.13.0) follows READY_TO_MERGE — NEVER a plan
task (M10 DV-1 rule).

## Baseline Context

Repo state: develop @ v0.12.0 published (ink 7.1.0 / react 19.2.7;
473/473 green after the M11 batch).

### Files that will be touched

| File | LoC | Role |
|---|---|---|
| `src/welcome-banner.tsx` | 126 | `animated` prop + gate stack + phase driver + reveal branch |
| `src/welcome-banner.test.tsx` | ~300 | oracle set a–g (fake timers + getter-shadow) |
| `examples/banner.tsx` | ~40 | animated variant behind the gate (pipe ⇒ static — EC preserved) |
| `tests/example-banner.integration.test.ts` | ~30 | pipe smoke: static scene exactly once (oracle h) |
| `benchmarks/welcome-banner.bench.tsx` | new | OWN bench: reveal wall-clock + static rerender cost |
| `docs/benchmarks/m12-welcome-banner-baseline.json` | new | committed baseline (stack provenance field) |
| `CHANGELOG.md` | — | per task |

### Current callers / dependents

- WelcomeBanner consumers: `examples/banner.tsx`, `examples/chat.tsx`
  (ChatThread header slot), `examples/stream.tsx` (AgentTimeline header
  slot), `tests/fixtures/no-color-probe.tsx`, composed-scene snapshot.
- New prop is optional (default false) — every existing call site renders
  the static banner unchanged, byte-identical by construction.

### Domain glossary

- **gate stack** = `animated && stdout.isTTY && rows ≥ 15 && columns ≥ 44
  && !isMonochrome(theme) && THEOKIT_TUI_NO_MOTION unset` — evaluated ONCE
  at mount (`useRef(...).current`, M11 mount-freeze precedent).
- **phase driver** = `setInterval(80 ms)` advancing `phase 0..12`; interval
  cleared at phase 12 (bounded — 0.96 s) and on unmount.
- **structural byte-identity** = the render function has exactly two
  top-level outcomes: revealing (gate open AND phase < 12) renders the
  partial frame; EVERY other path returns the same static JSX as today.
- **reveal frame** = the bordered box with `name.slice(0, ceil(len·f))`
  typewriter (f = phase/12) and version/tagline/hints/children withheld
  until convergence.

### Architecture boundaries affected

None — leaf primitive stays a leaf (never mounts `<Static>`, per the M9
single-consumer decision);
timers are component-internal with effect-scoped teardown.

## Prior Art

- Blueprint Corners 1–4 + ADRs D1–D3 (consumed verbatim).
- codex gate shape + skip-below-breakpoint test (`welcome.rs:83-86,156-168`
  under `references/codex`); gemini fake-timer ink animation test
  (`useSnowfall.test.tsx:39-49` under `references/gemini-cli`).
- House idioms: getter-shadow (`renderAtColumns`, `src/welcome-banner.test.tsx`),
  console.error spy (M11), pipe single-final-frame pin (M10).

## ADRs

### D1 — Opt-in `animated` prop + bounded phase driver

**Decision:** `animated?: boolean` (default false) on the existing
component; driver = `useState(0)` + gate-open-only `setInterval(80 ms)`
advancing to phase 12 then self-clearing; total 0.96 s < 2 s DoD.
**Rationale:** blueprint D1 — interval+state is the proven ink idiom
(gemini) and bounded convergence is the DoD contract (codex loops forever,
gemini needs a 15 s external timeout — ours must END).
**Alternatives considered:** separate `AnimatedWelcomeBanner` (rejected:
API bloat + byte-identity across component boundaries); elapsed-derived
phase à la codex (rejected: still needs a re-render driver — same timer,
more moving parts); unbounded loop + external stop (rejected: DoD).
**Consequences:** all hooks move ABOVE the FLOOR_COLUMNS early return
(rules-of-hooks); the reveal is name-typewriter only, KISS.

### D2 — Gate stack evaluated once at mount

**Decision:** `useRef(gate).current` where gate = `animated === true &&
stdout?.isTTY === true && (stdout?.rows ?? 0) >= 15 && columns >= 44 &&
!isMonochrome(theme) && !env THEOKIT_TUI_NO_MOTION`; gate CLOSED renders
the static tree immediately (never a 1-frame animation).
**Rationale:** blueprint D2 — mid-reveal gate flips create partial-frame
discontinuity (traced in gemini's raw-title return); codex reads dims at
render with min-dims skip (`welcome.rs:83-86`) — we freeze at mount (M11
precedent) because ink resize doesn't re-render React anyway (M9 width
contract).
**Alternatives considered:** per-render re-evaluation (rejected:
discontinuity); prop-only without env override (rejected: reduced motion
is an end-user preference, not an app decision — peers gate via user
config, `config/mod.rs:736-737`; an env var is the library-appropriate
analog).
**Consequences:** MIN values ours (15 rows / 44 cols — banner ≤ 9 rows,
FLOOR at 24 cols; codex's 37/60 sized for its huge art); documented on
the prop.

### D3 — Evidence: OWN bench + committed baseline

**Decision:** new `benchmarks/welcome-banner.bench.tsx` with two modes —
`reveal` (full 12-phase run under real timers, ms/frame wall) and
`static` (rerender-loop cost of the static tree); baseline JSON committed
with the house stack-provenance field; load-gated (< 4), FORCE_COLOR=1.
**Rationale:** the recorded M9 flip condition FIRES — this feature has a
per-frame path; "short animation" is not an exemption (blueprint D3).
**Alternatives considered:** skip bench (rejected: recorded contract);
fake-timer bench (rejected: benches measure the real engine).
**Consequences:** bench lands IN the slice, before review.

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| ink `Box`/`Text`/`useStdout` | existing ^7.1.0 | no | platform primitives |
| react `useState`/`useEffect`/`useRef` | existing peer | no | stdlib of the platform |
| `setInterval`/`clearInterval` | node stdlib | no | rung 2 of the parsimony ladder |

**NEW packages: (none).** Manifest untouched (pinned by existing tests).

## Critical paths

- `src/welcome-banner.tsx` gate + driver + reveal branches — 100% line
  coverage on the new branches.

## Phase 1: The animated reveal

### T1.1 — Gate stack + phase driver + convergence oracles

#### Objective

The full D1+D2 design in WelcomeBanner with oracles (a)–(g).

#### Why this step (action + reasoning)

1. **What:** RED — the seven deterministic oracles below (fake timers +
   getter-shadow for isTTY/rows/columns); GREEN — gate stack + driver +
   reveal branch with the static tree extracted so both non-reveal paths
   return the SAME JSX.
2. **Why now:** the component IS the milestone; example/bench evidence
   only makes sense over a converged design.

#### Evidence

- Blueprint Corner 1 oracle set + Corner 4 techniques (gate/driver/
  identity); gemini fake-timer precedent proves ink+fake timers.

#### Files to edit

```
src/welcome-banner.tsx / src/welcome-banner.test.tsx / CHANGELOG.md
```

#### TDD

```
RED:     animated_under_non_tty_is_byte_identical_to_static() — shadow isTTY=false; const a = render(<WelcomeBanner name="Theo" version="1.0" hints={["h1"]} animated/>); const b = render(<WelcomeBanner name="Theo" version="1.0" hints={["h1"]}/>); const identical = a.lastFrame() === b.lastFrame(); expect(identical).toBe(true) (oracle a — EC-3: two LIVE renders, never a recorded string)
RED:     reveal_converges_to_static_bytes() — vi.useFakeTimers(); shadow isTTY=true, rows=30, columns=60; render animated; act(() => vi.advanceTimersByTime(12 * 80 + 80)); expect(lastFrame()).toBe(staticRender.lastFrame()) (oracle b)
RED:     mid_reveal_frame_differs_from_final() — same gate-open setup; act(advance 3 * 80); const mid = lastFrame(); expect(mid).not.toContain("h1"); act(advance to end); expect(lastFrame()).toContain("h1"); expect(mid).not.toBe(lastFrame()) (oracle c)
RED:     reduced_motion_env_forces_static_path() — vi.stubEnv("THEOKIT_TUI_NO_MOTION", "1"); gate-open dims; render animated; expect FIRST lastFrame() to contain "h1" (full static immediately); expect(vi.getTimerCount()).toBe(0) (oracle d)
RED:     below_min_dims_renders_static_immediately() — shadow isTTY=true, rows=10; render animated; first frame contains "h1"; timer count 0 (oracle e — codex skip-below-breakpoint shape)
RED:     unmount_mid_reveal_leaves_no_timers() — console.error spy; gate-open; act(advance 2 * 80); unmount(); expect(vi.getTimerCount()).toBe(0); expect(errorSpy).not.toHaveBeenCalled() (oracle f — EC-2)
RED:     gate_is_evaluated_once_dims_shrink_mid_reveal() — gate-open mount; act(advance 3 * 80); re-shadow rows=5 + rerender same props; act(advance to end); expect(lastFrame()).toBe(staticRender.lastFrame()) — the reveal was NOT aborted mid-flight (oracle g — D2 pin)
VERIFY:  pnpm vitest run src/welcome-banner.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] Suite exits 0; new branches 100% lines (`pnpm test:coverage` file report)
- [ ] `wc -l src/welcome-banner.tsx` ≤ 220
- [ ] Reveal duration by construction ≤ 2000 ms: `12 * 80 = 960`

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 2: Wiring + evidence

### T2.1 — Example + pipe smoke + snapshot

#### Objective

Wiring pillars: animated variant in the example; deterministic pipe smoke
(oracle h); the ONE mid-reveal snapshot.

#### Why this step (action + reasoning)

1. **What:** RED — pipe-smoke asserts + anchored mid-reveal snapshot;
   GREEN — `examples/banner.tsx` passes `animated` (pipe ⇒ non-TTY ⇒
   static path ⇒ deterministic under the ink7 single-final-frame contract).
2. **Why now:** wiring lands over the converged component; bench (T2.2)
   measures the wired reality.

#### Evidence

- Blueprint Corner 3 (example/smoke) + Corner 1 (h) + snapshot budget ≤ 1.

#### Files to edit

```
examples/banner.tsx / tests/example-banner.integration.test.ts
src/welcome-banner.test.tsx (snapshot oracle) / CHANGELOG.md
```

#### TDD

```
RED:     banner_example_piped_prints_static_scene_once() — extend the existing smoke: run examples/banner.tsx piped; expect(out).toContain(bannerName); const once = out.split(bannerName).length - 1; expect(once).toBe(1); expect(out).toContain(hintText) — full static content present (the animated flag degraded to the static path)
RED:     mid_reveal_frame_matches_snapshot() — fake timers + gate-open shadow at width 60; act(advance 4 * 80); expect(lastFrame()).toMatchSnapshot("banner-mid-reveal") (the ONE new M12 snapshot, anchored by a toContain on the partial name)
VERIFY:  pnpm vitest run tests/example-banner.integration.test.ts src/welcome-banner.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] Smoke green 3× consecutively
- [ ] ≤ 1 new snapshot TOTAL for M12 — `git diff --stat <m12-base>..HEAD -- '**/__snapshots__/**'` insertions-only, 1 file

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

### T2.2 — OWN render bench + committed baseline

#### Objective

The D3 bench: reveal + static modes, baseline JSON committed.

#### Why this step (action + reasoning)

1. **What:** RED — a baseline-contract assert (JSON exists, has `stack`
   provenance + both modes) added to the bench-contract suite; GREEN —
   `benchmarks/welcome-banner.bench.tsx` per house harness conventions +
   one load-gated run (< 4, FORCE_COLOR=1) committed as the baseline.
2. **Why now:** terminal evidence step (release follows review, NOT here).

#### Evidence

- Blueprint Corner 3 (bench shape) + M9 flip condition (recorded contract).

#### Files to edit

```
benchmarks/welcome-banner.bench.tsx / docs/benchmarks/m12-welcome-banner-baseline.json
tests/bench-baseline.test.ts (or the house bench-contract suite) / CHANGELOG.md
```

#### TDD

```
RED:     m12_banner_baseline_contract() — const baseline = JSON.parse(read of docs/benchmarks/m12-welcome-banner-baseline.json); expect(baseline.stack.ink).toBe("7.1.0"); const modeNames = baseline.modes.map(pick mode); expect(modeNames).toEqual(expect.arrayContaining(["reveal", "static"])); expect(baseline.color_env.FORCE_COLOR).toBe("1"); every aggregate has mean + std_dev
GREEN:   the bench file (real timers for reveal; rerender loop for static; warmup + 5 measured runs; per-run frames + ms/frame) + the load-gated run committed
VERIFY:  pnpm vitest run tests/bench-baseline.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] Baseline run at load < 4 with FORCE_COLOR=1 (recorded in the JSON)
- [ ] Reveal mode observed wall duration ≤ 2000 ms (DoD's < 2 s, measured)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Edge cases absorbed

(from the discovery plan's MUST-FIX set, each mapped to an oracle: EC-1
gate-at-mount → oracle g; EC-2 teardown → oracle f; EC-3 live-render
byte-identity → oracles a/b; EC-4 bench measures the ANIMATED path →
T2.2 reveal mode)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M12 DoD-1: opt-in variant gated TTY + min rows/cols; reduced-motion respected (ROADMAP § M12) | T1.1 | D2 gate stack + oracles d/e |
| 2 | M12 DoD-2: degrades to static everywhere else, byte-identical (ROADMAP § M12) | T1.1 | structural identity + oracles a/b |
| 3 | M12 DoD-3: OWN render bench lands with the slice (ROADMAP § M12) | T2.2 | reveal+static modes, committed baseline |
| 4 | M12 DoD-4: example + deterministic smoke (pipe → static path) (ROADMAP § M12) | T2.1 | animated example + pipe smoke h |
| 5 | M12 DoD-5: gates/coverage/CHANGELOG house standard (ROADMAP § M12) | T1.1, T2.1, T2.2 | per-task gates-gated commits |
| 6 | M12 risk-1: timers × ink render loop flake surface (ROADMAP § M12) | T1.1 | fake-timer determinism (gemini-proven) + bounded driver |
| 7 | M12 risk-2: terminal-emulator glyph variance (ROADMAP § M12) | T1.1 | reveal reuses ONLY the existing banner glyph set (border via theme — no new glyphs) |
| 8 | < 2 s total reveal (ROADMAP § M12 objective) | T1.1, T2.2 | 12×80 ms by construction + measured in the bench |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Fake timers + ink internals could interact badly in a future ink minor | Medium | gemini precedent on the same stack; oracles fail loud; real-timer bench covers the live path | implement |
| Evaluate-once gate surprises a consumer resizing during the < 1 s reveal | Low | documented on the prop; oracle g pins the behavior honestly | implement |
| `THEOKIT_TUI_NO_MOTION` is a new project-specific env contract | Low | documented in prop docs + CHANGELOG; any non-empty value; no OS-level signal exists for terminals | implement |
| Reveal branch adds per-render work to a previously static leaf | Low | gate-closed path short-circuits to the static tree; T2.2 static mode measures the cost | implement |

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D3.)

## Test Plan

Oracles a–g (fake timers, deterministic) + pipe smoke h + 1 anchored
snapshot + bench baseline contract; two consecutive full runs green.
Discipline per `.claude/rules/testing.md` (§ 4.1 negative cases: oracles
d/e are the gate negatives; § 6 no time randomness — clock faked).

## Final Phase: Integration Validation (MANDATORY)

- `run_validation.py m12-animated-banner` exit 0; `/code-quality` PASS;
  coverage: new branches 100% lines.
- Review (multi-role) BEFORE any release — the release chain (0.13.0
  minor) runs only on READY_TO_MERGE (M10 DV-1 rule).

## Global Definition of Done

- [ ] All tasks committed gates-gated (1 task = 1 commit)
- [ ] 473+ tests green; oracles a–h present; zero weakened tests
- [ ] ≤ 1 new snapshot; manifest untouched
- [ ] Bench baseline committed; reveal ≤ 2 s measured
- [ ] Plan archived post-release
