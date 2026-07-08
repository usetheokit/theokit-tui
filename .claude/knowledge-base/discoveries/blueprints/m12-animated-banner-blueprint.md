---
slug: m12-animated-banner
milestone_id: M12
created_at: 2026-07-08
discovery_plan: .claude/knowledge-base/discoveries/plans/m12-animated-banner-plan.md
question: How do production agent CLIs run a short (< 2 s) banner reveal that is TTY-gated, reduced-motion-aware and ALWAYS lands byte-identical to the static banner — deterministically testable under ink?
---

# Blueprint: m12-animated-banner

## Context

M12 adds an opt-in animated reveal to the M9 `WelcomeBanner`. Both peer
implementations were read end-to-end: codex `welcome.rs` (220 lines) +
`ascii_animation.rs` (106 lines), gemini `useSnowfall.ts` (162 lines) +
its deterministic test (127 lines). Q1–Q5 all `done`.

## Objective

Lock the driver (elapsed-derived phase, fake-timer-testable), the gate
stack (evaluate-once), the byte-identity contract (structural — final
phase renders the static tree), oracle set and bench mode.

## Cross-cutting Comparison

| Aspect | codex (ratatui) | gemini (ink) | OURS |
|---|---|---|---|
| gate | render-time: `layout_area.height >= 37 && width >= 60` + config `tui.animations` + runtime suppression (`.claude/knowledge-base/references/codex/codex-rs/tui/src/onboarding/welcome.rs:23-24,83-86`; config default true `.claude/knowledge-base/references/codex/codex-rs/core/src/config/mod.rs:736-737,3949`) | per-render boolean: theme + width + 15 s timeout + chat-not-started (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useSnowfall.ts:83-88`) | evaluate-ONCE at mount (D2): `animated && isTTY && rows/cols ≥ MIN && !NO_COLOR-degraded && !reduced-motion` |
| gate FAIL renders | text-only lines, animation skipped entirely (`welcome.rs:88-99`) | plain `displayTitle` (`useSnowfall.ts:145`) | the static banner directly (never a 1-frame animation) |
| driver | frame index derived from `start.elapsed() % tick` — self-converging, no counter (`.claude/knowledge-base/references/codex/codex-rs/tui/src/ascii_animation.rs:44-64`), tick 80 ms (`frames.rs:71`) | `setInterval(150ms)` in useEffect, functional setState, `clearInterval` teardown (`useSnowfall.ts:105-143`) | `setInterval(80 ms)` advancing `phase 0..N`; interval CLEARED at `phase===N` (bounded — codex loops forever, ours must end < 2 s) |
| determinism in tests | `FrameRequester::test_dummy()` (`welcome.rs:143`) | `vi.useFakeTimers` + `act` + `setSystemTime` (`useSnowfall.test.tsx:39-49`) — PROVEN with ink | fake timers + act (gemini idiom) |
| teardown | n/a (widget) | `clearInterval` in effect cleanup + debug counter (`useSnowfall.ts:139-142`) | same + M11 console.error-spy oracle |

## Recommendations

1. Prop `animated?: boolean` on `WelcomeBanner` (opt-in, default false) —
   no second component; gate-closed path IS the existing static render
   (byte-identity by construction on that path).
2. Reveal design: `phase` state 0..N (N=12, tick 80 ms ⇒ 0.96 s < 2 s);
   intermediate phases render the SAME box with progressively revealed
   content (name substring typewriter + hints appearing); **`phase===N`
   renders exactly the static element tree** — structural convergence.
3. Fake-timer oracle suite (gemini precedent proves ink+fake timers) +
   getter-shadow for `isTTY`/`rows` (house `renderAtColumns` idiom).
4. OWN bench mode (M9 flip condition fires — per-frame path exists).

## Coverage Corner 1 — Integration Tests

Gemini's test proves ink + `vi.useFakeTimers` + `act(advanceTimersByTime)`
is deterministic (`useSnowfall.test.tsx:39-49,51-62`). Oracle set:

(a) **gate-closed identity** — `animated` under non-TTY ⇒ output byte-equal
to the static render in the SAME test (EC-3: compare two live renders,
never a recorded string); (b) **convergence identity** — gate OPEN, advance
fake timers past N×tick ⇒ final frame byte-equal to static render (EC-3
again); (c) **reveal progresses** — intermediate phase ≠ final (some
mid-script frame lacks content the final has); (d) **reduced-motion
negative** — env set ⇒ static path immediately; (e) **min-dims negative** —
rows/cols below MIN ⇒ static path (codex `welcome_skips_animation_below_
height_breakpoint` shape, `welcome.rs:156-168`); (f) **teardown** — unmount
mid-reveal ⇒ no dangling timer (`vi.getTimerCount()===0`) + console.error
spy clean (EC-2, M11 idiom); (g) **evaluate-once** — dims shrink mid-reveal
do NOT abort (D2 pin); (h) pipe smoke — piped example prints the STATIC
scene exactly once (ink7 single-final-frame contract). Snapshot budget:
≤ 1 (one mid-reveal frame, anchored).

## Coverage Corner 2 — Dependencies

**Zero.** Driver = `setInterval` + react state + ink `Text`/`Box` (all
present). codex ships its animation dep-free in-tree (`ascii_animation.rs`
uses std only); gemini likewise (`useSnowfall.ts` imports react + local
utils only). No easing/motion lib (Rule 9/KISS). Manifest untouched.

## Coverage Corner 3 — Tools

**Bench (REQUIRED — M9 flip condition):** new `benchmarks/welcome-banner.bench.tsx`
mode measuring ms/frame across the full reveal script (N phases driven by
real timers at tick 80 ms under `debug:true`, plus a rerender-loop variant
for CPU-pure cost), aggregated by the existing harness conventions
(`benchmarks/run.ts` — stack provenance field, FORCE_COLOR=1, warmup+5
runs, load gate < 4). Baseline JSON committed
(`docs/benchmarks/m12-welcome-banner-baseline.json`).
**Example/smoke:** extend `examples/banner.tsx` with the animated variant
behind the gate (pipe ⇒ non-TTY ⇒ static path ⇒ deterministic — DoD's
"pipe → static path" smoke lands free); existing
`tests/example-banner.integration.test.ts` gains the static-scene assert.

## Coverage Corner 4 — Techniques

**Gate stack (D2 final):** evaluated ONCE at mount via
`useRef(evalGate()).current` (M11 mount-freeze precedent):
`animated===true && stdout.isTTY===true && rows ≥ 15 && columns ≥ 44 &&
!monochrome-degrade && process.env["THEOKIT_TUI_NO_MOTION"] unset`.
MIN values ours (codex's 37/60 sized for its huge art, `welcome.rs:23-24`;
our banner is ≤ 9 rows / clamp ≤ 60 cols — 15/44 gives headroom without
being codex-large). Reduced-motion: no OS-level signal reaches a Node
terminal process; peers use config not env (codex `tui.animations`); we
expose the documented env `THEOKIT_TUI_NO_MOTION` (any non-empty value) as
the end-user override — the library-appropriate analog of the config flag.
Evaluate-once kills mid-reveal gate flips (EC-1; gemini's per-render gate
can strand partial frames — `useSnowfall.ts:145` returns the RAW title
mid-animation when the gate flips, discontinuity we reject).

**Driver:** `const [phase, setPhase] = useState(0)`; effect (gate-open
only): `setInterval(() => setPhase(p => { const n = p + 1; if (n >= N)
clearInterval(id); return Math.min(n, N); }), TICK)`; cleanup
`clearInterval` (gemini `useSnowfall.ts:139-142` shape) — bounded, unlike
both peers (codex loops forever; gemini stops via 15 s timeout).

**Byte-identity (EC-3, structural):** the render function has exactly two
top-level branches: `if (!gateOpen || phase >= N) return <StaticBanner/>`
— the SAME JSX the static path returns. Identity is by construction;
tests (a)/(b) pin it against drift.

**Exit note:** piped runs never open the gate (isTTY false) ⇒ examples
stay deterministic; interactive TTY runs converge at phase N and the final
frame persists (ink repaints the same tree).

## ADRs

### D1 — Opt-in `animated` prop + bounded phase driver (FINAL)

N=12 phases × 80 ms tick = 0.96 s (< 2 s DoD). **Alternatives:** separate
`AnimatedWelcomeBanner` component (rejected: two exports for one banner —
API bloat, and byte-identity would cross component boundaries);
elapsed-derived phase à la codex (rejected: needs a clock injectable AND
a re-render driver anyway — interval+state is the proven ink idiom);
unbounded loop + external stop à la gemini (rejected: DoD requires < 2 s
and convergence).

### D2 — Gate stack evaluated once at mount (FINAL)

Per Corner 4. **Alternatives:** per-render re-evaluation (rejected:
mid-reveal flips create partial-frame discontinuity, traced in gemini);
prop-only without env override (rejected: reduced-motion is an end-user
preference — the app can't know it).

### D3 — Evidence: own bench + example gate-path smoke (FINAL)

Per Corner 3. **Alternatives:** skip bench citing "short animation"
(rejected: the M9 flip condition is a recorded contract — per-frame path
⇒ bench, no exceptions).
