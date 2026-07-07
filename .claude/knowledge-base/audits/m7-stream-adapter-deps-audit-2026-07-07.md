# Deps Audit: m7-stream-adapter

**Date:** 2026-07-07
**Mode:** plan-bound:m7-stream-adapter
**Verdict:** PASS
**Hard caps triggered:** (none)

## Summary

- Ecosystem: npm (real lockfile — post-M6 tree, 331 packages scanned)
- Plan `## Dependencies`: **NEW runtime = (none)**; **NEW devDependency =
  `@theokit/sdk ^2.18.1`** — Rule 9 evaluation present in-table (no-dep rejected:
  the drift tripwire is the milestone's #1 risk mitigation and needs the real types;
  exact pin rejected: caret + lockfile keeps reproducibility while a deliberate
  update exercises the tripwire — the sibling theo-ui's exact precedent;
  `workspace:*` unavailable — theokit-tui is a standalone pnpm project, verified).
- Registry facts (live): `@theokit/sdk` latest **2.19.0**, Apache-2.0 (license
  compatible with our Apache-2.0). NOTE: `^2.18.1` resolves to 2.19.0 at install —
  the tripwire will check against the NEWEST 2.x, which is the intended behavior
  (drift in a new minor is caught at install time, not discovered in production).
- Coupling discipline: `import type` only (runtime-erased); consumed exclusively by
  `tests/sdk-assignability.test.ts` + the optional demo variant; the manifest test
  pins the sdk OUT of `dependencies`/`peerDependencies`.
- Auditors: `pnpm audit --prod` ✅ + `osv-scanner --lockfile pnpm-lock.yaml` ✅
  (both clean; re-check REQUIRED after `pnpm add -D @theokit/sdk` lands — recorded
  as a T3.1 acceptance criterion in the plan).
- Vulnerabilities (pre-add): **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW**

## Vulnerabilities

(none — both auditors report clean on the current tree. The sdk devDep add at T3.1
carries its own `pnpm audit` acceptance criterion.)

## Plan validation (Mode 2)

| Plan dep | Section | Manifest match | Audit clean? | Rule 9 OK? | Verdict |
|---|---|---|---|---|---|
| `ink@^5.2.0` | Existing | yes | ✅ | n/a | OK |
| `react` peer | Existing | yes (the hook's ONLY runtime import — mirror-proven) | ✅ | n/a | OK |
| `ink-spinner`/`parse-diff`/`lowlight` | Existing | yes (unused by M7) | ✅ | n/a | OK |
| `@theokit/sdk@^2.18.1` | NEW (devDependency ONLY) | pending T3.1 (`pnpm add -D`) | re-audit at T3.1 (AC) | ✅ (alternatives evaluated + rejected in-table; first-party, Apache-2.0, ESM) | OK |

## Recommended next steps

1. Proceed to `/plan-confidence`.
2. At T3.1: `pnpm add -D @theokit/sdk` then `pnpm audit` (the task's AC).
