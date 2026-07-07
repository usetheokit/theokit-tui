# Deps-Audit — m4-code-surface (2026-07-06)

**Verdict: PASS**

| Package | Version | Role | License | Transitives | CVEs (OSV) |
|---|---|---|---|---|---|
| `parse-diff` | 0.12.0 | dependency | MIT | none | 0 |
| `lowlight` | ^3 (3.3.0) | OPTIONAL peer + devDep | MIT | devlop, @types/hast, highlight.js ~11.11.0 | 0 |
| `highlight.js` | ~11.11 (transitive) | via lowlight | BSD-3 | — | 2 historical (ReDoS <10.4.1, proto-pollution <10.1.2) — BOTH fixed far below the pinned ~11.11 range |

- Rule 9 tables present in plan `## Dependencies` with evaluated alternatives (hand-rolled
  parser rejected on gemini bug evidence; cli-highlight rejected on verified zero adoption;
  shiki rejected on async/weight).
- Opt-in materialization: peerDependencies + peerDependenciesMeta.optional + dynamic import
  (verified shipping pattern — react-ink-markdown).
- `pnpm audit` re-checked at T1.1/T2.1 ACs post-install.
