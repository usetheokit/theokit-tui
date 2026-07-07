# Deps Audit: m9-welcome-banner

**Date:** 2026-07-07
**Mode:** plan-bound:m9-welcome-banner
**Verdict:** PASS
**Hard caps triggered:** (none)

## Summary

- Ecosystem: npm (real lockfile — post-v0.8.0 tree, 334 packages scanned)
- Plan `## Dependencies`: **NEW runtime = (none)**; **NEW devDependencies =
  (none)** — the blueprint's Corner 2 verdict table evaluated and REJECTED
  every candidate with source evidence (ink-gradient, gradient-string,
  figlet, cfonts, string-width); border via ink's built-in `borderStyle`
  (cli-boxes already installed via ink), color via M6 theme tokens
  (parsimony rungs 3-4; Rule 9 satisfied by reuse).
- Auditors: `pnpm audit --prod` ✅ clean + `pnpm audit` (dev included) ✅
  clean + `osv-scanner --lockfile pnpm-lock.yaml` ✅ (334 packages, 0 issues).
- Vulnerabilities: **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW**

## Plan validation (Mode 2)

| Plan dep | Section | Manifest match | Audit clean? | Rule 9 OK? | Verdict |
|---|---|---|---|---|---|
| `ink@^5.2.0` (borderStyle + useStdout) | Existing | yes | ✅ | native feature reuse | OK |
| `react` peer | Existing | yes | ✅ | n/a | OK |
| ink-gradient / gradient-string / figlet / cfonts / string-width | NOT ADDED | correctly absent | n/a | evaluated + rejected in blueprint Corner 2 with evidence | OK |

## Recommended next steps

1. Proceed to `/plan-confidence`.
