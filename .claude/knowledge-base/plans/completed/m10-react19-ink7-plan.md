---
slug: m10-react19-ink7
milestone_id: M10
created_at: 2026-07-07
goal: Migrate the foundation to ink ^7.1 + react ^19.2 peer + node >=22 with zero weakened tests, the F1-F7 triage recorded, re-baselined benches, and publish 0.11.0.
---

# Plan: m10-react19-ink7

## Goal

Migrate @theokit/tui from ink 5.2.1/react 18 to ink 7.1/react 19.2 (node
engines ≥ 22) per blueprint
`.claude/knowledge-base/discoveries/blueprints/m10-react19-ink7-blueprint.md`
(SHIPPABLE 96.8): dependency matrix Corner 2 verbatim, suite green under the
never-weaken F1-F7 triage, subprocess probes re-pinned to the ink7 pipe
contract, snapshots re-recorded with per-diff review, StrictMode-flip
absorbed (probe-confirmed), benches re-baselined via the 7-step protocol,
and 0.11.0 published (explicit minor — D4).

## Baseline Context

Repo state at planning: develop @ `9a77776` (v0.10.0 published; 455/455
tests; 12 snapshot files; 6 bench baselines ink5-implicit).

### Files that will be touched

| File | LoC | Role for M10 |
|---|---|---|
| `package.json` | ~95 | ink ^7.1.0, react peer ^19.2.0, react devDep ^19.2.7, @types/react ^19.2.0, engines >=22; version 0.11.0 at release |
| `pnpm-lock.yaml` | — | full re-resolution |
| `src/*.tsx` (8 ink symbols, 23 modules) | — | expected ZERO code changes (blueprint: nothing consumed was removed/renamed); only if triage class (b) exposes our bug |
| `src/use-agent-stream.ts` + `.test.tsx` | 118/~430 | DV-1-era comments/docs flip (D5); assertions unchanged |
| `tests/degrade-matrix.integration.test.tsx` + 6 example smokes | — | re-pinned to the ink7 pipe contract (final-frame-only; escape-absence asserts become trivially true — kept) |
| 12 `__snapshots__` files | — | re-recorded ONLY where a blueprint delta justifies; per-diff review table in the log |
| `tests/package-manifest.test.ts` + `tests/package-contract.test.ts` | — | version pins flip by design (react ^19.2.0, ink ^7) |
| `docs/benchmarks/*.json` (6) | — | new-stack baselines + additive `stack` field |
| `.github/workflows/ci.yml` | — | matrix [22.x, 24.x] |
| `README.md` | — | Node ≥ 22, react 19 install line |
| `docs/ttfatt.md` | — | superseded-note pointing at the 0.11.0 re-measure |

### Current callers / dependents

- All 23 src modules consume ink via 8 symbols (Box/Text/render/useApp/
  Static/useStdout/useInput/useFocus) — blueprint Corner 4: API-compatible.
- Consumers of @theokit/tui 0.10.x (react 18) are NOT auto-upgraded (npm
  caret on 0.x — semver memo) — the narrowing is opt-in and fails loud.

### Domain glossary

- **F1-F7** = blueprint failure-class pre-map (post-unmount `"\n"` frame;
  falsy-columns fallback; snapshot mass-diff; bare-ESC 20 ms; paste channel;
  reconciler timing; throttle/settle — stable).
- **triage table** = per-failure record: class (a) ink-behavior → new assert
  + citation / (b) our bug → fix / (c) harness → port.
- **pipe contract** = ink7 non-interactive output shape (incremental static
  + one final frame at unmount, zero escapes).
- **jump table** = the 20-metric 0.10.0→0.11.0 bench comparison documenting
  the cross-stack delta before new baselines become the reference.

### Architecture boundaries affected

None structurally — same 8-symbol surface, same layering. Platform floors
move (node ≥ 22, react ≥ 19.2). No new abstractions, no fork, no
`concurrent: true` (review guard — default mode keeps every timing pin).

## Prior Art

- Blueprint (SHIPPABLE 96.8) — Corners 1-4 consumed verbatim below.
- M7 bench protocol precedent (`.claude/knowledge-base/implementations/m7-stream-adapter-implementation.md` § bench).
- M8 rehearsal harness (caught the react-19 break pre-publish).

