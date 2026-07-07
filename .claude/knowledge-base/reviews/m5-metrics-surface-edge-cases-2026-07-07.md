# Edge-Case Review — m5-metrics-surface discovery plan (2026-07-07)

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| EC-1 | MUST-FIX | Fill-count vs %-label rounding agreement at the 0%/100% edges | Q2 must state analogs' rounding direction for BOTH |
| EC-2 | MUST-FIX | Over-limit inputs (used > limit) — clamp/overflow/mark | Q1 collects; internal-precedent fallback if silent |
| EC-3 | SHOULD | k/M threshold honesty (999/1000/1.05M exact behavior) | Q3 exact table |
| EC-4 | SHOULD | Minimum meaningful bar width + label-only degrade | Q2 (roadmap risk 1) |
| EC-5 | SHOULD | NO_COLOR gauge glyph distinctness (filled vs empty) | Q4 (M2 sign-column lesson) |

All absorbed in plan § "Edge cases absorbed" (pre-score).
