---
slug: m0-walking-skeleton
milestone_id: M0
created_at: 2026-07-05
goal: Ship the @theokit/tui walking skeleton (ChatMessage + TheoTUIProvider, ESM-only) with all five gates green in CI and a committed render-benchmark baseline.
---

# Plan: M0 Walking Skeleton — @theokit/tui scaffold + ChatMessage primitive

> **Version 1.2** (v1.1 absorbed edge cases; v1.2 self-contains ADRs D1–D6, executable criteria oracles, deps-audit resolutions; /plan-confidence SHIPPABLE 91.6) (absorbs MUST FIX EC-1/EC-2 + SHOULD TEST EC-3/EC-4/EC-5 from
> `reviews/m0-walking-skeleton-plan-edge-cases-2026-07-05.md`) — Bootstraps `@theokit/tui` from an empty (pre-code) repository into a
> publishable-shape Ink 5 component library: strict-TS ESM-only package built with tsup, tested
> with vitest + ink-testing-library (deterministic snapshots), one primitive (`ChatMessage`,
> user/assistant) wrapped by a `<TheoTUIProvider>` token stub, Apache-2.0 licensing, a CI gate
> chain (format → lint → typecheck → test → build), and a render-benchmark harness whose baseline
> (mean ± std dev over ≥ 3 runs) is committed as JSON. Implements `ROADMAP.md § M0` under the
> decisions locked in the m0-walking-skeleton blueprint (SHIPPABLE 99.5).

## Goal

Enable TypeScript agent-CLI developers to render a `ChatMessage` (user/assistant) inside
`<TheoTUIProvider>` from the built `@theokit/tui` package so that the M0 walking skeleton is
proven end-to-end, measured by the CI gate chain `format → lint → typecheck → test → build`
exiting 0 on `develop`.

## Context

The repository is pre-code: only `ROADMAP.md`, `CLAUDE.md`, `.gitignore` and the `.claude/` kit
exist (see Baseline Context). `ROADMAP.md § M0` defines the walking skeleton as the thinnest
vertical slice proving the whole toolchain; every scaffold decision here is load-bearing for
M1–M8. The DISCOVER cycle produced a SHIPPABLE blueprint
(`m0-walking-skeleton-blueprint.md`, 99.5/100) that locked six ADRs after studying
assistant-ui/react-ink (direct analog), ink, ink-ui, and gemini-cli. The cycle owner additionally
requires **benchmark data** (real numbers, statistical rigor) as an acceptance signal for this
milestone. No `/grill-me` was run for this plan: requirements come fully resolved from the
roadmap grill (all 7 dimensions answered at inception) plus the blueprint.

## Baseline Context (deep review of current state)

### Files that will be touched

| File | LoC today | Last commit (sha + date) | Why it exists today | Invariants to preserve |
|---|---|---|---|---|
| `.claude/rules/code-quality-languages.txt` | 21 | `b77ff73` (2026-07-05) | Per-project language enablement for `/code-quality` (all commented out — pre-code) | Keep file format (one identifier per line, `#` comments) |
| `.gitignore` | 12 | `cf0d34b` (2026-07-05) | Ignores node_modules/dist/references/kit caches | Keep existing entries |
| `CHANGELOG.md` (NEW) | 0 | — | (to be created — Unbreakable Rule 6) | — |
| `LICENSE` (NEW) | 0 | — | (to be created — Apache-2.0 full text) | — |
| `NOTICE` (NEW) | 0 | — | (to be created — Apache-2.0 attribution) | — |
| `package.json` (NEW) | 0 | — | (to be created) | — |
| `tsconfig.json` (NEW) | 0 | — | (to be created) | — |
| `tsup.config.ts` (NEW) | 0 | — | (to be created) | — |
| `vitest.config.ts` (NEW) | 0 | — | (to be created) | — |
| `eslint.config.js` (NEW) | 0 | — | (to be created) | — |
| `.prettierrc.json` (NEW) | 0 | — | (to be created) | — |
| `.prettierignore` (NEW) | 0 | — | (to be created) | — |
| `src/index.ts` (NEW) | 0 | — | (to be created — public entry / composition root) | — |
| `src/theme.tsx` (NEW) | 0 | — | (to be created — tokens + provider + hook) | — |
| `src/chat-message.tsx` (NEW) | 0 | — | (to be created — first primitive) | — |
| `src/theme.test.tsx` (NEW) | 0 | — | (co-located test, `rules/testing.md § 5`) | — |
| `src/chat-message.test.tsx` (NEW) | 0 | — | (co-located test) | — |
| `tests/package-manifest.test.ts` (NEW) | 0 | — | (packaging-contract test) | — |
| `tests/public-api.integration.test.tsx` (NEW) | 0 | — | (integration test via public entry) | — |
| `benchmarks/chat-message.bench.tsx` (NEW) | 0 | — | (render benchmark workload) | — |
| `benchmarks/run.ts` (NEW) | 0 | — | (bench runner, tsx-spawned) | — |
| `docs/benchmarks/m0-chat-message-baseline.json` (NEW) | 0 | — | (committed benchmark baseline) | — |
| `examples/basic.tsx` (NEW) | 0 | — | (runnable demo — wiring-triad caller) | — |
| `.github/workflows/ci.yml` (NEW) | 0 | — | (CI gate chain) | — |

Reference (not modified): `ROADMAP.md` (217 LoC, `b77ff73`), `CLAUDE.md` (69 LoC, `fee8df7`).

### Current callers / dependents

(none — pre-code repository; no existing production symbol is modified. The new public symbols
`ChatMessage`, `TheoTUIProvider`, `useTheoTheme`, `defaultTheme` gain their first callers inside
this plan: `examples/basic.tsx`, `benchmarks/chat-message.bench.tsx`, and the test files listed
above.)

### Domain glossary

- **primitive** — one exported terminal component of the AI-agent surface (here: `ChatMessage`).
- **walking skeleton** — thinnest end-to-end slice proving the whole toolchain, not a feature.
- **frame** — one Ink render flush to stdout; `ink-testing-library` exposes `lastFrame()`/`frames`.
- **semantic token** — named theme value (`role.user.prefix`) decoupled from raw color.
- **TTFATT** — time-to-first-agent-turn-in-terminal; north-star metric (`ROADMAP.md § Success criteria`).
- **gate chain** — `format → lint → typecheck → test → build`, each exiting 0.

### Architecture boundaries affected

Per `rules/architecture.md § 1` (composition root at the top) and `§ 3` (module cohesion):
`src/index.ts` is the package's composition root — the only public surface (`exports` map exposes
a single `.` entry). `src/theme.tsx` is the domain layer (tokens = contract; provider = wiring at
the boundary); `src/chat-message.tsx` is interface-layer (rendering), consuming the theme ONLY via
`useTheoTheme()` (DIP: component depends on the token contract, not on literal colors). No adapter
or external-I/O layer exists at M0.

## Prior Art & Related Work

- **Internal blueprint:** `knowledge-base/discoveries/blueprints/m0-walking-skeleton-blueprint.md` —
  ADRs D1–D6 are consumed verbatim by this plan (§ ADRs below maps them); Coverage Corners 1–4
  provide the `file:line` evidence for every technique borrowed.
