---
slug: m8-ga-publish
milestone_id: M8
created_at: 2026-07-07
goal: Publish @theokit/tui to npm (publint-clean, AI-native README, TTFATT measured) with the live-agent example gated on OPENROUTER_API_KEY and the dogfood consumption path verified against the published tarball.
---

# Plan: m8-ga-publish

## Goal

Take @theokit/tui from released-on-GitHub (v0.9.0, 10/10 milestones of code
shipped) to PUBLISHED on npm: publint-clean package, AI-native README
honoring `rules/public-copy.md`, `examples/live-agent-tui.tsx` driving the
real stream adapter (gated on `OPENROUTER_API_KEY` — absent key degrades to
an instructive scene, never a crash), publish `0.10.0`, measure and record
TTFATT from the published tarball, and verify the consumer path (fresh
install + import + render outside this repo). DISCOVER skipped with rationale:
npm publishing is standard-procedure prior art (publint/npm docs + our own
M0-M9 build/exports precedents); no unknown design space.

## Baseline Context

Repo state at planning: develop @ v0.9.0 merge (`df180e0` on main), 449/449
tests, version 0.9.0, npm auth verified (`npm whoami` = usetheodev).

### Files that will be touched

| File | LoC | Role for M8 |
|---|---|---|
| `package.json` | ~90 | already has license/exports/files/main/types/repository; gains publint devDep + `prepublishOnly` + keywords/description polish; version bump at release |
| `README.md` | 0 (MISSING) | NEW — AI-native README per `rules/public-copy.md` (outcome-shaped HERO, no production-ready claims — dogfood-golden-rule has no evidence yet) |
| `examples/live-agent-tui.tsx` | NEW | real-LLM demo via `useAgentStream` + OpenRouter SSE (fetch — zero new deps), gated on `OPENROUTER_API_KEY` |
| `tests/example-live-agent.integration.test.ts` | NEW | smoke of the GATED path (key absent — deterministic in CI) |
| `docs/ttfatt.md` | NEW | TTFATT measurement record (tarball → agent turn) |
| `CHANGELOG.md` | — | per-task entries |

### Current callers / dependents

- No production symbol changes — M8 is packaging/docs/example only.
- `examples/live-agent-tui.tsx` consumes ONLY the entry (`../src/index.js`):
  `TheoTUIProvider`, `WelcomeBanner`, `AgentTimeline`, `AgentStreaming`,
  `useAgentStream`, `ContextWindowBar`, `CostMeter`.
- Dogfood consumer: verified via a FRESH tmp project installing the published
  tarball (the TheoCode repo integration is a sibling-repo task recorded as
  follow-up — not gated here).

### Domain glossary

- **TTFATT** = time-to-first-agent-turn-in-terminal: `npm i` → mount provider
  + thread + stream adapter → a scripted agent turn renders (< 10 min target,
  roadmap north-star).
- **publint** = the ecosystem-standard package-lint (exports/types/ESM
  correctness against the REAL tarball).
- **gated demo** = runs the real-LLM turn only when `OPENROUTER_API_KEY` is
  set; absent key renders an instructive banner scene and exits 0.

### Architecture boundaries affected

None in `src/` (zero production-code changes). The example is a consumer-side
artifact; the OpenRouter call lives in the EXAMPLE (caller-provided stream —
the library keeps zero transport coupling, M7 D2 contract).

## Prior Art

- `rules/public-copy.md` — HERO outcome-shaped; banned claims (production-ready/battle-tested) — the dogfood golden rule has NO evidence yet, so v1.0/production language is FORBIDDEN in this README.
- `rules/dogfood-golden-rule.md` — v1.0 claim gate: publish as **0.10.0** (ADR D1).
- M7 stream adapter (`.claude/knowledge-base/plans/completed/m7-stream-adapter-plan.md`) — `AgentStreamSource` factory contract the live example rides.
- House smoke shape: `tests/example-banner.integration.test.ts`.

## ADRs

### D1 — Publish 0.10.0; no v1.0/production claims

