# Deps Audit: m5-metrics-surface

**Date:** 2026-07-07
**Mode:** plan-bound:m5-metrics-surface
**Verdict:** PASS
**Hard caps triggered:** (none)

## Summary

- Ecosystem: npm (real lockfile — post-M4 tree, 331 packages scanned)
- Plan `## Dependencies`: **NEW = (none)** — Rule 9 evaluation present in-table
  (chart/sparkline libs: VERIFIED ABSENCE in all analogs; numeral/pretty-bytes/humanize:
  stdlib/hand-rolled everywhere; `Intl.NumberFormat` compact: stdlib, rejected for
  oracle determinism — CLDR-version-dependent boundaries, small-icu builds, 2-sig-fig
  cap). Blueprint Corner 2 verdict: zero-dep is the unanimous analog precedent.
- Auditors: `pnpm audit --prod` ✅ + `pnpm audit` (all) ✅ + `osv-scanner --lockfile
  pnpm-lock.yaml` ✅ (all agree)
- Vulnerabilities: **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW** — the M0/M1-era esbuild
  LOW transitive (GHSA-g7r4-m6w7-qqqr) no longer fires (pnpm.overrides `esbuild
  >=0.28.1` in place since M2).

## Vulnerabilities

(none — both auditors report clean on the full tree.)

## Plan validation (Mode 2)

| Plan dep | Section | Manifest match | Audit clean? | Rule 9 OK? | Verdict |
|---|---|---|---|---|---|
| `ink@^5.2.0` | Existing | yes | ✅ | n/a | OK |
| `ink-spinner@^5.0.0` | Existing | yes (unused by M5) | ✅ | n/a | OK |
| `parse-diff@^0.12.0` | Existing | yes (unused by M5) | ✅ | n/a | OK |
| `react` peer `^18 \|\| ^19` | Existing | yes | ✅ | n/a | OK |
| `lowlight@^3.0.0` optional peer | Existing | yes (unused by M5) | ✅ | n/a | OK |
| (new) | NEW | (none — manifest delta limited to the `example:metrics` script) | — | ✅ (alternatives evaluated + rejected in-table with evidence citations) | OK |

## Recommended next steps

1. No manifest changes — proceed to `/plan-confidence`.
2. At implement, `pnpm audit` re-check after any lockfile refresh (standard).
