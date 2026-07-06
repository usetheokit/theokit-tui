# Deps Audit: m0-walking-skeleton

**Date:** 2026-07-05
**Mode:** plan-bound:m0-walking-skeleton
**Verdict:** PASS_WITH_CAVEATS
**Hard caps triggered:** (none)

## Summary

- Ecosystems detected: none in repo (pre-code) — audit surface = plan `## Dependencies` (all NEW)
- Method: scratch `package.json` with the plan's exact ranges → `npm install --package-lock-only`
  (lockfile, 5224 lines) → `npm audit --json` + `osv-scanner --lockfile` cross-check
- Total deps audited: 13 declared (1 runtime + 1 peer + 11 dev) + full transitive tree
- Vulnerabilities found: 0 CRITICAL, 0 HIGH, 0 MEDIUM, **1 LOW (transitive)**
- Outdated: 1 MAJOR (ink 5→6, ADR-pinned), 0 unjustified
- Allowlist hits: 0
- Auditor coverage: { npm-audit: ran ✅, osv-scanner: ran ✅ (agree: same single finding) }

## Vulnerabilities (sorted by severity)

### GHSA-g7r4-m6w7-qqqr — LOW (npm: esbuild@0.27.7, TRANSITIVE)

- **Summary:** esbuild allows arbitrary file read when running the development server on Windows.
- **Path:** root → tsup/vitest → esbuild (devDependency chain; NOT in the published package)
- **Fixed in:** > 0.28.0 (npm reports `fix available`)
- **Applicability to this plan:** NOT applicable at runtime — esbuild is used as a build-time
  bundler, never as a dev server; CI and dev machines are Linux. Dev-only, non-shipping.
- **Diff suggestion:** none needed at plan level (transitive); at implement time,
  `pnpm audit` will re-check and lockfile resolution may already land on a fixed version.
- **Cap:** transitive LOW → soft warning only (per skill § Step 4.4). Recorded, not blocking.

## Outdated (non-vulnerable)

### npm: ink@5.2.1 → 6.x (MAJOR)

- **Status:** DELIBERATE — pinned by ADR D1 (blueprint): ink 6 requires react ≥19.2 + node ≥22,
  violating the locked roadmap constraints (Node ≥20, React 18/19). Revisit at M6.
- Rubric: "Outdated MAJOR **without ADR**" would cap at 89 — an ADR exists, so no cap from this.

## Plan validation (Mode 2)

Registry existence + version resolution (queried 2026-07-05):

| Plan dep | Kind | Registry match | Audit clean? | Rule 9 OK? | Verdict |
|---|---|---|---|---|---|
| `ink@^5.2.0` | dependency (NEW) | 5.2.1 ✅ | ✅ | ✅ (reconciler out of scope; alternatives in blueprint ADR D1: ink 6 rejected) | OK |
| `react@^18.0.0 \|\| ^19.0.0` | peer (NEW) | 18.3.1 ✅ | ✅ | ✅ (roadmap lock — only peer) | OK |
| `react@^18.3.1` | dev (NEW) | 18.3.1 ✅ | ✅ | ✅ (mirrors ink-ui dev posture) | OK |
| `@types/react@^18.3.0` | dev (NEW) | 18.3.31 ✅ | ✅ | ✅ (DefinitelyTyped standard) | OK |
| `typescript@^5.6.0` | dev (NEW) | 5.9.3 ✅ | ✅ | ✅ | OK |
| `tsup@^8.3.0` | dev (NEW) | 8.5.1 ✅ | ✅ | ✅ (ADR D3: tsc/tsdown rejected w/ reasons) | OK |
| `vitest@^3.0.0` | dev (NEW) | 3.2.6 ✅ | ✅ | ✅ (ADR D2: ava rejected) | OK |
| `@vitest/coverage-v8@^3.0.0` | dev (NEW) | 3.2.6 ✅ | ✅ | ✅ (pairs with vitest) | OK |
| `ink-testing-library@^4.0.0` | dev (NEW) | 4.0.0 ✅ | ✅ | ✅ (canonical Ink test lib) | OK |
| `eslint@^9.0.0` | dev (NEW) | 9.39.4 ✅ | ✅ | ✅ (ADR D7: xo/oxlint rejected w/ reasons) | OK |
| `typescript-eslint@^8.0.0` | dev (NEW) | 8.62.1 ✅ | ✅ | ✅ (standard TS-lint integration) | OK |
| `prettier@^3.3.0` | dev (NEW) | 3.9.4 ✅ | ✅ | ✅ | OK |
| `tsx@^4.19.0` | dev (NEW) | 4.23.0 ✅ | ✅ | ✅ (mirrors react-ink bench runner) | OK |

### Plan unresolved questions — RESOLVED by this audit

- **Q-U1 (ink-testing-library × ink 5):** `ink-testing-library@4.0.0` declares peer only on
  `@types/react >=18` and its own devDeps pin `ink: ^5.0.0` — v4 is developed & tested against
  ink 5. **Verdict: keep `^4.0.0`; fallback to ^3 unnecessary.**
- **Q-U2 (ink 5 peer react range):** `ink@5.2.1` peers: `react >=18.0.0`, `@types/react >=18.0.0`,
  `react-devtools-core ^4.19.1` (optional-flagged in meta). **Verdict: plan's peer
  `^18.0.0 || ^19.0.0` is inside ink's accepted range — keep.** Note: ink 5 engines `node >=18`;
  our `>=20` floor is stricter — compatible.

## Recommended next steps

1. No manifest edits required (no manifest exists yet; plan ranges validated as-is).
2. Mark Q-U1/Q-U2 resolved in the plan (done in plan v1.1 annotations).
3. Proceed to `/plan-confidence`.
4. At implement (T0.1), after `pnpm install`, re-run `pnpm audit` to confirm the lockfile
   resolution keeps the esbuild finding at LOW-or-gone.
