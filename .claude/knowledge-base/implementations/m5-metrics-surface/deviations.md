# Deviations — m5-metrics-surface

## DV-1 — T1.1 ships 15 tests (plan pinned 14)
The extra test is `display_percent_is_the_left_derivation_seam` — pins the D7/EC-1
seam (`displayPercent` exported, integer-valued, `100 −` derivation) that the plan
prose mandates but no plan RED row covered. Additive; no plan behavior changed.

## DV-2 — Phase-1 mini review HIGH (`wiring_pillar_a_fail` on formatPercent): planned temporal gap
Phase 1 is pure-modules-only BY PLAN DESIGN (fill-bar/format); their first production
callers are T2.1/T2.2/T2.3 (phase 2) per the plan's Baseline Context ("New symbols
gain first callers inside this plan") and the progress checkpoint wiring notes. The
phase-1 mini review (2026-07-07) fired HIGH on the letter of pillar (a) at the
boundary. Disposition: NOT dismissed — resolved by implementing T2.1 (the caller)
immediately next, then RE-RUNNING the phase-1 mini review to evidence PASS. Recorded
here instead of gaming the checkpoint (no no-op caller was added to satisfy the gate
— that is a forbidden pattern per cycle-implement § validation halt-loop).
