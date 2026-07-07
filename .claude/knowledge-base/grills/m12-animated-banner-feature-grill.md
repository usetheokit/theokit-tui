---
slug: m12-animated-banner
generated_by: roadmap-feature
date: 2026-07-07
status: completed
---
# Feature grill: m12-animated-banner (V2 batch, single compressed round)

## Q1 — What & why now
Opt-in animated banner reveal (<2s, codex/Copilot-CLI style). Why now: the
M9 blueprint recorded the flip condition (per-frame path ⇒ own bench) and
the brand-moment value is proven by the peers (Copilot CLI engineering post).

## Q2 — Dependencies
M10 (new base) — and it inherits M9's static banner as the degrade target.

## Q3 — DoD (user-selected: completa)
1. Opt-in variant (animate prop or component) — short reveal, gated by TTY +
   codex-style MIN rows/cols; reduced-motion respected.
2. ALWAYS degrades to the static banner (non-TTY/NO_COLOR/narrow — final
   scene byte-identical to static).
3. OWN BENCH mandatory before merge (the recorded M9 flip condition).
4. Example + deterministic smoke (pipe → static path).
5. Gates/coverage/CHANGELOG house standard.

## Q4 — Top 2 new risks
- R1: animation timers × ink render loop = flake surface. Mitigation:
  timer-free test fakes (house discipline) + deterministic frame script.
- R2: terminal-emulator variance for block glyphs (gemini's Apple Terminal
  special-case). Mitigation: conservative glyph set + degrade ladder.

## Step 5 — SOTA delta
No — codex (AsciiAnimation + MIN_ANIMATION gates) and ascii-motion (authoring,
by the Copilot CLI banner designer) already cloned for M9.