## ADRs

### D1 — One-slice upgrade; tasks per surface

**Decision:** single milestone bumps ink+react+types+engines together;
task split: deps+typecheck → in-process suite triage → subprocess/pipe
re-pins → snapshot re-record → StrictMode absorption → bench re-baseline →
release+publish.
**Rationale:** ink7 requires react ≥ 19.2 — no incremental path (blueprint).
**Alternatives considered:** ink6 stepping stone (rejected: same react
wall, double migration); vendor fork (rejected: gemini's fork is an
app-vendor play — maintenance we must not own).
**Consequences:** tasks below mirror the blueprint sections.

### D2 — Never-weaken triage over F1-F7

**Decision:** every post-bump failure classified (a/b/c) in a triage table
recorded in the implementation log; zero test deletions/loosening; the
sync-throw pin explicitly re-verified.
**Rationale:** the suite is the migration's only safety net.
**Alternatives considered:** blanket snapshot `-u` + fix-forward (rejected:
blinds the re-baseline; hides real regressions).
**Consequences:** implementation log carries the full table.

### D3 — Re-baseline protocol (blueprint Corner 3, 7 steps)

**Decision:** freeze v0.10.0 baselines by git ref; M7 run conditions;
20-metric jump table MANDATORY; every ADVERSE delta cites a stack cause
(throttle default / measure-dep majors / reconciler 0.33); gate = "PASS
unless an ADVERSE delta has NO citable stack cause; unexplained ADVERSE
beyond 1σ AND > 2× old mean BLOCKS"; new baselines + additive
`stack: {ink, react, ink_testing_library}` schema field become THE
reference; snapshots re-recorded only where a blueprint delta justifies.
**Alternatives considered:** skip the jump table (rejected: poisons future
regression detection); keep old baselines (rejected: stack-relative).
**Consequences:** future comparisons resolve "last VALID baseline by ref".

### D4 — Version 0.11.0, explicit minor

**Decision:** publish 0.11.0; CHANGELOG entries worded "Requires: react
>= 19.2, node >= 22" (NEVER the `BREAKING:` prefix — auto-derivation would
compute the dogfood-forbidden 1.0.0); release invoked with explicit minor;
this ADR records the 0.x convention (semver item 4 + npm caret: 0.x minors
are opt-in, peer/engines checks fail loud).
**Alternatives considered:** 1.0.0 (rejected: dogfood golden rule — no
sustained-use evidence); patch (rejected: dishonest for platform narrowing).
**Consequences:** README/release notes carry the platform table prominently.

### D5 — StrictMode flip absorption

**Decision:** re-run the M7 probe at bump (expect create/destroy 2/1 under
StrictMode, 1/0 without — source-proven in the blueprint); update DV-1-era
comments/docs (`src/use-agent-stream.ts` guidance becomes ACTIVE:
factory-under-StrictMode now mandatory-in-practice); assertions stay
as-written (env-robust by M7 design).
**Alternatives considered:** skip the probe (rejected: the claim flip must
be evidence-confirmed, not source-inferred only).
**Consequences:** documentation truthful; zero assertion changes.

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| `ink` | `^7.1.0` (was ^5.2.0) | bump | the platform itself |
| `react` peer | `^19.2.0` (was ^18.2.0) | bump | mirror ink's exact floor — never looser |
| `react` devDep | `^19.2.7` | bump | current registry |
| `@types/react` | `^19.2.0` (was ^18.3.0) | bump | satisfies ink's optional types peer |
| `ink-testing-library` | `^4.0.0` (unchanged) | no | our suite validates it on ink7 (its ink peer is stale metadata) |
| `ink-spinner` | `^5.0.0` (unchanged) | no | imports only `Text` — source-verified; gemini precedent on react 19.2 |
| engines.node | `>=22` (was >=20) | bump | ink7 engines |

**NEW packages: (none).** `pnpm audit` re-run after the bump is a T1.1 AC.

## Critical paths

- The bump itself (T1.1-T1.4) — the whole suite is the critical path;
  module coverage targets unchanged (≥ existing).

