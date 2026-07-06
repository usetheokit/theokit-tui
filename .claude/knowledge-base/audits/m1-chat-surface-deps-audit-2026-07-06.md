# Deps Audit: m1-chat-surface

**Date:** 2026-07-06
**Mode:** plan-bound:m1-chat-surface
**Verdict:** PASS_WITH_CAVEATS
**Hard caps triggered:** (none)

## Summary

- Ecosystem: npm (real lockfile — v0.1.0 released tree)
- Plan `## Dependencies`: **NEW = (none)** — Rule 9 evaluation present (string-width/clipboardy/
  chalk explicitly rejected with reasons; Blueprint Corner 2 verdict: Intl.Segmenter built-in,
  ink provides Static/useInput/useFocus)
- Auditors: `pnpm audit` ✅ + `osv-scanner --lockfile` ✅ (agree)
- Vulnerabilities: 0 CRITICAL / 0 HIGH / 0 MEDIUM / **1 LOW transitive** (unchanged from M0)

## Vulnerabilities

### GHSA-g7r4-m6w7-qqqr — LOW (esbuild, TRANSITIVE via tsup/vitest)
- Same finding as the M0 audit: dev-only bundler chain, Windows-dev-server scenario — not
  applicable (esbuild used as build-time bundler; Linux dev/CI). Recorded, not blocking.

## Plan validation (Mode 2)

| Plan dep | Section | Manifest match | Audit clean? | Rule 9 OK? | Verdict |
|---|---|---|---|---|---|
| `ink@^5.2.0` | Existing | yes (v0.1.0 manifest) | ✅ | n/a | OK |
| `react` peer `^18 \|\| ^19` | Existing | yes | ✅ | n/a | OK |
| (new) | NEW | (none) | — | ✅ (alternatives evaluated + rejected in-table) | OK |

## Recommended next steps

1. No manifest changes — proceed to `/plan-confidence`.
2. At implement, `pnpm audit` re-check after any lockfile refresh (standard).
