# Logged deviations — m4-code-surface

| # | Task | Deviation | Why | Mitigation |
|---|---|---|---|---|
| DV-1 | T1.1 | Plan TDD literals assumed `a/`-prefixed names (`"b/second.ts"`, rename `"a/old.ts"`); parse-diff STRIPS the prefixes (empirically probed pre-RED) — oracles use stripped names | Plan written before the dependency probe; semantics identical (`/dev/null` mapping unaffected) | Probe recorded in transcript; JSDoc documents the stripped-name contract |
