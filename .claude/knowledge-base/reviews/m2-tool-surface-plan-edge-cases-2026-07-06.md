# Edge-Case Review — m2-tool-surface plan (2026-07-06)

Fresh-eyes adversarial pass (agent) over plan v1.0 → all findings ABSORBED into plan v1.1.

| Severity | IDs | Disposition |
|---|---|---|
| MUST-FIX | EC-1 (truncateLines guard + maxLines=1 slice(-0) contradiction), EC-2 (content-source exclusivity), EC-3 (`exited undefined`), EC-4 (string-children Ink crash) | ADR addenda D4/D5/D3 + RED oracles in T2.1/T2.2/T1.2 |
| SHOULD | EC-5 (20k boundary + expanded), EC-6 (CRLF), EC-7 (trailing newline oracle), EC-8 (single-line header), EC-9 (declared edges w/o oracles) | RED oracles added |
| NICE | EC-10..EC-16 | EC-10/11/12/13/15 → oracles/guards added; EC-14 → helpers.tsx WHY comment; EC-16 → JSDoc pass-through note |

Highest-value: EC-1 — the plan's own pseudocode provably contradicted its own test
(`slice(-0)` returns all lines). Fixed with explicit special case + typed-error guard.
21 RED oracles added total. Full agent report in session transcript.