## Phase 1: The bump + suite green

### T1.1 — Dependency bump + typecheck sweep

#### Objective
New stack installed; typecheck green; audit clean.

#### Why this step (action + reasoning)

1. **What:** RED — the flipped version-pin tests (manifest/contract) written
   FIRST against the new matrix; GREEN — `pnpm add` the matrix + engines +
   fix any TS19 fallout (expected ~zero — blueprint TS sweep).
2. **Why now:** everything else runs on the new stack.

#### Evidence
- Blueprint Corner 2 matrix; TS19 risk sweep (zero removed-type hits).

#### Files to edit
```
package.json / pnpm-lock.yaml — the matrix + engines >=22
tests/package-manifest.test.ts — react peer pin → "^19.2.0"; ink → /^\^7/
tests/package-contract.test.ts — react_peer_range_is_honest → "^19.2.0"
CHANGELOG.md — "Requires:" entries (D4 wording)
```

#### TDD
```
RED:     package_manifest_declares_react_required_peer_and_ink_as_dependency() — updated pins: expect(pkg.peerDependencies.react).toBe("^19.2.0"); expect(pkg.dependencies.ink).toMatch(/^\^7/); expect(pkg.engines.node).toBe(">=22") (fails on the old manifest — RED before the bump)
RED:     react_peer_range_is_honest() — expect(peers["react"]).toBe("^19.2.0") with the comment citing the ink7 floor (blueprint Corner 2)
VERIFY:  pnpm install && pnpm typecheck && pnpm audit
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm typecheck` exits 0 on the new stack
- [ ] `pnpm audit` clean post-bump
- [ ] `node -e "console.log(require('ink/package.json').version)"` fails ESM but `pnpm ls ink` shows 7.1.x

#### DoD (Definition of Done)
- [ ] gates NOT expected green yet (suite triage is T1.2-T1.4) — this task's gate is typecheck+lint+audit; commit message flags the intermediate state

### T1.2 — In-process suite triage to green

#### Objective
All non-subprocess tests green under the D2 triage.

#### Why this step (action + reasoning)

1. **What:** run the in-process suite; classify every failure (a/b/c)
   against F1-F7; fix per class; record the triage table.
2. **Why now:** in-process failures are the cheapest loop; subprocess
   contract changes are a separate concern (T1.3).

#### Evidence
- Blueprint Corner 1 (harness verdicts: every idiom KEEP) — expected
  failure surface is SMALL outside snapshots.

#### Files to edit
```
(driven by triage — expected: near-zero src changes; possible test-comment
updates where behavior claims flip)
CHANGELOG.md — entry if any src change lands
```

#### TDD
```
RED:     it_count_never_decreases() — never-weaken contract pin (tests/package-contract.test.ts extension): const changed = execFileSync("git", ["diff", "--name-only", M10_BASE, "--", "src", "tests"]).toString().trim().split("\n").filter((f) => /\.test\./.test(f)); for (const f of changed) { const before = (execFileSync("git", ["show", `${M10_BASE}:${f}`]).toString().match(/\bit\(/g) ?? []).length; const after = (readFileSync(f, "utf8").match(/\bit\(/g) ?? []).length; expect(after, f).toBeGreaterThanOrEqual(before); } (permanent D2 guard — RED if any migration commit drops a test)
RED:     the post-bump failing set recorded verbatim in the triage table before any fix
GREEN:   per-failure fix by class — (a) new assert + blueprint citation; (b) code fix + regression test; (c) harness port
VERIFY:  pnpm vitest run --exclude "tests/**/*.integration.*" exits 0 (in-process green); triage table complete in the log draft
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] In-process suite green; ZERO tests deleted/skipped — `git diff --stat <m10-base>..HEAD -- 'src/*.test.*'` shows no deletions of `it(` blocks (verified by `grep -c "it(" per changed test file, count never decreases)
- [ ] Sync-throw pin explicitly re-verified green (`src/chat-composer.test.tsx` composer_enter throw test)

#### DoD (Definition of Done)
- [ ] Triage table (failure → class → resolution → citation) drafted

### T1.3 — Subprocess probes re-pinned to the ink7 pipe contract