- **Patterns skills:** (none exist yet in `skills/` — first cycle of this project.)
- **Reference projects** (read-only clones):
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/tests/helpers.tsx:13-17` — one-tick `renderFrame` helper (borrowed in T2.1).
  - `knowledge-base/references/ink-ui/package.json:71` — `FORCE_COLOR: "true"` env pin for deterministic color output (borrowed in T0.2 vitest config).
  - `knowledge-base/references/ink-ui/test/progress-bar.tsx:10-12` — `<Box width={N}>` width control (borrowed in T2.1).
  - `knowledge-base/references/assistant-ui/packages/react-ink/package.json:16-31` — types-first ESM `exports` map (borrowed in T0.1).
  - `knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/run.ts:19` + `benchmarks/long-thread.bench.tsx:205-230` — bench runner + frame-time sampling (borrowed in T3.1).
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/UserMessage.tsx:26` — role glyph prefix idiom (borrowed in T2.1).
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/semantic-tokens.ts:9-43` — semantic-token taxonomy (borrowed in T1.1).
- **External literature:** Keep a Changelog (https://keepachangelog.com/) + SemVer (https://semver.org/) — CHANGELOG format (Unbreakable Rule 6); Apache-2.0 text (https://www.apache.org/licenses/LICENSE-2.0).

## Objective

- [ ] Publishable-shape package manifest: ESM-only, types-first exports, react-only peer, `pnpm build` produces `dist/index.js` + `dist/index.d.ts`
- [ ] `ChatMessage` (user/assistant) renders in Ink wrapped by `<TheoTUIProvider>`; snapshot + semantic tests green, including a NO_COLOR smoke test
- [ ] Theme stub: flat semantic tokens + `useTheoTheme()` + `defaultTheme`, override-able via provider
- [ ] Gate chain `format → lint → typecheck → test → build` exits 0 locally AND in CI (GitHub Actions)
- [ ] Benchmark harness runs ≥ 3 measured runs (+1 warmup) and the baseline JSON (mean ± std dev) is committed under `docs/benchmarks/`
- [ ] Apache-2.0 LICENSE + NOTICE + CHANGELOG.md (`[Unreleased]` populated) exist at repo root
- [ ] `typescript` enabled in `.claude/rules/code-quality-languages.txt` (per `CLAUDE.md § Stack conventions`)

## Dependencies

> Contract for `/deps-audit` (per `rules/deps-audit-golden-rule.md § 3` hard cap 4). Rule 9
> column = why we adopt instead of reinventing. Exact minor pins confirmed by `/deps-audit`
> against the npm registry + CVE scanners; ranges below are the plan's contract.

| Package | Range | Kind | Purpose | Rule 9 justification (don't reinvent) |
|---|---|---|---|---|
| `ink` | `^5.2.0` | dependency | React renderer for terminal | The foundation; roadmap-locked. Building a TUI reconciler is explicitly out of scope (`ROADMAP.md § out of scope`) |
| `react` | `^18.0.0 \|\| ^19.0.0` | peerDependency | component model | Roadmap-locked: react is the ONLY peer (blueprint ADR D1) |
| `react` (dev) | `^18.3.1` | devDependency | dev/test render target | mirrors ink-ui's dev posture (`references/ink-ui/package.json:50`) |
| `@types/react` | `^18.3.0` | devDependency | TS types for react 18 | standard DefinitelyTyped |
| `typescript` | `^5.6.0` | devDependency | strict TS compiler + typecheck gate | industry standard |
| `tsup` | `^8.3.0` | devDependency | ESM-only build + dts | M0 DoD names tsup (blueprint ADR D3); wraps esbuild + rollup-dts — hand-rolling a dts pipeline violates Rule 9 |
| `vitest` | `^3.0.0` | devDependency | test runner (roadmap-locked) | standard, fast, ESM-native |
| `@vitest/coverage-v8` | `^3.0.0` | devDependency | coverage gate | pairs with vitest |
| `ink-testing-library` | `^4.0.0` | devDependency | render/lastFrame/frames test API | the canonical Ink test lib (react-ink `package.json:65`); **compat with ink 5 confirmed at /deps-audit — if v4 requires ink 6, fall back to `^3.2.0`** |
| `eslint` | `^9.0.0` | devDependency | lint gate | industry standard (flat config) |
| `typescript-eslint` | `^8.0.0` | devDependency | TS lint rules | standard TS integration |
| `prettier` | `^3.3.0` | devDependency | format gate | industry standard |
| `tsx` | `^4.19.0` | devDependency | bench runner (spawns .bench.tsx) | mirrors react-ink harness (`benchmarks/run.ts:19`) |

Transitives are scanned by `/deps-audit` (osv-scanner + npm audit); no GPL/AGPL transitive allowed
(`ROADMAP.md § Constraints — Apache-2.0 compatible only`).

## ADRs

> D1–D6 originate in the blueprint (Blueprint §"ADRs" carries the full evidence trail); they are
> restated here in condensed, self-contained form so the plan stands alone. D7–D9 are plan-local.

### D1 — Ink 5 + React 18/19 dual peer, Node ≥ 20 (Ink 6 rejected for M0)

**Decision:** `ink@^5` as direct dependency; `react` peer `^18.0.0 || ^19.0.0`; engines
`node >= 20`; react is the ONLY peer.

**Rationale:** Ink 6 requires react ≥ 19.2 and node ≥ 22 — both violate the locked roadmap
constraints (Node ≥ 20, React 18/19); roadmap also locks "React is the ONLY required peer" to
keep TTFATT low. Verified by `/deps-audit`: `ink@5.2.1` peers `react >=18.0.0`.

**Alternatives considered:** Ink 6 + React 19 only (rejected: breaks roadmap constraints, narrows
consumers to node ≥ 22); ink as peerDependency like react-ink (rejected: one extra install step
for every consumer).

**Consequences:** Track ink 5.x until a between-milestones roadmap revision; re-evaluate Ink 6 at M6.

### D2 — Test discipline: vitest + ink-testing-library, FORCE_COLOR pinned, Box-width control, snapshot + semantic double assertion

**Decision:** vitest runner; `ink-testing-library` render; pin `FORCE_COLOR=1` (NO_COLOR/CI
neutralized) in vitest env; wrap width-sensitive renders in `<Box width={N}>`; one-tick
`renderFrame` helper; every behavior asserted BOTH via `toMatchSnapshot()` and ≥ 1 plain-text
`toContain`.

**Rationale:** The analogs prove two opposite-but-deterministic strategies (react-ink plain-text
vs ink-ui pinned-ANSI exact); flakiness lives only in the unpinned middle. M0 DoD explicitly
requires snapshot tests.

**Alternatives considered:** ava (rejected: roadmap locks vitest); plain-text-only assertions
(rejected: DoD requires snapshots); exact-ANSI-only equality (rejected: every M6 theme change
would rewrite every expected string — DRY violation).

**Consequences:** Snapshots stable across terminals; full NO_COLOR matrix deferred to M6 (M0
carries one NO_COLOR smoke test).

### D3 — Build with tsup per M0 DoD lock

**Decision:** tsup (ESM-only, dts on) builds the package.

**Rationale:** The M0 DoD names tsup explicitly and DoD is locked mid-flight
(`rules/cycle-roadmap.md`: objectives/DoD revised only between milestones); tsup is battle-tested
for exactly this shape.

**Alternatives considered:** plain tsc (ecosystem default per the discovery evidence — blocked by
DoD wording); tsdown (react-ink's engine — younger tool, no DoD backing).

**Consequences:** One extra devDependency; revisit between milestones if friction appears.

### D4 — ChatMessage v0: single component, explicit role prop (no runtime context)

**Decision:** One `ChatMessage` with `role: 'user' | 'assistant'` + `children`; glyph prefix +
token colors from the provider.

**Rationale:** react-ink's context-driven compound decomposition presupposes a runtime store that
only arrives at M7 (stream adapter); an explicit prop is discoverable and testable with zero
onboarding (KISS/YAGNI). gemini-cli ships per-role glyph prefixes in production.

**Alternatives considered:** compound components now (rejected: no second consumer case — Rule of
3); separate `UserMessage`/`AssistantMessage` (rejected: roadmap names ONE `ChatMessage`
primitive; single role-switched component mirrors `@theokit/ui`).

**Consequences:** M1 may split internals without breaking the public `role` prop; parts/tool-calls
arrive M2+ additively.

### D5 — Theme stub: flat semantic tokens now, component-style layer deferred to M6

**Decision:** `<TheoTUIProvider>` carries a flat semantic-token object (role colors + status)
consumed via `useTheoTheme()`; no per-component style functions at M0.

**Rationale:** gemini-cli's semantic-token taxonomy matches the M6 terminal-adaptive goal;
ink-ui's per-component `styles`/`config` + deepmerge is the right extension seam but over-structure
for one component (YAGNI — `/code-quality` would rightly flag the dead structure).

**Alternatives considered:** ink-ui full component-theme shape now (rejected: ~90% dead structure
at M0); no provider at all (rejected: M0 DoD requires the stub; the composition-root seam per
`rules/architecture.md` must exist from the first commit).

**Consequences:** M0 token names become API — set kept minimal so M6 reorganizes additively.

### D6 — Benchmark: tsx harness, mean/peak ms-per-frame, ≥ 3 measured runs, JSON + docs persistence

**Decision:** react-ink-style custom bench (tsx runner + ink-testing stdout frames +
`performance.now()`), workload = 100-message thread + 300-token streaming append; protocol =
1 discarded warmup + ≥ 3 measured runs, mean ± std dev; output = console table AND committed JSON
under `docs/benchmarks/`.

**Rationale:** The only metrics-driven prior art is react-ink's harness (ink's own benchmarks
emit no numbers). Statistical rigor per `rules/analysis-golden-rule.md` § 3; persisted artifact
per `rules/public-copy.md` § 4.

**Alternatives considered:** `vitest bench`/tinybench (rejected: measures ops/sec micro-loops,
not frame flushes on a live Ink render — wrong phenomenon); no benchmark at M0 (rejected: cycle
owner requires benchmark data as acceptance signal).

**Consequences:** M0 ships the baseline; later milestones extend the workload against the same
metric definitions.

### D7 — Lint/format: eslint 9 (flat) + typescript-eslint + prettier; gates wired as separate scripts

**Decision:** `eslint` flat config with `typescript-eslint` recommended rules for lint;
`prettier` for format (checked via `--check` in the gate); five separate npm scripts
(`format:check`, `lint`, `typecheck`, `test`, `build`) plus an aggregate `gates` script running
them in DoD order.

**Rationale:** The gate chain in `ROADMAP.md § M0 DoD` names five DISTINCT stages — separate
scripts keep each stage's exit code observable in CI (fail-fast, fail-clear —
`rules/error-handling.md § 1`). eslint+prettier is the industry standard pair (Rule 9: don't
adopt exotic tooling for a community library consumers will contribute to).

**Alternatives considered:** `xo` (ink/ink-ui's choice — rejected: opinionated wrapper hides the
lint stage's configurability and pins its own prettier fork assumptions); `oxlint` (react-ink
monorepo root — rejected: younger tool, no typescript-type-aware rules yet); folding lint into
`test` like ink-ui does (`"test": "tsc --noEmit && xo && ava"` — rejected: collapses gate exit
codes, CI can't report which stage failed).

**Consequences:** Five deterministic gates; contributors get standard tooling; slight config
overhead (two config files) accepted.

### D8 — Package manifest is protected by an executable contract test

**Decision:** `tests/package-manifest.test.ts` asserts the packaging invariants (`type: module`,
types-first `exports` with single `.` entry, `files: ["dist"]`, `sideEffects: false`,
`engines.node >= 20`, react as ONLY peer, license Apache-2.0).

**Rationale:** The manifest IS the M0 deliverable — regressions there (a stray CJS field, a
widened peer set) break consumers silently. An executable contract makes the scaffold TDD-able
(RED before the manifest exists) and guards M1+ edits. Mirrors the "tests protect behavior"
philosophy (`rules/testing.md § 1`) applied to packaging behavior.

**Alternatives considered:** publint as a devDependency gate (rejected for M0: scheduled by
roadmap for M8 GA — YAGNI now, and it doesn't check OUR invariants like react-only-peer); no test
(rejected: scaffold would be the only untested behavior in the milestone).

**Consequences:** package.json edits fail loudly; the test doubles as executable documentation of
the packaging contract.

### D9 — Benchmark verdict is data-only at M0 (no pass/fail threshold)

**Decision:** The M0 benchmark records baseline numbers (frames, mean/peak/std-dev ms per frame)
into a committed JSON; it does NOT enforce a threshold gate.

**Rationale:** A threshold needs a baseline to exist first — M0 IS the baseline
(`rules/analysis-golden-rule.md § 7`: first run creates the baseline). Inventing a pass number
before data exists would be fabricated rigor (Rule 3). Statistical protocol (≥ 3 runs, mean ±
std dev, hardware note) per `rules/analysis-golden-rule.md § 3`.

**Alternatives considered:** hard ms-per-frame gate in CI (rejected: no baseline yet + CI-runner
variance would flake the gate); no benchmark at M0 (rejected: cycle owner requires benchmark
data as acceptance signal).

**Consequences:** M1+ can regress against the committed JSON; CI runs the bench in smoke mode
(1 run) only to prove the harness executes, keeping wall-clock low.

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| `ink-testing-library@^4` may require ink ≥ 6, conflicting with ink ^5 (blueprint flagged: clone carries only ink 6 manifests) | High | `/deps-audit` confirms the peer range against the registry BEFORE implement; fallback pin `^3.2.0` declared in § Dependencies | deps-audit |
| Ink 5 + React 18 pairing under Node 22 dev machine vs engines `>=20` claim — untested combination until T0.2 | Medium | T0.2's smoke test + gate chain runs on Node 20 in CI matrix (single extra job) to prove the floor | implement |
| Snapshot tests can still flake if a future test forgets the width/env discipline | Medium | `renderFrame` helper + vitest env pin centralize the discipline; `src/*.test.tsx` must import the helper (review checklist item) | review |
| tsup adds a build abstraction the ecosystem itself doesn't use (ink/ink-ui use tsc) | Low | ADR D3 documents the DoD lock + the between-milestones revisit trigger | roadmap owner |
| Benchmark numbers from a dev laptop are not comparable across machines | Low | JSON records hardware + node version + methodology; comparisons only ever against same-machine baselines (`rules/analysis-golden-rule.md § 3`) | implement |

## Unresolved Questions

- Q-U1 — ~~Exact `ink-testing-library` major compatible with `ink@^5`~~ **RESOLVED by
  `/deps-audit` 2026-07-05:** v4.0.0 is developed against `ink ^5.0.0` (its devDeps) — keep
  `^4.0.0`; the `^3.2.0` fallback is unnecessary
  (audit: `knowledge-base/audits/m0-walking-skeleton-deps-audit-2026-07-05.md`).
- Q-U2 — ~~Exact `ink@5.x` peer-react range~~ **RESOLVED by `/deps-audit` 2026-07-05:**
  `ink@5.2.1` peers `react >=18.0.0` — the plan's `^18.0.0 || ^19.0.0` is inside the accepted
  range; keep as declared. ink 5 engines `node >=18`; our `>=20` floor is stricter — compatible.

(none — every decision is resolved at plan time: blueprint ADRs D1–D6, plan ADRs D7–D9, and the
deps-audit resolutions above.)

## Critical paths

For `/code-quality` D4 (mutation) when enabled: `src/chat-message.tsx` (role→glyph/color
branching) and `src/theme.tsx` (token merge/fallback logic) are the M0 critical paths.

## Dependency Graph

```
Phase 0 (toolchain scaffold) ──▶ Phase 1 (theme stub) ──▶ Phase 2 (ChatMessage) ──▶ Phase 3 (bench + example)
                                                                                          │
                                                                                          ▼
                                                                            Phase 4 (CI + language gate)
                                                                                          │
                                                                                          ▼
                                                                            Final Phase (integration validation)
```

All phases are sequential (each consumes the previous phase's outputs). No parallel tracks — the
walking skeleton is one vertical slice.

---

## Phase 0: Toolchain scaffold

**Objective:** An installable, buildable, testable, lintable empty package with licensing and
changelog in place.

### T0.1 — Package manifest, licensing, changelog (contract-test first)

#### Objective
Create `package.json` (publishable shape), `LICENSE`/`NOTICE` (Apache-2.0), `CHANGELOG.md`
(`[Unreleased]` seeded), protected by an executable manifest-contract test.

#### Why this step (action + reasoning)

1. **What:** Write the manifest contract test (RED), then `package.json` with the blueprint's
   locked shape (ESM-only, types-first exports, react-only peer, ink dependency, engines
   `>=20`), install devDependencies with pnpm, add Apache-2.0 LICENSE + NOTICE and CHANGELOG.md.
2. **Why now:** Everything else (build, test, lint) hangs off the manifest; it must exist first
   and be right first — ADR D8 makes it executable-contract-protected so later phases can't
   silently corrupt it. Licensing lands in the FIRST commit touching distributable code
   (Apache-2.0 is a roadmap compliance constraint); CHANGELOG discipline is Unbreakable Rule 6.

#### Evidence
- Exports/files shape: `knowledge-base/references/assistant-ui/packages/react-ink/package.json:16-31`.
- Peer/engines posture: Blueprint §"D1" (ink ^5 dep, react-only peer, node >=20);
  `knowledge-base/references/ink-ui/package.json:21,59`.
- Version ranges: § Dependencies table (this plan).

#### Files to edit
```
tests/package-manifest.test.ts — (NEW) RED contract test for packaging invariants
package.json                   — (NEW) manifest per ADR D1/D3/D7/D8
LICENSE                        — (NEW) Apache-2.0 full text
NOTICE                         — (NEW) "Copyright 2026 Theo ecosystem contributors" attribution
CHANGELOG.md                   — (NEW) Keep-a-Changelog skeleton + [Unreleased] § Added entries
```

#### Deep file dependency analysis
- `tests/package-manifest.test.ts`: reads `package.json` from disk (JSON import via `readFileSync`
  — no build needed); no other file depends on it.
- `package.json`: consumed by pnpm/tsup/vitest/eslint/CI; its `scripts` are the gate-chain
  contract for T4.1; its `exports` is the integration-test import target in T2.2.
- `LICENSE`/`NOTICE`/`CHANGELOG.md`: standalone; `CHANGELOG.md` is later verified by
  `/implement`'s acceptance gate + `/review` hard gate.

#### Deep Dives
- Manifest invariants (asserted by the test): `"type": "module"`; `exports` =
  `{".": {"types": "./dist/index.d.ts", "default": "./dist/index.js"}}` exactly (single entry,
  `types` key listed before `default` — required by Node/TS resolution order);
  `"files": ["dist"]`; `"sideEffects": false`; `engines.node: ">=20"`;
  `peerDependencies` has EXACTLY the keys `react` (+ `@types/react` optional-peer is NOT added at
  M0 — YAGNI); `license: "Apache-2.0"`; `name: "@theokit/tui"`; `private` ABSENT.
- Scripts (contract for T4.1): `build` (tsup), `test` (vitest run), `test:watch`,
  `typecheck` (tsc --noEmit), `lint` (eslint .), `format` (prettier --write .),
  `format:check` (prettier --check .), `bench` (tsx benchmarks/run.ts),
  `gates` (format:check && lint && typecheck && test && build — DoD order).
- Edge cases: pnpm 10 requires `packageManager` field for corepack-strict CI — set
  `"packageManager": "pnpm@10.34.1"` (dev machine version, evidence: local `pnpm --version`).

#### Tasks
1. Write `tests/package-manifest.test.ts` with all invariant assertions — run: FAILS (no package.json)
2. Write `package.json` (fields + § Dependencies ranges + scripts)
3. `pnpm install` — lockfile generated and committed
4. Add `LICENSE` (Apache-2.0 text), `NOTICE`, `CHANGELOG.md` (`[Unreleased] § Added` entries for scaffold + ChatMessage + provider + benchmark)
5. Re-run test — GREEN (vitest picks `tests/**` by default config set in T0.2; until then run via `pnpm vitest run tests/package-manifest.test.ts`)

#### TDD
```
RED:     package_manifest_declares_esm_only_types_first_exports() — expect(pkg.type).toBe("module"); expect(Object.keys(pkg.exports["."])) first key "types" then "default"; expect(pkg.files).toEqual(["dist"]) (MUST fail: package.json absent)
RED:     package_manifest_declares_react_as_only_peer_and_ink_as_dependency() — expect(Object.keys(pkg.peerDependencies)).toEqual(["react"]); expect(pkg.dependencies.ink).toMatch(/\^5/)
RED:     package_manifest_declares_apache2_license_and_node20_floor() — expect(pkg.license).toBe("Apache-2.0"); expect(pkg.engines.node).toBe(">=20"); expect(pkg.sideEffects).toBe(false)
GREEN:   Write package.json satisfying every assertion
REFACTOR: None expected
VERIFY:  pnpm vitest run tests/package-manifest.test.ts
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run tests/package-manifest.test.ts` green
- [ ] `pnpm install` exits 0; `pnpm-lock.yaml` committed
- [ ] `LICENSE` contains the full Apache-2.0 text; `NOTICE` names the project
- [ ] `CHANGELOG.md` has `[Unreleased]` with ≥ 1 entry referencing this plan slug
- [ ] Pass: size — every new file ≤ 500 lines (`rules/architecture.md` budget; LICENSE exempt as vendored legal text)

#### DoD (Definition of Done)
- [ ] All tasks completed; manifest contract test green
- [ ] No type/lint gates yet (arrive T0.2) — explicitly out of this task's scope

### T0.2 — Build + test + lint toolchain (tsconfig, tsup, vitest, eslint, prettier)

#### Objective
`pnpm build` produces `dist/index.js` + `dist/index.d.ts` from a minimal `src/index.ts`;
`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all run and exit 0.

#### Why this step (action + reasoning)

1. **What:** Write a RED export-surface test (imports `src/index.ts`, asserts the module exposes
   `VERSION`); add `tsconfig.json` (strict), `tsup.config.ts` (ESM + dts), `vitest.config.ts`
   (node env + `FORCE_COLOR=1` pin + include `src/**` and `tests/**`), `eslint.config.js`,
   `.prettierrc.json`, `.prettierignore`; create `src/index.ts` exporting `VERSION`.
2. **Why now:** The five gates must exist BEFORE any component code so Phase 1/2 land under full
   discipline (TDD needs a runner; the parsimony ladder's guardrails need lint/typecheck live).
   `FORCE_COLOR` pin implements blueprint ADR D2's determinism contract at the config root —
   individual tests can't forget it.

#### Evidence
- vitest minimal node config: `knowledge-base/references/assistant-ui/packages/react-ink/vitest.config.ts:1-9`.
- Color pin necessity: `knowledge-base/references/ink-ui/package.json:71` (ink-ui pins
  FORCE_COLOR for its runner); Blueprint §"D2".
- tsconfig strictness direction: `knowledge-base/references/assistant-ui/packages/x-buildutils/ts/base.json:3`
  (strictest-based), `jsx: react-jsx`, `module: ESNext`, `moduleResolution: bundler`.

#### Files to edit
```
tests/export-surface.test.ts — (NEW) RED: import { VERSION } from '../src/index.js' asserts defined
tsconfig.json                — (NEW) strict TS, react-jsx, ESNext/bundler, noEmit (tsup emits)
tsup.config.ts               — (NEW) entry src/index.ts, format esm, dts true, clean, target node20
vitest.config.ts             — (NEW) node env, globals, env pins FORCE_COLOR="1" + NO_COLOR="" + CI="" (EC-5: identical color-detection inputs local vs CI), coverage v8
eslint.config.js             — (NEW) typescript-eslint recommended flat config
.prettierrc.json             — (NEW) default prettier options (explicit file so editors agree)
.prettierignore              — (NEW) dist/, pnpm-lock.yaml, docs/benchmarks/*.json, .claude/
src/index.ts                 — (NEW) export const VERSION = "0.0.0" (placeholder until T1/T2 add exports)
```

#### Deep file dependency analysis
- `tsconfig.json`: consumed by tsc (typecheck gate), eslint type-aware rules, vitest, tsup dts.
- `vitest.config.ts`: env pin affects ALL tests — the determinism root (ADR D2).
- `src/index.ts`: the composition root; T1.1/T2.1 append exports; `tests/export-surface.test.ts`
  grows with them.
- `eslint.config.js` + `.prettierrc.json`: consumed by gates; `.prettierignore` protects the
  committed benchmark JSON from format churn.

#### Deep Dives
- tsconfig compilerOptions: `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true` (strictest-inspired), `jsx: "react-jsx"`,
  `module: "ESNext"`, `moduleResolution: "bundler"`, `target: "ES2022"`,
  `lib: ["ES2022"]`, `types: ["node"]` only where needed, `skipLibCheck: true`,
  `isolatedModules: true`, `noEmit: true` (tsup emits; typecheck stays pure).
- Import hygiene: source imports use `.js` extension style compatible with `bundler` resolution;
  tests import from `../src/index.js`.
- Edge cases: vitest `environment: "node"`; `passWithNoTests: false` (a silent empty suite is a
  broken gate — fail-fast); coverage provider v8 with `include: ["src/**"]`.

#### Tasks
1. Write `tests/export-surface.test.ts` — FAILS (src/index.ts absent)
2. Add `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
3. Create `src/index.ts` with `VERSION` export — test GREEN
4. Run all five scripts; fix config drift until each exits 0
5. Update `CHANGELOG.md [Unreleased]` (toolchain entry, this slug)

#### TDD
```
RED:     public_entry_exposes_version_constant() — import { VERSION } from '../src/index.js'; expect(VERSION).toBe("0.0.0") (MUST fail: module absent)
GREEN:   Create src/index.ts + configs until vitest resolves and passes
REFACTOR: None expected
VERIFY:  pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm build` exits 0 AND `dist/index.js` + `dist/index.d.ts` exist (observable: `test -f`)
- [ ] `pnpm test` green (2 test files); `pnpm typecheck` 0 errors; `pnpm lint` 0 warnings; `pnpm format:check` clean
- [ ] Pass: complexity — every file cyclomatic complexity <= 10, verified by `pnpm lint` exit 0 (complexity rule enabled)
- [ ] Pass: size — `wc -l` on every changed source file reports <= 500 lines

#### DoD (Definition of Done)
- [ ] All five gate scripts individually exit 0
- [ ] `pnpm gates` aggregate exits 0
- [ ] CHANGELOG updated

---

## Phase 1: Theme stub

**Objective:** Flat semantic tokens + `<TheoTUIProvider>` + `useTheoTheme()` with default-theme
fallback, exported from the public entry.

### T1.1 — Semantic tokens, TheoTUIProvider, useTheoTheme

#### Objective
Implement `src/theme.tsx`: `TheoTheme` type (flat semantic tokens), `defaultTheme`,
`ThemeContext`, `<TheoTUIProvider theme?>`, `useTheoTheme()`; export all from `src/index.ts`.

#### Why this step (action + reasoning)

1. **What:** RED tests for hook fallback (no provider → defaultTheme), provider passthrough
   (custom theme reaches consumers), and partial-override merge; then implement the minimal
   context module and wire exports.
2. **Why it is necessary now:** ChatMessage (Phase 2) consumes tokens via the hook (DIP —
   Baseline § Architecture boundaries); building the component first would hard-code colors and
   force a rework. Blueprint ADR D5 locks the flat-token shape; gemini-cli's taxonomy
   (`semantic-tokens.ts:9-43`) is the naming source.

#### Evidence
- Context+hook consumption pattern: `knowledge-base/references/ink-ui/source/theme.tsx:63-68`
  (`useComponentTheme` reads `useContext(ThemeContext)`).
- Token taxonomy: `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/semantic-tokens.ts:9-43`
  (text/status categories).
- Deliberate M0 simplification (flat, no per-component styles): Blueprint §"D5".

#### Files to edit
```
src/theme.test.tsx — (NEW) RED tests (fallback, passthrough, partial override)
src/theme.tsx      — (NEW) TheoTheme type + defaultTheme + provider + hook
src/index.ts       — add exports { TheoTUIProvider, useTheoTheme, defaultTheme, type TheoTheme }
tests/export-surface.test.ts — extend: new exports asserted
```

#### Deep file dependency analysis
- `src/theme.tsx`: no internal deps (domain layer); depends on `react` only (createContext,
  useContext) — deliberately NOT on ink (tokens are renderer-agnostic).
- `src/index.ts`: gains 4 exports; `tests/export-surface.test.ts` and (later)
  `tests/public-api.integration.test.tsx` are the callers.
- `src/theme.test.tsx`: co-located per `rules/testing.md § 5` (`<name>.test.<ext>` JS/TS convention).

#### Deep Dives
- Data structure (exact fields, per blueprint ADR D5 — role colors + status, nothing more):

```pseudocode
type TheoTheme = {
  role: {
    user:      { prefix: string; glyph: string; text: string };
    assistant: { prefix: string; glyph: string; text: string };
  };
  status: { error: string; success: string; warning: string };
};
defaultTheme: user glyph "> " cyan, assistant glyph "✦ " magenta, text undefined-color-safe
TheoTUIProvider({ theme?: PartialDeep<TheoTheme>, children }) -> merges over defaultTheme (shallow per top-level group — no deepmerge dep at M0)
useTheoTheme(): TheoTheme -> useContext(ThemeContext) ?? defaultTheme
```

- Invariants: `useTheoTheme()` NEVER returns undefined (fallback to defaultTheme — fail-safe
  default, `rules/error-handling.md § 2` explicit over magic null); merge is shallow at the
  top-level groups (`role`, `status`) — documented limitation, deepmerge arrives with M6 (YAGNI).
- Edge cases: provider with `theme={undefined}` === no override; partial override of one role
  keeps the other role's defaults (test asserts).

#### Tasks
1. Write the 4 RED tests in `src/theme.test.tsx`
2. Implement `src/theme.tsx` minimal (parsimony rung 6)
3. Export from `src/index.ts`; extend export-surface test
4. CHANGELOG entry

#### TDD
```
RED:     use_theo_theme_returns_default_tokens_without_provider() — probe Ink component renders the hook value; expect(frame).toContain(defaultTheme.role.user.glyph)
RED:     provider_passes_custom_theme_to_consumers() — custom assistant glyph; expect(frame).toContain("◆ ")
RED:     partial_override_preserves_untouched_token_groups() — override role.user only; expect(theme.status.error).toBe(defaultTheme.status.error); expect(theme.role.assistant).toEqual(defaultTheme.role.assistant)
RED:     empty_theme_override_yields_default_tokens() — <TheoTUIProvider theme={{}}>; expect(theme).toEqual(defaultTheme) (EC-4: empty-but-valid extreme of the merge)
GREEN:   Implement theme.tsx until all four pass
REFACTOR: Extract mergeTheme helper only if the inline merge exceeds ~10 lines (KISS)
VERIFY:  pnpm vitest run src/theme.test.tsx
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/theme.test.tsx tests/export-surface.test.ts` exits 0 with 4 theme tests + extended export assertions passing
- [ ] `useTheoTheme` returns a total `TheoTheme` in all cases (no undefined leaks — typecheck proves)
- [ ] Pass: quality — `pnpm lint` exits 0 with 0 warnings; `wc -l src/theme.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0
- [ ] CHANGELOG updated

---

## Phase 2: ChatMessage primitive

**Objective:** `ChatMessage` renders user/assistant messages with role glyph + token colors,
snapshot-covered including NO_COLOR, integrated through the public entry.

### T2.1 — ChatMessage component (snapshot + semantic tests first)

#### Objective
Implement `src/chat-message.tsx`: `ChatMessage({ role, children })` rendering
`<Box>` + glyph prefix `<Text>` + content `<Text>`, colored via `useTheoTheme()`.

#### Why this step (action + reasoning)

1. **What:** RED tests — snapshot of `lastFrame()` per role, semantic `toContain` assertions,
   NO_COLOR smoke test, and a shared `renderFrame` helper (one React tick); then the minimal
   component.
2. **Why now:** This is the milestone's user-visible primitive; it lands AFTER the theme (its
   only dependency, per DIP) and BEFORE the benchmark (which renders it). API shape locked by
   blueprint ADR D4 (explicit `role` prop, no runtime context).

#### Evidence
- Glyph idiom in production: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/UserMessage.tsx:26`
  (2-char `"> "` prefix), `GeminiMessage.tsx:28` (`"✦ "`).
- One-tick helper: `knowledge-base/references/assistant-ui/packages/react-ink/src/tests/helpers.tsx:13-17`.
- Width control: `knowledge-base/references/ink-ui/test/progress-bar.tsx:10-12`.
- Double-assertion strategy (snapshot + toContain): Blueprint §"D2".

#### Files to edit
```
src/chat-message.test.tsx — (NEW) RED: snapshots + semantic + NO_COLOR
tests/helpers.tsx          — (NEW) renderFrame(node): render + one tick + lastFrame
src/chat-message.tsx       — (NEW) the component
src/index.ts               — add export { ChatMessage, type ChatMessageProps }
tests/export-surface.test.ts — extend
```

#### Deep file dependency analysis
- `src/chat-message.tsx`: imports `ink` (Box, Text) + `./theme.js` (hook). First production
  consumer of the theme — proves the DIP seam.
- `tests/helpers.tsx`: imported by `src/chat-message.test.tsx` and
  `tests/public-api.integration.test.tsx` (T2.2) — single determinism point.
- `src/index.ts`: gains `ChatMessage`; benchmark + example are downstream callers (Phase 3).

#### Deep Dives
- Signature:

```pseudocode
type ChatMessageProps = { role: "user" | "assistant"; children: ReactNode };
function ChatMessage({ role, children }): 
  tokens = useTheoTheme().role[role]
  return <Box> <Text color={tokens.prefix}>{tokens.glyph}</Text> <Text color={tokens.text}>{children}</Text> </Box>

# Example
input:  <ChatMessage role="user">hello</ChatMessage>  (defaultTheme, FORCE_COLOR=1)
output: "> hello" with "> " cyan-colored (ANSI in snapshot), text default color
```

- Invariants: role is a closed union — TS exhaustiveness (`noUncheckedIndexedAccess` keeps
  `theme.role[role]` total); component renders in ONE line for short content (wrapping is Ink's
  concern, not asserted at M0 beyond the fixed-width snapshot).
- Edge cases: empty children (renders glyph only — snapshot); NO_COLOR run must contain the same
  visible text (glyph + content) with zero ANSI escapes (assert `[` absent).

#### Tasks
1. Write `tests/helpers.tsx` (renderFrame)
2. Write RED tests in `src/chat-message.test.tsx` (7 tests below)
3. Implement `src/chat-message.tsx` minimal
4. Export from index; extend export-surface test
5. CHANGELOG entry

#### TDD
```
RED:     renders_user_message_with_glyph_prefix() — expect(frame).toContain("> "); expect(frame).toContain("hello")
RED:     renders_assistant_message_with_glyph_prefix() — expect(frame).toContain("✦ "); expect(frame).toContain(content)
RED:     user_and_assistant_frames_match_snapshot_under_forced_color() — expect(frame).toMatchSnapshot() per role inside <Box width={40}>
RED:     respects_custom_theme_glyph_via_provider() — provider override; expect(frame).toContain("◆ ")
RED:     no_color_render_contains_text_without_ansi_escapes() — spawn-free: re-render with vitest.stubEnv NO_COLOR=1 + FORCE_COLOR unset; assert no "[" and content present
RED:     invalid_role_throws_typed_error_with_clear_message() — (EC-1, MUST FIX) render with role="system" as any; expect(renderIt).toThrow(TypeError); error message should contain "ChatMessage" naming the invalid value and the accepted union
RED:     long_content_wraps_inside_narrow_box_without_crash() — (EC-3) 120-char string in <Box width={20}>; expect(frame.length > 0).toBe(true); expect(frame).toContain(firstWord)
GREEN:   Implement chat-message.tsx (including the 3-line role guard at component entry — rules/error-handling.md § 2 boundary validation) until all pass
REFACTOR: None expected beyond glyph/color constant extraction into theme defaults (already there)
VERIFY:  pnpm vitest run src/chat-message.test.tsx
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] 7 tests green; snapshots committed and stable across two consecutive runs (`pnpm test` twice)
- [ ] NO_COLOR smoke — `pnpm vitest run src/chat-message.test.tsx -t no_color` exits 0 proving the frame contains the text with 0 ANSI escapes
- [ ] Pass: quality — `pnpm lint` exits 0 with 0 warnings; `wc -l src/chat-message.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0
- [ ] CHANGELOG updated

### T2.2 — Public-API integration test

#### Objective
Prove the composed public surface: import ONLY from `src/index.js` (the package entry),
render `<TheoTUIProvider><ChatMessage/></TheoTUIProvider>`, assert the frame.

#### Why this step (action + reasoning)

1. **What:** One integration test exercising provider + component + tokens through the
   composition root, exactly as a consumer would.
2. **Why now:** Unit tests (T1.1/T2.1) import modules directly; the integration boundary —
   "the package entry re-exports a coherent working set" — is untested until here. This is the
   wiring-triad pillar (b) for the milestone (integration test covering what unit mocks skipped —
   `rules/cycle-implement.md § Wiring triad`).

#### Evidence
- Wiring-triad contract: `rules/cycle-implement.md § Wiring triad` (pillar b).
- Consumer-shaped import: manifest `exports` map defined in T0.1 (Blueprint
  §"Coverage Corner 3 — Tools").

#### Files to edit
```
tests/public-api.integration.test.tsx — (NEW) provider+component via src/index.js
```

#### Deep file dependency analysis
- Imports `{ TheoTUIProvider, ChatMessage, defaultTheme }` from `../src/index.js` + helper from
  `./helpers.tsx`. Depends on T1.1 + T2.1 exports; no production file changes.

#### Deep Dives
- Asserts BOTH roles inside one provider with a custom theme override AND the defaultTheme path;
  mirrors the smallest real consumer program (same shape as `examples/basic.tsx` in T3.2).
- Edge case covered: nesting two ChatMessages under one provider (sibling render — Ink `Box`
  stacking) — asserts both lines present in frame.

#### Tasks
1. Write the integration test (GREEN immediately is FORBIDDEN — first run it against a
   deliberately-broken import path to see it fail, then fix to the real path; records RED shape)
2. CHANGELOG entry (test-only — grouped under the T2 entry)

#### TDD
```
RED:     public_entry_composes_provider_and_message_for_both_roles() — import from '../src/index.js'; render provider(custom user glyph)+2 messages; expect(frame).toContain(customGlyph); expect(frame).toContain("✦ "); expect(frame).toContain both contents (RED via intentionally-wrong import first, then GREEN with real path)
GREEN:   Fix import to ../src/index.js — passes with no production change
REFACTOR: None expected
VERIFY:  pnpm vitest run tests/public-api.integration.test.tsx
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run tests/public-api.integration.test.tsx` exits 0 — imports resolve ONLY via `src/index.js`
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l tests/public-api.integration.test.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 3: Benchmark + example (wiring triad closure)

**Objective:** Render-benchmark harness with statistical protocol + committed baseline JSON +
runnable example — the milestone's runtime-observability pillar.

### T3.1 — Benchmark harness + committed baseline

#### Objective
`benchmarks/chat-message.bench.tsx` (workload) + `benchmarks/run.ts` (runner): renders a
100-message thread + 300-token streaming append into the last message via ink-testing-library;
captures frames + mean/peak/std-dev ms-per-frame over 1 warmup + ≥ 3 measured runs; writes
`docs/benchmarks/m0-chat-message-baseline.json` and prints a console table.

#### Why this step (action + reasoning)

1. **What:** Port react-ink's harness pattern to the M0 scale, upgraded with the statistical
   protocol (≥ 3 runs, mean ± std dev) and JSON persistence.
2. **Why now:** The cycle owner requires benchmark DATA as acceptance evidence; ADR D6/D9 lock
   the harness design + data-only posture. It lands after ChatMessage exists (it renders it) and
   before CI (which smoke-runs it).

#### Evidence
- Harness prior art: `knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/run.ts:19`
  (tsx spawn), `benchmarks/long-thread.bench.tsx:205-230` (frame-time sampling via
  `performance.now()` + `stdout.frames` deltas), `:272-341` (console reporting).
- Statistical protocol: `rules/analysis-golden-rule.md § 3` (≥ 3 runs, mean ± std dev, units +
  methodology + hardware).
- Artifact requirement: `rules/public-copy.md § 4` (reproducible benchmark artifact under
  `docs/benchmarks/`).

#### Files to edit
```
benchmarks/chat-message.bench.tsx — (NEW) workload + sampling + stats
benchmarks/run.ts                 — (NEW) discovers *.bench.tsx, spawns via tsx, forwards exit code
docs/benchmarks/m0-chat-message-baseline.json — (NEW) committed baseline (generated, then committed)
package.json                      — bench + bench:smoke scripts (declared in T0.1, verified here)
```

#### Deep file dependency analysis
- `benchmarks/chat-message.bench.tsx`: imports `{ ChatMessage, TheoTUIProvider }` from
  `../src/index.js` (production caller — wiring pillar a) + `ink-testing-library` render.
- `benchmarks/run.ts`: fs/child_process only; forwards non-zero exit (fail-loud —
  `rules/error-handling.md § 2`).
- `docs/benchmarks/m0-chat-message-baseline.json`: consumed by future `/analysis` +
  M1 regression comparisons; `.prettierignore`d (T0.2) so format never rewrites data.

#### Deep Dives
- Workload: build 100 `ChatMessage` elements (alternating roles) under one provider; then 300
  sequential `rerender()` calls appending a token to the last message's text (streaming
  simulation, no timers — synchronous re-render loop keeps the bench deterministic-ish and fast).
- Metrics per run: `frames` (stdout.frames.length delta), `mean_ms_per_frame`,
  `peak_ms_per_frame`; sampled via `performance.now()` around rerender batches — honest
  heuristic, same as prior art, noted in JSON `methodology` field.
- Protocol: 1 warmup (discarded) + N=5 measured runs (exceeds the ≥ 3 floor); aggregate
  `mean ± std_dev` per metric.
- JSON schema (exact fields): `{ benchmark, date, node_version, hardware: {cpu, cores},
  workload: {messages, streamed_tokens}, protocol: {warmup_runs, measured_runs},
  runs: [{frames, mean_ms_per_frame, peak_ms_per_frame}], aggregate: {frames_mean,
  mean_ms_per_frame: {mean, std_dev}, peak_ms_per_frame: {mean, std_dev}}, methodology }`.
- `--smoke` flag: 1 measured run, NO file write — CI proof-of-execution (ADR D9).
- Edge case: if `stdout.frames` yields 0 new frames for a batch (Ink coalescing), the sampler
  skips the empty delta (prior-art behavior, `long-thread.bench.tsx:210` `if (newFrames <= 0) return`).

#### Pseudo-code / Signatures
```pseudocode
async function runOnce(): RunMetrics
  instance = render(<App messages=100 />)         -- inside ink-testing-library
  t0 = performance.now(); framesSeen = instance.stdout.frames.length
  for token in 1..300:
    rerender(<App messages=100 streamedTokens=token />)
    sample(instance, now())                        -- frame-delta sampling
  return { frames, mean_ms_per_frame, peak_ms_per_frame }

main: warmup(); runs = repeat(5, runOnce); writeJSON(aggregate(runs)) unless --smoke

# Example aggregate output (real numbers land at implement)
{ "mean_ms_per_frame": { "mean": 3.1, "std_dev": 0.4 }, ... }
```

#### Tasks
1. RED test: `benchmarks/run.test.ts`-shaped assertion is NOT used — instead the RED gate is the
   bench smoke itself failing before the files exist: add `tests/bench-baseline.test.ts` that
   asserts `docs/benchmarks/m0-chat-message-baseline.json` exists, parses, and satisfies the
   schema (runs count ≥ 3, std_dev present, node_version non-empty) — FAILS now
2. Implement workload + runner
3. `pnpm bench` — generates the baseline JSON with REAL numbers on the dev machine
4. Commit the JSON; `tests/bench-baseline.test.ts` GREEN
5. CHANGELOG entry

#### TDD
```
RED:     benchmark_baseline_json_exists_with_statistical_protocol() — parse docs/benchmarks/m0-chat-message-baseline.json; expect(baseline.protocol.measured_runs).toBeGreaterThanOrEqual(3) — i.e. assert baseline.protocol.measured_runs >= 3; expect(Number.isFinite(baseline.aggregate.mean_ms_per_frame.std_dev)).toBe(true) (EC-2: NaN is typeof number — isFinite is the real oracle); expect(baseline.methodology.length > 0).toBe(true) (MUST fail: file absent)
GREEN:   Implement harness WITH the zero-frame guard (EC-2, MUST FIX): if a run captures 0 frames, print a clear error and process.exit(1) — never serialize NaN/Infinity aggregates; run pnpm bench; commit baseline
REFACTOR: None expected
VERIFY:  pnpm vitest run tests/bench-baseline.test.ts && pnpm bench --smoke
```

#### Concurrency tests
(none — single-threaded) — the streaming loop is a sequential rerender; no shared-state writers.

#### Acceptance Criteria
- [ ] `pnpm bench` exits 0 and (re)writes the baseline JSON with runs ≥ 3 + mean ± std dev + hardware/node metadata
- [ ] `pnpm bench --smoke` exits 0 in < 60s (CI-viable)
- [ ] Baseline committed — `git ls-files docs/benchmarks/m0-chat-message-baseline.json` outputs the path AND `pnpm vitest run tests/bench-baseline.test.ts` exits 0
- [ ] Pass: quality — `pnpm lint benchmarks` exits 0; `wc -l benchmarks/chat-message.bench.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0; baseline data present with REAL measured numbers
- [ ] CHANGELOG updated

### T3.2 — Runnable example (demo caller)

#### Objective
`examples/basic.tsx`: a 10-line program rendering a provider + user/assistant exchange —
runnable via `pnpm example`.

#### Why this step (action + reasoning)

1. **What:** Smallest real consumer program + `example` script (tsx).
2. **Why now:** Completes wiring pillar (a) with a HUMAN-runnable caller (the benchmark is
   machine-shaped); it doubles as the TTFATT seed — the snippet a future README will show.

#### Evidence
- Wiring-triad pillar (a): `rules/cycle-implement.md § Wiring triad`.
- TTFATT north-star: `ROADMAP.md § Success criteria`.

#### Files to edit
```
examples/basic.tsx — (NEW) provider + 2 messages, ink render()
package.json       — "example": "tsx examples/basic.tsx" (declared T0.1, verified here)
```

#### Deep file dependency analysis
- Imports from `../src/index.js`; uses ink's `render()` directly (the only file that calls the
  real TTY renderer). Excluded from coverage (not a test target).

#### Deep Dives
- Must exit cleanly when piped (non-TTY): ink handles it; manual verification step
  `pnpm example | cat` asserts no crash (roadmap non-TTY constraint smoke).

#### Tasks
1. Write example; run `pnpm example` and `pnpm example | cat` (both exit 0)
2. CHANGELOG entry

#### TDD
```
RED:     Given the example program at examples/basic.tsx When it is run piped (`pnpm example | cat`) Then the output contains both role glyphs and the process exits 0 (behavior covered by T2.2's integration test — the example mirrors it 1:1; no separate unit test for a demo script, per rules/testing.md § 4 "don't test framework-generated code")
VERIFY:  pnpm example | cat  — exits 0, output contains both glyphs
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm example` renders both messages; piped run exits 0 (non-TTY smoke)
- [ ] Pass: quality — `pnpm lint examples` exits 0; `wc -l examples/basic.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 4: CI + project quality-gate enablement

**Objective:** The gate chain runs on GitHub Actions for `develop` pushes/PRs; the kit's
TypeScript detectors are enabled.

### T4.1 — GitHub Actions workflow + code-quality language enablement

#### Objective
`.github/workflows/ci.yml` running the five gates + bench smoke on Node 20 and 22;
`typescript` uncommented in `.claude/rules/code-quality-languages.txt`.

#### Why this step (action + reasoning)

1. **What:** One workflow (pnpm + node matrix [20, 22]) executing
   `format:check → lint → typecheck → test → build → bench --smoke` as separate steps; enable
   the TS language gate for `/code-quality`.
2. **Why now:** M0 DoD requires the gates green IN CI (not just locally); the Node-20 job proves
   the engines floor (Drawbacks row 2). Language enablement is mandated by
   `CLAUDE.md § Stack conventions` "once source lands".

#### Evidence
- DoD wording: `ROADMAP.md § M0` ("all exit 0 in CI").
- Engines floor risk: § Drawbacks & Risks row 2.
- Enablement instruction: `CLAUDE.md § Stack conventions`.

#### Files to edit
```
.github/workflows/ci.yml                  — (NEW) gates workflow, node matrix [20.x, 22.x], pnpm cache
.claude/rules/code-quality-languages.txt  — uncomment `typescript`
```

#### Deep file dependency analysis
- `ci.yml`: consumes package.json scripts (T0.1 contract); pnpm version pinned from
  `packageManager` field (corepack).
- `code-quality-languages.txt`: read by `/code-quality` detectors + `post-edit-check.sh` hook —
  enabling it turns on knip/tree-sitter checks for the REVIEW cycle of this very plan.

#### Deep Dives
- Steps (each its own step for observable exit codes — ADR D7): checkout → setup pnpm/node
  (cache) → `pnpm install --frozen-lockfile` → the five gates → `pnpm bench --smoke`.
- Trigger: `push` to `develop` + `pull_request` targeting `main` and `develop`.
- Edge case: snapshots in CI — `vitest run` (no update flag) so drift FAILS the job (fail-fast).

#### Tasks
1. Write workflow; enable typescript in languages.txt
2. Push to develop; observe run green (evidence: `gh run list --branch develop --limit 1`)
3. CHANGELOG entry

#### TDD
```
RED:     Given the workflow file on develop When GitHub Actions runs the push Then all six steps (format:check, lint, typecheck, test, build, bench --smoke) exit 0 on node 20 AND node 22 (infrastructure task — the executable assertion is the CI run itself)
VERIFY:  gh run watch <run-id> exits with success; all six steps green on both node versions
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] CI green — `gh run list --branch develop --limit 1` reports status `completed`/`success` covering node 20 AND 22 jobs for the HEAD commit
- [ ] `typescript` active in code-quality-languages.txt (verified: `grep -x typescript`)

#### DoD (Definition of Done)
- [ ] `gh run list --branch develop --limit 1` shows success for the final commit
- [ ] CHANGELOG updated

---

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | Repo scaffolded: Ink 5 + tsup ESM-only + vitest + ink-testing-library + TS strict + Apache-2.0 LICENSE/NOTICE; `pnpm build` produces `dist/index.js` (ROADMAP M0 DoD-1) | T0.1, T0.2 | Manifest contract test + toolchain configs + build gate |
| 2 | `ChatMessage` (user/assistant) renders in Ink; `<TheoTUIProvider>` stub wraps it (ROADMAP M0 DoD-2) | T1.1, T2.1, T2.2 | Theme stub + component + public-entry integration test |
| 3 | ink-testing-library snapshot test asserts rendered output; `pnpm test` green (ROADMAP M0 DoD-3) | T2.1 | Snapshot per role under forced color + width control |
| 4 | `format → lint → typecheck → test → build` all exit 0 in CI (ROADMAP M0 DoD-4) | T0.2, T4.1 | Five scripts + Actions workflow, node 20/22 matrix |
| 5 | Benchmark data: mean ± std dev over ≥ 3 runs, JSON committed (cycle-owner requirement; ADR D6/D9) | T3.1 | Harness + committed baseline + schema test |
| 6 | Wiring triad: caller + integration test + runtime observability (`rules/cycle-implement.md`) | T2.2, T3.1, T3.2 | Example + bench as callers; integration test; bench metrics as runtime evidence |
| 7 | CHANGELOG discipline from first code commit (Unbreakable Rule 6) | T0.1 (+ every task) | CHANGELOG.md created with [Unreleased]; every task appends |
| 8 | NO_COLOR / non-TTY robustness smoke (ROADMAP constraints) | T2.1, T3.2 | NO_COLOR test + piped example run |
| 9 | TS quality-gate enablement for /code-quality (CLAUDE.md § Stack conventions) | T4.1 | Uncomment typescript |

**Coverage: 9/9 gaps covered (100%)**

## Global Definition of Done

- [ ] All phases completed
- [ ] All tests passing — `pnpm test` green (manifest, export-surface, theme ×4, chat-message ×7, integration, bench-baseline)
- [ ] Zero type errors — `pnpm typecheck`
- [ ] Zero lint warnings — `pnpm lint`
- [ ] Format clean — `pnpm format:check`
- [ ] Build green — `pnpm build` produces `dist/index.js` + `dist/index.d.ts`
- [ ] File-size budget respected — every source file ≤ 500 LoC (`rules/architecture.md`; LICENSE exempt)
- [ ] Coverage ≥ 90% on `src/**` — `pnpm test -- --coverage` (critical paths § above: 100%)
- [ ] CHANGELOG.md `[Unreleased]` updated with every user-visible change of this plan (Unbreakable Rule 6)
- [ ] Backward compatibility — n/a (first release; no existing consumers)
- [ ] **Benchmark proof** — `docs/benchmarks/m0-chat-message-baseline.json` committed with REAL numbers: ≥ 3 measured runs, mean ± std dev, node/hardware metadata (runtime-metric pillar for this milestone)
- [ ] CI green on develop (node 20 + 22)
- [ ] **Plan archived** — after `/review` returns `READY_TO_MERGE` AND the release PR merges, move this plan to `knowledge-base/plans/completed/` (never before)

## Failure scenarios (when I/O external)

```
(none — no external I/O touched)
```

(The package performs zero network/DB/queue I/O; CI fetches deps but that is infrastructure, not
product runtime.)

## Final Phase: Integration Validation (MANDATORY)

**Objective:** Validate the walking skeleton end-to-end as a real workload, not isolated units.

### Execution

```
pnpm gates                    # format:check → lint → typecheck → test → build (DoD order)
pnpm test -- --coverage       # coverage ≥ 90% on src/**
pnpm bench                    # full benchmark — regenerates baseline; numbers recorded
pnpm example | cat            # non-TTY smoke of the human-runnable caller
```

### Acceptance Criteria

- [ ] `pnpm gates` exits 0 (all five gates, DoD order)
- [ ] Coverage ≥ 90% on `src/**` (critical paths 100%)
- [ ] `pnpm typecheck` exits 0 with 0 errors AND `pnpm lint` exits 0 with 0 warnings
- [ ] Benchmark protocol — `pnpm vitest run tests/bench-baseline.test.ts` exits 0 asserting >= 3 measured runs and finite std_dev in the committed JSON
- [ ] Non-TTY smoke — `pnpm example | cat` exits 0 and output contains both role glyphs
- [ ] Failure scenarios — `## Failure scenarios` section declares `(none — no external I/O touched)`; no chaos pass required

### If Validation Fails

1. Identify plan-caused failures vs pre-existing (pre-code repo → all failures are plan-caused)
2. Fix all before declaring complete; re-run the chain
3. Document any environmental issue (CI runner quirk) in the PR description
