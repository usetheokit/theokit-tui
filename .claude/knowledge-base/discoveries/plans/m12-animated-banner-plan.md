---
slug: m12-animated-banner
milestone_id: M12
created_at: 2026-07-08
question: How do production agent CLIs run a short (< 2 s) banner reveal animation that is TTY-gated, reduced-motion-aware and ALWAYS lands on a final frame byte-identical to the static banner — and how is that testable deterministically under ink?
---

# Discovery Plan: m12-animated-banner

## Context

M12 adds an opt-in animated variant to the M9 `WelcomeBanner`
(`src/welcome-banner.tsx`, 126 LoC, shipped 0.9.0). DoD (ROADMAP § M12):
TTY + min rows/cols gate (codex-style), reduced-motion respected, degrade
to the static banner byte-identical, OWN bench (the recorded M9 flip
condition — this feature HAS a per-frame path), example + deterministic
pipe smoke. Peers on disk: codex `onboarding/welcome.rs` (Rust/ratatui
reveal), gemini `useSnowfall.ts` (ink animation hook + its test), ascii-
motion (animation editor — technique source). Prior house facts: ink7
pipe = ONE final frame at unmount (M10 pin); spinner timers already flake-
managed via phase normalization (M10); `useAgentStream` established the
timer-free deterministic-source test idiom (M7).

## Objective

Blueprint locking: the animation driver design (timer hook vs frame-
script), the gate stack (TTY/rows/cols/reduced-motion/NO_COLOR), the
byte-identical degrade contract, the deterministic oracle set, and the
bench mode shape.

## In-Scope / Out-of-Scope

**In:** one opt-in animated reveal on WelcomeBanner; gate stack; final-
frame convergence contract; own bench mode; example + smoke.
**Out:** general-purpose animation framework (YAGNI); multiple animation
styles; animating ChatThread/AgentTimeline content; sixel/kitty graphics.

## ADRs

### D1 — Animation driver: injectable clock, static final frame (preliminary)

**Decision shape:** a `useBannerReveal` hook driving N frames over < 2 s
via `setInterval`, with an injectable scheduler/now source for tests
(house idiom from M7); the LAST frame renders exactly the static
`WelcomeBanner` tree so convergence is structural, not asserted-by-hope.
**Alternatives:** ink-spinner-style throwaway timer (rejected shape: not
reduced-motion-aware); CSS-like easing lib (Rule 9: no dep needed).
**Consequences:** Q1/Q2 must verify how peers schedule + how they stop.

### D2 — Gate stack evaluated once, at render (preliminary)

**Decision shape:** animation eligibility = `isTTY && rows ≥ MIN &&
columns ≥ MIN && !reducedMotion && !NO_COLOR-degraded`, read ONCE at
first render (M9 columns-frozen precedent); ineligible ⇒ render the
static banner directly (not a 1-frame animation).
**Alternatives:** re-evaluate per tick (rejected: mid-reveal gate flips
create partial states the byte-identity contract can't cover); prop-only
opt-out without env (rejected: reduced-motion is an end-user preference,
not an app decision).
**Consequences:** Q4 must resolve the env-var convention; Q3 pins the
evaluate-once semantics.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | codex welcome reveal mechanics: MIN_ANIMATION_HEIGHT/WIDTH gate values, frame schedule (duration, fps), what renders when the gate FAILS, and how the animation STOPS (converges to a final frame?) | techniques | `.claude/knowledge-base/references/codex/codex-rs/tui/src/onboarding/welcome.rs` | Grep `MIN_ANIMATION\|Duration\|frame` | Read welcome.rs end-to-end | Gate values + schedule + convergence contract — citations |
| Q2 | gemini useSnowfall: ink-side animation hook anatomy — timer setup/teardown, state shape per tick, how its TEST makes it deterministic (fake timers? frame script?), interplay with ink render throttling | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useSnowfall.ts`, `useSnowfall.test.tsx` | Grep `setInterval\|useEffect\|advanceTimers` | Read hook + test end-to-end | Hook + deterministic-test idiom — citations |
| Q3 | Oracle set: deterministic reveal test (injected clock → frame script), byte-identical degrade proof (animated w/ gate CLOSED === static render output), pipe smoke (final frame only), reduced-motion negative, min-dims negative; snapshot budget | tests | our `src/welcome-banner.test.tsx` idioms, `tests/degrade-matrix.integration.test.tsx`, gemini `useSnowfall.test.tsx` | Grep our renderAtColumns/pipe idioms | Design the oracle extensions | Oracle set + budget — citations |
| Q4 | Deps: zero new deps expected (setInterval + ink Text; no easing/motion lib); reduced-motion detection = env only (`NO_MOTION`?/`REDUCED_MOTION`?) — which convention do peers/Node CLIs use? | deps | our `package.json`, codex welcome.rs env reads, gemini settings | Grep `REDUCE\|NO_MOTION\|env` in peers | Confirm convention + zero-dep verdict | Rule 9 verdict + env-var name — citations |
| Q5 | Evidence: OWN bench mode shape (per-frame path — M9 flip condition FIRES); what to measure (ms/frame across the reveal, N frames), example (`examples/banner.tsx` extend vs new), smoke (pipe → static path, deterministic under the ink7 single-final-frame contract) | tools | our `benchmarks/chat-thread.bench.tsx` harness, `examples/banner.tsx`, `tests/example-banner.integration.test.ts` | Map the bench harness reuse surface | Decide bench mode + example + smoke shape | Evidence plan — citations |

## Edge-case annotations (MUST-FIX absorbed)

- **MUST-FIX EC-1 (→ Q1/Q3):** gate evaluation TIME — dims can change
  between module load and render; the gate must read dims AT RENDER (our
  M9 columns-frozen-at-render precedent) and the oracle must pin which
  moment wins.
- **MUST-FIX EC-2 (→ Q2/Q3):** timer teardown on early unmount (user
  Ctrl-C mid-reveal) — no dangling interval, no post-unmount setState
  warning; oracle: unmount mid-script + console.error spy (M11 idiom).
- **MUST-FIX EC-3 (→ Q3):** byte-identity is against the CURRENT static
  banner render, not a recorded string — compose both in ONE test so the
  contract survives future static-banner edits.
- **MUST-FIX EC-4 (→ Q5):** bench must measure the ANIMATED path (per-
  frame cost across the reveal), not the static path already covered by
  M9's no-new-bench rationale.

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q3 | Covered |
| Dependencies | Q4 | Covered |
| Tools | Q5 | Covered |
| Techniques | Q1, Q2 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

- Q1/Q2 done: driver + gate verdicts with citations.
- Q3/Q4/Q5 done: oracle set + deps verdict + evidence plan.
- Blueprint: 4 corners, ADRs final.

## Acceptance Criteria

- Every question `done`; citations resolve; blueprint ≥ SHIPPABLE_WITH_CAVEATS.

## Global Definition of Done

- Blueprint at `discoveries/blueprints/m12-animated-banner-blueprint.md`
  consumable task-by-task by the M12 plan.