#### Objective
Degrade matrix + 6 example smokes green under final-frame-only output.

#### Why this step (action + reasoning)

1. **What:** run the integration suite; re-pin per the blueprint pipe
   contract (content asserts survive; any frame-count/erase assumptions
   updated with citation).
2. **Why now:** isolated from in-process (different failure mechanics).

#### Evidence
- Blueprint Corner 4 § Pipe-mode contract (escape-absence asserts become
  trivially true — KEPT; TERM=dumb byte-equality both-sides-flip preserved).

#### Files to edit
```
tests/degrade-matrix.integration.test.tsx — re-pins WITH blueprint citations
tests/example-*.integration.test.ts (6) — content asserts expected to survive
CHANGELOG.md — entry if assertions changed
```

#### TDD
```
RED:     degrade_scene_is_final_frame_only() — NEW ink7 pipe-contract pin added to the degrade matrix: const out = spawnProbe({ NO_COLOR: "1" }); const occurrences = out.split("plain text probe").length - 1; expect(occurrences).toBe(1) (ink5 pipes wrote N intermediate frames — this pins the ONE-final-frame contract; RED on ink5, GREEN on ink7)
RED:     the post-bump failing integration set triage-recorded verbatim before fixes
GREEN:   re-pin with blueprint citations; NO content-assert weakened
VERIFY:  pnpm vitest run tests/ exits 0 (full integration green)
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `grep -c 'toContain("Probe")\|toContain("hint row")\|not.toContain' tests/degrade-matrix.integration.test.tsx` count does not decrease vs `git show <m10-base>` (content asserts preserved)
- [ ] Each of the 6 example smokes still greps ≥ 2 rendered-content strings — `for f in tests/example-*.integration.test.ts; do test $(grep -c "toContain(" $f) -ge 2; done` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0 (first full-green gate of the milestone)

### T1.4 — Snapshot re-record with per-diff review

#### Objective
12 snapshot files current; every diff justified by a blueprint delta.

#### Why this step (action + reasoning)

1. **What:** re-record failing snapshots ONE FILE AT A TIME; for each diff,
   record the justifying delta (measure-dep major / pipe shape / SGR
   sequencing) in the review table; reject unexplained diffs as class (b).
2. **Why now:** after T1.2/T1.3 the only remaining reds are snapshots.

#### Evidence
- Blueprint F3 (diff concentration map: truncate-end consumers, EAW tests,
  bordered frames — cli-boxes glyphs PROVEN stable, so border-glyph diffs
  would be class (b) suspicious).

#### Files to edit
```
src/__snapshots__/*.snap (11) + tests/__snapshots__/*.snap (1)
```

#### TDD
```
RED:     rerecorded_snapshots_all_reviewed() — contract test (tests/package-contract.test.ts extension): const table = readFileSync(".claude/knowledge-base/implementations/m10-snapshot-review.md", "utf8"); const changed = execFileSync("git", ["diff", "--name-only", M10_BASE, "--", "src/__snapshots__", "tests/__snapshots__"]).toString().trim(); for (const f of changed.split("\n").filter(Boolean)) expect(table, f).toContain(basename(f)) (RED until the review table names every re-recorded file)
GREEN:   per-file re-record + review table row (file → what changed → justifying blueprint delta)
VERIFY:  two consecutive pnpm test runs green with byte-identical snapshots
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `rerecorded_snapshots_all_reviewed` green (table covers 100% of changed snapshot files)
- [ ] Border glyphs UNCHANGED in snapshots (cli-boxes stability proof) — `git diff <m10-base>..HEAD -- '**/__snapshots__/**' | grep -cE "^[+-].*[╭┌]" ` outputs 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Phase 2: Evidence + release

### T2.1 — StrictMode probe + DV-1 documentation flip

#### Objective
D5 executed: flip confirmed by experiment; docs truthful.

#### Why this step (action + reasoning)

1. **What:** RED — the probe test (temporary or permanent?) — PERMANENT
   canary `tests/strict-effects-canary.test.tsx`: create/destroy counter
   under StrictMode asserting the CURRENT reconciler behavior (2/1) with a
   comment tying it to the blueprint; plus control (1/0 without).
2. **Why now:** post-green, pre-release — the claim flip must be recorded.

#### Evidence
- Blueprint Corner 1 § StrictMode flip (source-proven); M7 probe shape.

#### Files to edit
```
tests/strict-effects-canary.test.tsx — (NEW) the permanent canary
src/use-agent-stream.ts — doc comments updated (factory guidance ACTIVE)
src/use-agent-stream.test.tsx — comment updates ONLY (assertions untouched)
CHANGELOG.md — entry
```

#### TDD
```
RED:     strict_mode_double_invokes_effects_on_ink7() — StrictMode-wrapped probe component with useEffect counters; await ticks; const counts = captured; expect(counts.creates).toBe(2); expect(counts.destroys).toBe(1) (RED on ink5 — GREEN only on the new stack)
RED:     no_strict_mode_single_invoke_control() — same probe unwrapped; expect(counts.creates).toBe(1); expect(counts.destroys).toBe(0)
VERIFY:  pnpm vitest run tests/strict-effects-canary.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Canary green; `grep -c "does NOT enable StrictMode" src/use-agent-stream.test.tsx` outputs 0 (stale claim gone)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.2 — Bench re-baseline (D3 protocol)

#### Objective
6 new-stack baselines committed with the jump table.

#### Why this step (action + reasoning)

1. **What:** RED — extend `tests/bench-baseline.test.ts` to require the new
   `stack` field; GREEN — run the 7-step protocol (load-gated isolated
   runs), build the 20-metric jump table, commit baselines.
2. **Why now:** post-suite-green (stable stack), pre-release.

#### Evidence
- Blueprint Corner 3 protocol; M7 precedent.

#### Files to edit
```
benchmarks/*.bench.tsx or sampling.ts — additive stack field in the writer
tests/bench-baseline.test.ts — stack-field contract pin
docs/benchmarks/*.json (6) — new baselines
CHANGELOG.md — entry referencing the jump table
```

#### TDD
```
RED:     baseline_records_stack_versions() — for each of the 6 baseline files: const b = JSON.parse(readFileSync(f)); expect(b.stack.ink).toMatch(/^7\./); expect(b.stack.react).toMatch(/^19\./) (RED until the writer + runs land)
VERIFY:  jump table complete (20 metrics, every ADVERSE cited); gates green
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Jump table in the log: 20 metrics, per-ADVERSE stack-cause citation, zero "unexplained catastrophic" rows (gate wording D3)
- [ ] Load-gated runs — each baseline JSON records `color_env.FORCE_COLOR === "1"` and the log lists per-bench load_at_start < 4.0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.3 — Rehearsal + release 0.11.0 + publish + CI/README

#### Objective
0.11.0 on the registry; platform change loudly documented.

#### Why this step (action + reasoning)

1. **What:** tarball rehearsal on a FRESH react-19/node-22 project (M8
   harness) → CI matrix [22.x, 24.x] + README platform table → release
   chain explicit-minor → npm publish → registry verify → TTFATT re-measure
   noted in docs/ttfatt.md (superseded section).
2. **Why now:** terminal step.

#### Evidence
- M8 rehearsal harness; D4 memo; blueprint Q6c CI diff.

#### Files to edit
```
.github/workflows/ci.yml — matrix [22.x, 24.x]
README.md — Node ≥ 22 / react 19 install
docs/ttfatt.md — 0.11.0 re-measure appended
CHANGELOG.md — release promote (0.11.0)
```

#### TDD
```
RED:     readme_and_ci_declare_new_platform() — expect(readFileSync(".github/workflows/ci.yml","utf8")).toContain("22.x"); expect(ci).not.toContain("20.x"); const md = readFileSync("README.md","utf8"); expect(md).toMatch(/Node ≥ 22|node >=22|Node 22/i); expect(md).toContain("react@19") (extend tests/package-contract.test.ts)
VERIFY:  rehearsal transcript green BEFORE publish; npm view @theokit/tui@0.11.0 version after; fresh registry install renders
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Rehearsal transcript in the log: fresh tmp project, `npm i <tarball> react@19 tsx`, consumer renders — output contains the banner name AND "✓" (exit 0) BEFORE `npm publish` runs
- [ ] `npm view @theokit/tui@0.11.0 version` returns 0.11.0; fresh registry install + render exits 0
- [ ] TTFATT re-measured from the registry and appended (< 10 min)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0; release chain RELEASED; M10 checkbox flipped

## Edge cases absorbed

(inline at plan time — the blueprint IS the edge-case absorption for this
milestone: F1-F7 pre-map, pipe contract, StrictMode flip, falsy-columns
guard, verify-at-bump pins. The plan adds no separate review round; the
per-task ACs encode each edge.)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M10 DoD-1: ink ^7 + react ^19.2 peer, rehearsal-proven (ROADMAP § M10 revised) | T1.1, T2.3 | matrix bump + fresh-install rehearsal + registry verify |
| 2 | M10 DoD-2: full suite green, zero weakened tests (ROADMAP § M10) | T1.2, T1.3, T1.4 | D2 triage (a/b/c) + no-deletion AC + review table |
| 3 | M10 DoD-3: degrade-matrix + benches re-baselined with ADVERSE-only jump table (ROADMAP § M10) | T1.3, T2.2 | pipe re-pins + D3 7-step protocol + stack field |
| 4 | M10 DoD-4: publish minor with rehearsal; sdk tripwire re-run (ROADMAP § M10) | T2.3, T1.2 | 0.11.0 explicit minor; tripwire rides typecheck in every gate |
| 5 | M10 DoD-5: DV-1 re-evaluated honestly (ROADMAP § M10) | T2.1 | permanent strict-effects canary + doc flip |
| 6 | Rule 6 CHANGELOG | all | "Requires:" wording (D4) per task |
| 7 | Engines/CI/README platform coherence (blueprint Q6c) | T2.3 | same-commit matrix+README+engines pins |
| 8 | Never-weaken discipline (grill R1) | T1.2-T1.4 | triage table + it-count non-decrease AC |

**Coverage: 8/8 gaps covered (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| react-18 consumers left on 0.10.x | Medium | npm caret keeps them un-broken (opt-in narrowing); README/notes state the line split loudly (D4) | implement |
| Snapshot re-record could mask a real regression | Medium | per-diff review table + border-glyph zero-diff AC (cli-boxes proven stable) + D2 class-(b) suspicion rule | implement |
| Bench deltas conflate throttle vs real cost | Low | D3 step 5 records which path the harness hits; per-ADVERSE citations | implement |
| itl4 never author-validated on ink7 | Low | our 455-test suite IS the validation (blueprint Corner 2); failures triage as class (c) | implement |
| Local piped runs may lay out at controlling-terminal width (ink7 /dev/tty fallback) | Low | our smoke asserts are string-containment, never exact-width; CI has no tty (settles at 80) | implement |

## Failure scenarios (when I/O external)

- `npm publish` failure → retry once; 4xx → HALT (never force).
- Registry propagation lag on verify → bounded retries (≤ 3 × 10 s), then
  HALT with evidence.

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D5.)

## Test Plan

Version-pin REDs (T1.1) → triage-driven greens (T1.2/T1.3) → snapshot
review table (T1.4) → strict-effects canary (T2.1) → stack-field baseline
contract (T2.2) → platform pins + rehearsal + registry verify (T2.3). Two
consecutive full runs green pre-release.

## Final Phase: Integration Validation (MANDATORY)

- `run_validation.py m10-react19-ink7` exit 0; `/code-quality` PASS.
- Coverage ≥ existing (no module drops below its pre-M10 line coverage).
- Backward compat N/A by design (platform narrowing IS the milestone) —
  the compat statement is the 0.10.x line note (D4).

## Global Definition of Done

- [ ] All tasks committed gates-gated (T1.1's intermediate gate documented)
- [ ] 455+ tests green on ink7/react19; zero deleted/skipped; triage table complete
- [ ] Snapshot review table 100%; border glyphs zero-diff
- [ ] Strict-effects canary green (2/1 strict, 1/0 control)
- [ ] 6 new baselines + jump table + stack field
- [ ] Published 0.11.0 verified (npm view + fresh install render)
- [ ] CI [22.x, 24.x]; engines >=22; README platform table
- [ ] Plan archived post-release
