---
slug: m16-tool-card-variants
milestone_id: M16
created_at: 2026-07-08
goal: ToolCallCard result variants — explicit discriminated union {diff|output|preview} dispatching to the existing DiffViewer/ToolResult/CodeBlock inside the card's indent surface; children coexist below; snapshot budget <= 3; zero new deps; existing tool-cards bench re-run (no new mode — render-once path).
---

# Plan: m16-tool-card-variants

## Goal

Ship `ToolCardResult` per blueprint
`.claude/knowledge-base/discoveries/blueprints/m16-tool-card-variants-blueprint.md`
(D1 explicit union over shape sniffing; D2 payload contracts stay with
the primitives; D3 no-new-bench rationale): `result?` on
`ToolCallCardProps` — `{kind:"diff", patch, fileName?, maxLines?,
contextLines?}` | `{kind:"output", shell, maxLines?, expanded?}` |
`{kind:"preview", text, language?, maxLines?}`. Release (0.17.0)
follows READY_TO_MERGE — NEVER a plan task (M10 DV-1 rule).

## Baseline Context

Repo state: develop @ v0.16.0 pending (M15 in flight at plan time; this
plan locks after the M15 release).

### Files that will be touched

| File | LoC | Role |
|---|---|---|
| `src/tool-card-result.ts` | new (~60) | the union type + kind validation (pure — no ink) |
| `src/tool-call.tsx` | 144 → ~210 | `result?` prop + `ResultBody` dispatch inside the card body slot |
| `src/tool-call.test.tsx` | ~200 → ~340 | oracles (a)–(h) + ≤ 3 snapshots |
| `src/index.ts` | — | export `ToolCardResult` type |
| `tests/export-surface.test.ts` | — | type note |
| `examples/stream.tsx` + `tests/example-stream.integration.test.ts` | — | per-kind results on the tool events + smoke asserts |
| `docs/benchmarks/m2-tool-cards-baseline.json` | — | re-recorded (benched file touched — M11 precedent) |
| `CHANGELOG.md` | — | per task |

### Current callers / dependents

- `ToolCallCard` consumers: examples (agent/stream), scenes,
  `tool-cards.bench.tsx`. `result` optional — every existing call site
  unchanged (children-only path byte-identical).
- `DiffViewer`/`ToolResult`/`CodeBlock` gain one internal caller each;
  their public contracts untouched.

### Domain glossary

- **result body** = the union-dispatched primitive mounted in the SAME
  indented slot where children render today (alignment for free).
- **coexistence** = `result` body first, `children` BELOW (both legal —
  EC-3).
- **payload propagation** = the card validates only `kind`; DiffViewer's
  malformed-patch TypeError PROPAGATES (EC-1, fail-fast).

### Architecture boundaries affected

None — composition inside an existing leaf; the union module is pure
data/validation (M13 model-split precedent).

## Prior Art

- Blueprint Corners 1–4 + ADRs D1–D3 (gemini `ToolResultDisplay.tsx:100-175`
  dispatch; our three primitive contracts read at Q2).
- M13 plain-first CodeBlock snapshot determinism finding.
- Test discipline per `.claude/rules/testing.md` (§ 4.1, § 6).

## ADRs

### D1 — Explicit discriminated union; kind validated at the card boundary

**Decision:** `src/tool-card-result.ts` exports the union +
`assertToolCardResult(result)` (TypeError naming ToolCallCard on an
unknown `kind` — the JS boundary makes it reachable, so validate
explicitly instead of a dead `never` guard).
**Rationale:** blueprint D1/Corner 4 — typed API beats gemini's shape
sniffing in a LIB; the M13 v8-ignore discussion showed unreachable
guards are coverage noise — this one is REACHABLE and tested.
**Alternatives considered:** shape sniffing (implicit precedence);
per-kind components (export bloat).
**Consequences:** TS consumers get exhaustive narrowing; JS consumers
get fail-fast.

### D2 — Payload contracts stay with the primitives

**Decision:** no card-level payload validation beyond `kind`;
DiffViewer/ToolResult/CodeBlock keep their tested typed errors, which
PROPAGATE through the card.
**Rationale:** DRY — duplicating patch/envelope validation would drift.
**Alternatives considered:** card-level revalidation (rejected: drift +
double error surfaces).
**Consequences:** oracle (e) pins the propagation.

### D3 — Evidence: existing tool-cards bench re-run, no new mode

