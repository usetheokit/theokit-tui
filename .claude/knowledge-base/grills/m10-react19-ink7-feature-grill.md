---
slug: m10-react19-ink7
generated_by: roadmap-feature
date: 2026-07-07
status: completed
---
# Feature grill: m10-react19-ink7 (V2 batch, single compressed round)

## Q1 — What & why now
Upgrade the foundation to ink ^7 + honest dual react peer (^18.2||^19).
Why now: V1 closed (10/10, v0.10.0 published); the M8 rehearsal PROVED the
react-19 fresh-install break and recorded the flip condition ("flip on
ink >= 6"); every V2 feature builds on the new base (validate once).

## Q2 — Dependencies
M8 (published baseline). First of the V2 chain — M11/M12 depend on M10.

## Q3 — DoD (user-selected: completa)
1. ink ^7 dependency; react peer ^18.2||^19 HONEST — fresh-install rehearsal
   green on BOTH majors (the M8 rehearsal harness, now 2×).
2. Full suite green with no weakened test (ink 7 API renames absorbed).
3. Degrade-matrix + all 6 benches re-baselined on the new stack (ADVERSE-only
   table vs the v0.10.0 baselines).
4. Publish minor with tarball rehearsal.
5. SDK tripwire re-run + M7 DV-1 (StrictMode/ink-reconciler) re-evaluated —
   ink 7 may enable strict effects; tests adjusted HONESTLY if so.

## Q4 — Top 2 new risks
- R1: ink 7 breaking API/behavior changes ripple through 455 tests
  (borderStyle/measure/Static semantics). Mitigation: references/ink@7.1.0
  source study in DISCOVER; absorb renames task-by-task, never weaken.
- R2: dual-major react peer doubles the compat matrix. Mitigation: rehearsal
  runs 2× (react 18 AND 19) as a release AC.

## Step 5 — SOTA delta
No — references/ink is already 7.1.0 (cloned at HEAD); no new peer needed.
