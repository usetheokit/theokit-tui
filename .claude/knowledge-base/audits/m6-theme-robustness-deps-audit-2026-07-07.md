# Deps Audit: m6-theme-robustness

**Date:** 2026-07-07
**Mode:** plan-bound:m6-theme-robustness
**Verdict:** PASS
**Hard caps triggered:** (none)

## Summary

- Ecosystem: npm (real lockfile — post-M5 tree, 331 packages scanned)
- Plan `## Dependencies`: **NEW = (none)** — Rule 9 evaluation present in-table
  (direct `supports-color`: rejected — chalk's VENDORED copy is what ink consults, a
  direct dep could diverge on NO_COLOR semantics; `color-convert`/`colorette`/
  `picocolors`: rejected — chalk already converts; perceptual ANSI mapper: rejected —
  reimplements chalk's downsampling; `deepmerge`: rejected — leaf-merge extension is
  ~20 lines and deepmerge's array-concat is a documented foot-gun). Blueprint
  Corner 2 verdict: even the biggest Ink app (gemini) pulls no theming lib; ink-ui
  adds zero color deps.
- Auditors: `pnpm audit --prod` ✅ + `pnpm audit` (all) ✅ + `osv-scanner --lockfile
  pnpm-lock.yaml` ✅ (all agree)
- Vulnerabilities: **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW**

## Vulnerabilities

(none — both auditors report clean on the full tree.)

## Plan validation (Mode 2)

| Plan dep | Section | Manifest match | Audit clean? | Rule 9 OK? | Verdict |
|---|---|---|---|---|---|
| `ink@^5.2.0` | Existing | yes (carries the chalk color pipeline — the Rule 9 boundary) | ✅ | n/a | OK |
| `ink-spinner@^5.0.0` | Existing | yes | ✅ | n/a | OK |
| `parse-diff@^0.12.0` | Existing | yes (unused by M6) | ✅ | n/a | OK |
| `react` peer `^18 \|\| ^19` | Existing | yes | ✅ | n/a | OK |
| `lowlight@^3.0.0` optional peer | Existing | yes | ✅ | n/a | OK |
| (new) | NEW | (none — manifest delta limited to the `example:themes` script) | — | ✅ (alternatives evaluated + rejected in-table with evidence citations) | OK |

## Recommended next steps

1. No manifest changes — proceed to `/plan-confidence`.
2. At implement, `pnpm audit` re-check after any lockfile refresh (standard).
