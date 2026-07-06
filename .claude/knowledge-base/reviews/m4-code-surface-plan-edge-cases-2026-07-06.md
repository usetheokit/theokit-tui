# Edge-Case Review — m4-code-surface plan (2026-07-06)

Fresh-eyes adversarial pass (agent) over plan v1.0 → all findings ABSORBED into plan v1.1.

| Severity | IDs | Disposition |
|---|---|---|
| MUST-FIX | EC-1 (lenient-parse pinned), EC-2 (fold overlap/edges), EC-3 (fold×cap×gap order), EC-4 (cap global scope), EC-5 (HEAD retention both components + streams-vs-documents rule), EC-6 (absent suite = one sequential test), EC-7 (tab policy per layer) | ADR addenda D1/D5/D6/D8 + 20 RED oracles |
| SHOULD | EC-8..EC-20 | Absorbed (mode-change fixture, contextLines=0, fold ≥2 threshold, head numbering, useMemo contract, width-invariant scoping, unmount guard, single-flight, ANSI strip, pre-generated patches, hunk mix, probe fold assert, parseUnifiedDiff error prefix) |
| NICE | EC-21..EC-26 | Absorbed (verbatim path/unicode tests, PATCH_BASIC home, wording-divergence glossary note, language-change + whitespace tests) |

Test-count DoD restated ~60. Full agent report in transcript.
