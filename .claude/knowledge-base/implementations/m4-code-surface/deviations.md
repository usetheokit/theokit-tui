# Logged deviations — m4-code-surface

| # | Task | Deviation | Why | Mitigation |
|---|---|---|---|---|
| DV-1 | T1.1 | Plan TDD literals assumed `a/`-prefixed names (`"b/second.ts"`, rename `"a/old.ts"`); parse-diff STRIPS the prefixes (empirically probed pre-RED) — oracles use stripped names | Plan written before the dependency probe; semantics identical (`/dev/null` mapping unaffected) | Probe recorded in transcript; JSDoc documents the stripped-name contract |
| DV-2 | T1.2 | Plan EC-12 addendum promised `useMemo` on parse; implementation parses BEFORE hooks unmemoized | The typed malformed-patch error must fire ahead of any hook for the direct-invocation contract idiom (F10 — Ink swallows render throws); guard-before-hooks wins over micro-perf | Documented in code comment; same-string reparse cost measured by the bench; memoize when profiling demands |