**Decision:** ONE load-gated re-run of `tool-cards.bench.tsx` vs its
current baseline (benched file `tool-call.tsx` touched — the M11
headerless precedent); no-new-bench rationale in the implementation log
(result bodies render ONCE — not a per-frame path; flip condition: any
animated result kind).
**Rationale:** blueprint D3 honest analysis of the M9 flip condition.
**Alternatives considered:** a new diff-card mode (measures a static
render — noise).
**Consequences:** both baseline metrics within 1σ OR a citable cause
row in the log.

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| `DiffViewer`/`ToolResult`/`CodeBlock` (internal) | — | no | the composition IS the feature |
| ink `Box`/`Text` | existing ^7.1.0 | no | platform primitives |

**NEW packages: (none).** Manifest untouched (pinned by existing tests).

## Critical paths

- `src/tool-card-result.ts` validation — 100% lines.
- The `ResultBody` dispatch in `tool-call.tsx` — 100% lines.

## Phase 1: The union + dispatch

### T1.1 — tool-card-result union + ResultBody dispatch + oracles

#### Objective

The full variant surface with oracles (a)–(h).

#### Why this step (action + reasoning)

1. **What:** RED executed first (suite vs missing module/prop); GREEN —
   the union module + dispatch in the card body slot.
2. **Why now:** single cohesive surface — the union, dispatch and
   oracles form one task (the primitives already exist).

#### Evidence

- Blueprint Corner 1 oracle set + Corner 4 techniques (indent reuse,
  preview language routing, reachable kind validation).

#### TDD

```
RED:     diff_result_renders_patch_inside_card_indent() — <ToolCallCard name="edit" status="success" result={{kind:"diff", patch: VALID_PATCH}}/>; stripped frame contains "+added line" and "-removed line"; the diff rows start at the children indent column; expect(frame).toMatchSnapshot("tool-card-diff") (snapshot 1/3, anchored)
RED:     output_result_renders_shell_envelope() — result={{kind:"output", shell:{stdout:"ok", stderr:"warn", exitCode:1}}}; frame contains "stdout:" and "exit 1" shapes per ToolResult's envelope contract; expect(frame).toMatchSnapshot("tool-card-output") (snapshot 2/3)
RED:     preview_result_caps_with_language_routing() — result={{kind:"preview", text: twentyLines, language:"ts", maxLines:5}}; frame shows the HEAD lines + dim "+15 more" trailer shape; without language the plain path renders; expect(frame).toMatchSnapshot("tool-card-preview") (snapshot 3/3)
RED:     result_and_children_coexist_children_below() — result preview + <Text>note</Text> children; indexOf(previewFirstLine) < indexOf("note") (EC-3)
RED:     malformed_patch_error_propagates() — result={{kind:"diff", patch:"not a diff"}}; expect render to throw the DiffViewer typed error (EC-1; assert /patch|DiffViewer/)
RED:     unknown_kind_throws_typed() — result={{kind:"bogus"}} as any via direct call; expect(bad).toThrow(TypeError); expect(bad).toThrow(/ToolCallCard/) (reachable boundary — negative case)
RED:     monochrome_keeps_signs_and_labels() — no-color theme, diff kind; zero color SGR; "+"/"-" signs present (the color-independent channel)
RED:     status_independence() — same diff result under status="running" and "success"; body identical modulo the header glyph (strip header line, compare)
VERIFY:  pnpm vitest run src/tool-call.test.tsx src/tool-card-result.test.ts
```

#### Files to edit

```
src/tool-card-result.ts / src/tool-card-result.test.ts
src/tool-call.tsx / src/tool-call.test.tsx
src/index.ts / tests/export-surface.test.ts / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/tool-call.test.tsx src/tool-card-result.test.ts` exits 0; coverage report shows `tool-card-result.ts` and the dispatch lines at 100%
- [ ] `wc -l src/tool-call.tsx` ≤ 230
- [ ] `git diff --numstat <m16-base>..HEAD -- '**/__snapshots__/**'` insertions-only, ≤ 3 new snapshot entries
- [ ] `pnpm vitest run src/tool-card-result.test.ts` exits NON-ZERO before the module exists (RED exit recorded in progress notes)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 2: Wiring + evidence

### T2.1 — Example per-kind results + smoke + bench re-run

#### Objective

Wiring pillars + the D3 evidence.

#### Why this step (action + reasoning)

