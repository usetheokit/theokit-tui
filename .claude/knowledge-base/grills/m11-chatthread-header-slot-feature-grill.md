---
slug: m11-chatthread-header-slot
generated_by: roadmap-feature
date: 2026-07-07
status: completed
---
# Feature grill: m11-chatthread-header-slot (V2 batch, single compressed round)

## Q1 — What & why now
`header?: ReactElement` slot on ChatThread/AgentTimeline folded as the FIRST
item of the component's own <Static> (gemini AppHeader shape). Why now: the
M9 D4 drawback is RECORDED (banner sinks below graduated history) with this
exact flip condition; V2 is the moment to honor it.

## Q2 — Dependencies
M10 — the Static/reconciler semantics must be validated ONCE, on the new base.

## Q3 — DoD (user-selected: completa)
1. `header` prop folded as first item of the EXISTING <Static>.
2. M9 drawback resolved — test proving the banner stays PINNED above frozen
   scrollback after graduation.
3. Single-<Static> invariant preserved (pin: never a second Static).
4. Example updated + snapshot (budget respected).
5. Gates/coverage/CHANGELOG house standard.

## Q4 — Top 2 new risks
- R1: header inside Static = printed ONCE — later header changes invisible
  (the gemini refreshStatic trap). Mitigation: document immutable-header
  contract; identity-change detection throws or re-keys (decided in plan).
- R2: interleaving with windowing/graduation ordering. Mitigation: the M3
  windowing suite extended with header-present scenarios.

## Step 5 — SOTA delta
No — gemini-cli (AppHeader/MainContent first-Static-item) already cloned.