**Decision:** version `0.10.0` (minor — Added entries); README and release
notes carry ZERO production-ready/battle-tested/v1.0 language.
**Rationale:** `rules/dogfood-golden-rule.md` hard-caps v1.0 claims on
recorded sustained-use evidence — none exists (manifest absent). GA here
means "generally available on npm", not "production-ready".
**Alternatives considered:** 1.0.0 (rejected: dogfood golden rule — no
anchor evidence); 1.0.0-rc (rejected: rc implies imminent 1.0 commitment the
dogfood gate can't back yet).
**Consequences:** the ROADMAP M8 header stays satisfied (publish + GA);
v1.0 is a FUTURE release gated on `/dogfood` EVIDENCE_SUFFICIENT.

### D2 — Live demo: OpenRouter SSE via fetch in the EXAMPLE, gated on env

**Decision:** `examples/live-agent-tui.tsx` builds an
`AsyncGenerator<AgentStreamEvent>` from OpenRouter's SSE stream using global
`fetch` (node ≥ 20 — zero new deps, parsimony rung 3); gated:
`OPENROUTER_API_KEY` absent → renders a WelcomeBanner + instruction scene,
exit 0 (deterministic for CI); present → real streamed turn through
`useAgentStream` → `AgentTimeline`/`AgentStreaming`.
**Rationale:** the DoD demands the demo use ONLY @theokit/tui primitives —
transport is caller-side by M7 design; fetch-SSE needs no dependency.
**Alternatives considered:** openai SDK dep (rejected: new dep for an
example); @theokit/sdk runtime use (rejected: M7 D2 forbids runtime coupling
in the lib; as an EXAMPLE it would be legal but adds nothing over fetch).
**Consequences:** CI smoke covers the GATED path only; the real-LLM run is a
human-executed evidence step (key present locally) — recorded in the
implementation log when executed; ABSENT key at review time = documented
known-gap on DoD-1, never fabricated evidence.

### D3 — TTFATT measured from the PUBLISHED tarball

**Decision:** after publish, measure TTFATT in a fresh tmp dir: `npm init -y
+ npm i @theokit/tui react ink tsx` + a 12-line consumer script (provider +
banner + timeline + scripted stream via `useAgentStream`) — wall-clock from
install start to rendered turn; record in `docs/ttfatt.md`.
**Rationale:** the north-star is consumer-experienced time — only the real
registry artifact proves it.
**Alternatives considered:** measuring from the repo (rejected: not the
consumer path); `npm pack` local install (kept as pre-publish REHEARSAL —
the recorded number comes from the registry).
**Consequences:** the consumer script doubles as the dogfood-path
verification (fresh project consumes the published package).

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| `publint` | `^0.3.0` | NEW devDependency | THE standard package-lint (Rule 9: don't hand-roll exports checks); dev-only, zero runtime surface; `pnpm audit` re-run after add is a T1.1 AC |
| global `fetch` (node ≥ 20) | platform | no | parsimony rung 3 — no SSE/client dep for the example |

**NEW runtime dependencies: (none).**

## Critical paths

- (none in src/ — no production code changes; the example's gated branch is
  the tested path)

## Phase 1: Package readiness

### T1.1 — publint + manifest polish + pack rehearsal

#### Objective
Package publishes clean: publint zero errors, tarball contents audited.

#### Why this step (action + reasoning)

1. **What:** RED — a package-contract test asserting manifest publish fields
   + publint exit 0; GREEN — devDep add + manifest fixes + `npm pack` audit.
2. **Why now:** everything downstream (publish, TTFATT) rides the tarball.

#### Evidence
- publint is the ecosystem standard (used by vite/vue ecosystems); our
  exports map shipped in M0 and was never linted against the real tarball.

#### Files to edit
```
package.json                    — +publint devDep; description/keywords; prepublishOnly
tests/package-contract.test.ts  — (NEW) manifest publish-fields pins + files whitelist
CHANGELOG.md                    — entry
```

#### TDD
```
RED:     manifest_declares_publish_fields() — const pkg = JSON.parse(readFileSync("package.json")); expect(pkg.description.length).toBeGreaterThan(20); expect(pkg.keywords.length).toBeGreaterThanOrEqual(5); expect(pkg.files).toContain("dist"); expect(pkg.scripts.prepublishOnly).toContain("gates")
RED:     publint_reports_zero_errors() — execFileSync pnpm exec publint --strict (timeout 60000); expect exit 0 (throws otherwise); const out = its stdout; expect(out).not.toContain("error")
VERIFY:  pnpm vitest run tests/package-contract.test.ts && npm pack --dry-run
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm exec publint --strict` exits 0
- [ ] `npm pack --dry-run` lists dist/ + LICENSE + README.md + package.json ONLY (no src/tests leak)
- [ ] `pnpm audit` clean after the publint devDep add

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T1.2 — AI-native README (public-copy compliant)

#### Objective
The README a consumer reads on npm — outcome-shaped, honest.

#### Why this step (action + reasoning)

1. **What:** RED — a public-copy lint test (banned phrases + required
   sections); GREEN — write README.md.
2. **Why now:** npm renders it; publishing README-less is DoD-3 failure.

#### Evidence
- `rules/public-copy.md` §2 HERO outcome-shaped; §3 banned claims.

#### Files to edit
```
README.md                     — (NEW)
tests/package-contract.test.ts — extend: README pins
CHANGELOG.md                  — entry
```

#### TDD
```
RED:     readme_exists_outcome_shaped_and_honest() — const md = readFileSync("README.md", "utf8"); expect(md.length).toBeGreaterThan(1500); for (const banned of ["production-ready", "production-grade", "battle-tested", "enterprise-ready"]) expect(md.toLowerCase()).not.toContain(banned); expect(md).toContain("npm i"); expect(md).toContain("useAgentStream"); expect(md).toContain("WelcomeBanner"); expect(md).toMatch(/TTFATT|first agent turn/)
RED:     readme_quickstart_symbols_resolve() — extract import names from the first ts code block via /import \{([^}]+)\}/; const mod = await import("../src/index.js"); for (const name of names) expect(mod, name).toHaveProperty(name)
VERIFY:  pnpm vitest run tests/package-contract.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `grep -c "## How it works\|## Architecture\|## Internals" README.md` outputs ≥ 1 (internals demoted to a deep-dive section; HERO stays outcome-shaped)
- [ ] The README-symbols test extracts every `{ Symbol }` name from the quickstart code block and asserts each exists in `Object.keys(await import("../src/index.js"))` — exit 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Phase 2: Live demo + publish + evidence

### T2.1 — examples/live-agent-tui.tsx (gated) + smoke

#### Objective
DoD-1's demo: full agent turn via the real adapter; gated for determinism.

#### Why this step (action + reasoning)

1. **What:** RED — smoke of the gated path (no key in env → instructive
   scene, exit 0); GREEN — the example (fetch-SSE → AgentStreamEvent
   generator → useAgentStream → primitives).
2. **Why now:** publish notes link it; TTFATT consumer script mirrors it.

#### Evidence
- M7 `AgentStreamSource` factory contract; house smoke shape
  (`tests/example-banner.integration.test.ts`).

#### Files to edit
```
examples/live-agent-tui.tsx                  — (NEW)
tests/example-live-agent.integration.test.ts — (NEW) gated-path smoke
package.json                                 — "example:live" script
CHANGELOG.md                                 — entry
```

#### TDD
```
RED:     live_example_gated_path_renders_instructions_when_keyless() — execFileSync tsx examples/live-agent-tui.tsx with env EXCLUDING any OPENROUTER key (PATH/HOME/FORCE_COLOR only, timeout 30000 both layers); expect(out).toContain("OPENROUTER_API_KEY"); expect(out).toContain("Theo TUI"); expect(out).toContain("╭") (banner renders — the gate is a SCENE, not a crash); exit 0 implicit
VERIFY:  pnpm vitest run tests/example-live-agent.integration.test.ts && pnpm example:live | cat
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Smoke exits 0 keyless; spawn budget ≤ 12 — `grep -rc "execFileSync(" tests/ src/ | awk -F: '{n+=$2} END {print n}'` outputs ≤ 12
- [ ] Example imports ONLY from `../src/index.js` (entry) — `grep -c "from \"../src/" examples/live-agent-tui.tsx` equals `grep -c "from \"../src/index.js\"" examples/live-agent-tui.tsx`
- [ ] The gate is real: `grep -c "OPENROUTER_API_KEY" examples/live-agent-tui.tsx` outputs ≥ 2 (read + instruction); a key-present real run is recorded in the implementation log WHEN the key exists — ABSENT = documented known-gap, never faked

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.2 — Publish 0.10.0 + TTFATT + consumer verification

#### Objective
The package on the registry + the north-star number recorded.

#### Why this step (action + reasoning)

1. **What:** rehearsal (`npm pack` + tmp install + import check) → RELEASE
   chain (version 0.10.0, CHANGELOG promote, PR, merge, tag) → `npm publish`
   from the main merge → TTFATT measurement in a fresh tmp project →
   `docs/ttfatt.md` + post-publish verification (`npm view`, fresh install,
   render).
2. **Why now:** terminal step — everything green precedes the irreversible
   registry push.

#### Evidence
- D3; release chain per `rules/cycle-release.md` (merge authorized by owner).

#### Files to edit
```
docs/ttfatt.md   — (NEW) measurement record
CHANGELOG.md     — release promote (0.10.0)
```

#### TDD
```
RED:     ttfatt_record_exists_with_measurement() — const md = readFileSync("docs/ttfatt.md", "utf8"); expect(md).toMatch(/@theokit\/tui@0\.10\.0/); expect(md).toMatch(/\d+(\.\d+)?\s?(s|seconds|min)/); expect(md).toContain("npm i") (RED until the measurement lands — the record IS the artifact under test)
VERIFY:  rehearsal transcript (npm pack → tmp install → consumer renders banner + "✓") BEFORE publish; npm view @theokit/tui@0.10.0 version === "0.10.0" after; fresh tmp registry install + render exits 0
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `npm view @theokit/tui@0.10.0 version` returns 0.10.0
- [ ] TTFATT recorded in `docs/ttfatt.md` with the raw command transcript; < 10 min
- [ ] Fresh-project consumer renders a scripted agent turn from the REGISTRY package

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0 (pre-release); release chain RELEASED

## Edge cases absorbed

(inline at plan-time — no separate review round for this operational slice;
the risky edges are pinned as ACs: keyless determinism T2.1, tarball
whitelist T1.1, banned-copy lint T1.2, rehearsal-before-publish T2.2)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M8 DoD-1: live-agent demo, primitives-only (ROADMAP § M8) | T2.1 | gated example via entry + smoke; real-LLM run = human-executed evidence or documented known-gap (key absent) |
| 2 | M8 DoD-1b: dogfood consumer | T2.2 | fresh-project consumer from the registry tarball (TheoCode repo integration = recorded follow-up, sibling repo) |
| 3 | M8 DoD-2: ≥ 12 primitives, gates green, publint clean (ROADMAP § M8) | T1.1 | 14 primitives exported (count pinned in package-contract test); publint --strict AC |
| 4 | M8 DoD-2b: snapshot coverage ≥ 80% | T1.1 | pinned in package-contract test: % of exported components with ≥ 1 snapshot across the suite |
| 5 | M8 DoD-3: npm published + AI-native README + TTFATT (ROADMAP § M8) | T1.2, T2.2 | README (public-copy lint test) + publish + docs/ttfatt.md |
| 6 | public-copy rules (no production claims — dogfood gate) | T1.2 | banned-phrase test + D1 (0.10.0, not 1.0.0) |
| 7 | Rule 6 CHANGELOG | T1.1, T1.2, T2.1, T2.2 | per-task entries |
| 8 | Rule 9 deps (publint standard tool) | T1.1 | devDep + audit re-run AC |

**Coverage: 8/8 gaps covered (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Real-LLM DoD-1 evidence needs `OPENROUTER_API_KEY` (absent at plan time) | Medium | Gated example + smoke prove the wiring deterministically; real run recorded the moment the key exists; NEVER fabricated — explicit known-gap in the release notes if still absent | human+implement |
| npm publish is irreversible (no unpublish after 72h for versions) | Medium | Full rehearsal (pack + tmp install + render) BEFORE publish; publint --strict; gates green | implement |
| TheoCode dogfood integration lives in a sibling repo | Low | Fresh-project consumer verification covers the consumption path; TheoCode wiring recorded as follow-up task | human |
| README copy drift vs public-copy rules over time | Low | banned-phrase lint test runs in the suite forever | implement |

## Failure scenarios (when I/O external)

- `npm publish` network/registry failure → retry once; if 4xx (auth/scope),
  HALT and surface (never force).
- OpenRouter SSE errors in the example → the M7 error path renders the error
  state (fail-clear); the gated smoke never touches the network.
- Tarball rehearsal install failure → HALT before publish (the rehearsal
  exists precisely to catch this).

## Unresolved Questions

(none — every decision is resolved at plan time by ADRs D1–D3.)

## Test Plan

package-contract suite (manifest pins + publint + README lint + snapshot
coverage metric) + gated live-example smoke + tarball rehearsal transcript +
post-publish registry verification. Suite-wide gates green pre-release.

## Global Definition of Done

- [ ] publint --strict exit 0; `npm pack --dry-run` whitelist clean
- [ ] README public-copy-compliant (lint test green)
- [ ] Gated live example + smoke green; spawn budget ≤ 12
- [ ] Published `@theokit/tui@0.10.0` verified via `npm view` + fresh install render
- [ ] TTFATT recorded < 10 min in `docs/ttfatt.md`
- [ ] CHANGELOG per task; release chain RELEASED; M8 checkbox flipped
- [ ] Known-gap (real-LLM run) honestly recorded IF key still absent