1. **What:** RED executed (smoke asserts fail against the plain
   example); GREEN — stream example tool events gain one diff, one
   output, one preview result; then the load-gated tool-cards bench
   re-run vs baseline.
2. **Why now:** terminal evidence step (release follows review, NOT
   here).

#### Evidence

- Blueprint Corner 3 (smoke shapes + re-run rationale).

#### TDD

```
RED:     stream_example_perkind_results_render() — extend the smoke: expect(out).toContain("+"); expect(out).toContain("stdout:"); const capped = /more/.test(out); expect(capped).toBe(true) (diff signs + envelope label + preview trailer, deterministic under the pipe contract)
GREEN:   examples/stream.tsx events carry per-kind results; ONE load-gated (< 4, FORCE_COLOR=1) tool-cards bench re-run; table drafted for the log
VERIFY:  pnpm vitest run tests/example-stream.integration.test.ts (3 consecutive exit-0 runs)
```

#### Files to edit

```
examples/stream.tsx / tests/example-stream.integration.test.ts
docs/benchmarks/m2-tool-cards-baseline.json / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] 3 consecutive `pnpm vitest run tests/example-stream.integration.test.ts` invocations exit 0
- [ ] Re-recorded baseline `load_1min_at_start` (add the field — M12 convention) parses < 4; both metrics within 1σ of the prior baseline OR a citable cause row exists in the implementation log

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Edge cases absorbed

(discovery MUST-FIX set: EC-1 malformed patch propagation → T1.1 oracle
e; EC-2 preview cap semantics → T1.1 oracle c (CodeBlock forwarding);
EC-3 coexistence → T1.1 oracle d; EC-4 snapshot budget ≤ 3 → T1.1
budget + monochrome via asserts)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M16 DoD-1: edit/write → diff; bash → output box; read → preview (ROADMAP § M16) | T1.1 | the union + dispatch oracles a–c |
| 2 | M16 DoD-2: API by kind, pure composition, zero deps (ROADMAP § M16) | T1.1 | D1 union; manifest pinned |
| 3 | M16 DoD-3: snapshot budget ≤ 3 + degrade ladder (ROADMAP § M16) | T1.1 | 3 anchored snapshots; monochrome asserts g |
| 4 | M16 DoD-4: example + deterministic smoke (ROADMAP § M16) | T2.1 | stream example per-kind + pipe asserts |
| 5 | M16 DoD-5: gates/coverage/CHANGELOG (ROADMAP § M16) | T1.1, T2.1 | gates-gated commits |
| 6 | M16 risk-1: snapshot explosion (ROADMAP § M16) | T1.1 | ≤ 3 budget; kind × theme via asserts |
| 7 | M16 risk-2: card↔viewer coupling (ROADMAP § M16) | T1.1 | D2 — payload contracts stay with primitives |
| 8 | Bench evidence on a touched benched file (M11 precedent) | T2.1 | tool-cards re-run + table |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Union forwarding surface may grow per consumer demand | Low | additive union members (OCP); YAGNI until asked | implement |
| Error propagation (EC-1) surprises consumers expecting soft-fail | Medium | prop docs state it loudly; matches the lib-wide fail-fast rule | implement |
| tool-call.tsx growth (144 → ~210) | Low | union module extracted; budget 230 | implement |
| Re-run vs old baseline may drift from unrelated M13-M15 changes | Low | 1σ window OR citable cause (the honest-delta discipline) | implement |

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D3.)

## Test Plan

Union validation units + per-kind render oracles + propagation/negative
cases + smoke + bench re-run; discipline per `.claude/rules/testing.md`
(§ 4.1 negatives — malformed patch, unknown kind; § 6 — no timers).
Two consecutive full runs green.

## Final Phase: Integration Validation (MANDATORY)

- `run_validation.py m16-tool-card-variants` exit 0; `/code-quality`
  PASS; coverage: union + dispatch 100% lines.
- Review (multi-role) BEFORE any release — the release chain (0.17.0
  minor) runs only on READY_TO_MERGE (M10 DV-1 rule).

## Global Definition of Done

- [ ] All tasks committed gates-gated (1 task = 1 commit, `gates && commit`)
- [ ] Suite green; zero weakened tests
- [ ] ≤ 3 new snapshots; manifest untouched
- [ ] Tool-cards baseline re-recorded with load field
- [ ] Plan archived post-release
