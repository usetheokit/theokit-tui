# Discovery Plan: M4 Code surface — DiffViewer/CodeBlock

**Slug:** `m4-code-surface`
**Owner:** paulohenriquevn + Claude (assisted)
**Created:** 2026-07-06
**Time budget:** 6h (per-project breakdown in ADR D1)

## Context

`ROADMAP.md § M4` — Code surface: `DiffViewer` (terminal unified/split, +/- coloring,
degrades in NO_COLOR), `CodeBlock` with syntax highlight (opt-in dep:
`cli-highlight`/shiki-cli), wide lines (wrap/truncate), large diffs (windowing), snapshot
tests (added/removed/context; highlight on/off). Depends on M1 (RELEASED). Risks:
(1) syntax-highlight dep weight / ESM interop; (2) diff layout at narrow widths. We own
windowed-Static mechanics (M1/M3 — occurrence #3 would trigger the WindowedStatic
extraction), ToolResult truncation idioms (M2) and the AgentEvent timeline (M3 — a diff
event variant is the natural M4 extension point).

## Objective

Answer the 6 research questions below with cited evidence from the local reference clones
so `/to-plan` can write the M4 implementation plan with zero unresolved design questions.

## In-Scope / Out-of-Scope

### In-Scope (per reference project)

- `gemini-cli` — production diff + code rendering: `DiffRenderer.tsx`, `CodeColorizer.tsx`,
  `highlight.ts` (lowlight/highlight.js 11 stack), their tests.
- `assistant-ui/react-ink` — the API-sibling: full `primitives/diff/` family (DiffRoot/
  DiffLine/DiffStats/DiffView, `diff-utils.ts`, `intra-line-utils.ts`, `types.ts`).
- `codex` — second production opinion (Rust): `diff_model.rs`, `diff_render.rs` — patterns
  only, no code reuse.
- `ink` — only where wrapping/measure evidence references it.

### Out-of-Scope (explicit)

- Markdown rendering (gemini MarkdownDisplay etc. — M4 is code/diff primitives, not a
  markdown engine).
- Side-by-side editors / interactive hunk staging (M6+ interactivity).
- Git integration (`get_git_diff.rs` — the CALLER produces the diff text/model; M7).
- LaTeX/unicode transforms (gemini `latexToUnicode` — unrelated).

## ADRs

### D1 — Time budget + stop conditions

**Decision:** `gemini-cli`: 2.5h; `assistant-ui/react-ink`: 2h; `codex`: 1h (skim);
`ink`: 0.5h (contingent). Total 6h.

**Rationale:** react-ink gets more weight than usual — its diff family is the richest
component decomposition (7 files incl. intra-line diffing) and is the package shape we
ship; gemini brings the battle-tested colorizer + height-aware diff renderer; codex is the
orthogonal hunk-model source.

**Stop condition — per question (mandatory):** Fase A empty on named hotspots → ONE
alternative Grep spelling; still empty → `blocked` with attempts recorded. Never fabricate.

**Stop condition — per project (mandatory):** Budget exhausted → remaining questions
`blocked (budget)` in the blueprint.

**Anti-pattern:** NEVER fabricate Fase B answers (Unbreakable Rule 3).

**Consequences:** Blocked questions seed the next discovery.

### D2 — The highlight dependency decision is evidence-first (roadmap names candidates, evidence decides)

**Decision:** Q5 evaluates the roadmap-named `cli-highlight`/shiki AGAINST what the analogs
actually ship (gemini: `lowlight 3.3.0` + `highlight.js 11.11.1`) and against hand-rolling.
The blueprint must deliver: chosen package (or none), ESM interop verdict, weight, how
"OPT-IN" materializes technically (optional peerDependency + graceful degrade vs hard dep)
and the fallback render when the dep is absent.

**Rationale:** Roadmap risk 1 is exactly this decision; M2's D2 precedent (evidence-first
adoption, registry checks at /deps-audit). "Opt-in" is a PACKAGING design question with
testable consequences (module-absent path needs its own test).

**Alternatives considered:** adopt cli-highlight because the roadmap names it (rejected:
Rule 9 demands evaluation; cli-highlight's maintenance status must be checked).

**Consequences:** The M4 plan's Dependencies table carries the verdict + the degrade
contract.

### D3 — Input contract before rendering: diff MODEL vs raw text is a Q1 deliverable

**Decision:** Q1 must answer what the DiffViewer CONSUMES: a raw unified-diff string
(parsed internally — gemini parses hunks from text), a structured model (codex
`diff_model`), or old/new text pair (react-ink computes the diff itself?). The blueprint
picks ONE input contract with evidence, including whether a diff-parsing/diffing dependency
is needed (feeds Q5).

**Rationale:** Everything downstream (windowing, stats, intra-line) hangs off the input
shape; picking it by evidence avoids the M4 rewrite the roadmap risk implies.

**Alternatives considered:** deciding by API taste (rejected: three production analogs
exist — read them).

**Consequences:** The M4 plan's D1 carries the contract; M7 adapters feed it.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | Diff input contract + model + unified rendering: what does each analog consume (raw patch text / old+new pair / structured hunks), how are hunks/line-kinds modeled, and how are +/- lines, line numbers, hunk headers and stats rendered? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/` (all 10 files — `wc -l` each, EC sampling), `.claude/knowledge-base/references/codex/codex-rs/tui/src/diff_model.rs`, `.claude/knowledge-base/references/codex/codex-rs/tui/src/diff_render.rs` | Glob the react-ink diff dir; Grep `parse\|hunk\|@@` in `DiffRenderer.tsx` + `diff_model.rs` | Read `DiffRenderer.tsx` end-to-end; read `types.ts` + `diff-utils.ts` + `DiffLine.tsx` + `DiffView.tsx` (sample others); read the hunk-model region of `diff_model.rs` and the render region of `diff_render.rs` | Input-contract table per analog + hunk/line model + render anatomy (colors, gutters, line numbers, headers, stats) + D3 verdict inputs — citations per row |
| Q2 | Wide lines + narrow widths + large diffs: wrap vs truncate for code lines; how do analogs bound huge diffs (height caps, hunk collapsing, "... N lines hidden"); split-view feasibility at terminal widths? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx` (its `availableTerminalHeight`/MaxSizedBox usage), `.claude/knowledge-base/references/codex/codex-rs/tui/src/diff_render.rs` (wrapping), `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/DiffView.tsx` + `DiffContent.tsx` | Grep `wrap\|truncate\|width\|maxHeight\|hidden\|collapse` across the named files | Read the bounding/wrapping regions; note any split/side-by-side evidence (or its absence — the roadmap says "unified/split"; if NO analog ships split, record the absence honestly) | Wrap/truncate contract per analog; large-diff bounding constants; split-view evidence OR verified absence (roadmap scope check) — citations |
| Q3 | CodeBlock anatomy + highlight application + NO_COLOR: how does gemini map lowlight's hast tree to ink Text; theme/colors; language detection vs explicit prop; what happens with unknown language or no color support? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/highlight.ts`, gemini theme mapping (Grep `theme` in CodeColorizer) | Grep `lowlight\|highlight\|hast\|language` in the two files | Read both end-to-end; trace ONE hast→Text mapping path; note the no-language/plain fallback | CodeBlock v0 anatomy: highlight pipeline, theme mapping strategy, fallback (plain) path, line numbers — citations; NO_COLOR degradation notes |
| Q4 | Testing diff/code rendering: snapshot idioms, highlight on/off determinism, height-constrained cases, unknown-language negatives | tests | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.test.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.test.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/highlight.test.ts`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/DiffView.test.tsx` | `wc -l` first (EC sampling); Grep `toMatchSnapshot\|lastFrame\|fixture` | Read harness + representative cases per file (sampling recorded if > 800 lines) | Test-idiom table (diff fixtures, added/removed/context oracles, highlight on/off, height caps, negative cases) + M4 strategy mapped onto our kit — `path:line` per row |
| Q5 | Dependencies: highlight package verdict (lowlight+highlight.js vs cli-highlight vs shiki vs none) incl. ESM interop + weight + opt-in packaging; does the diff side need a parsing/diffing dep (react-ink's diff-utils: hand-rolled or dep?) | deps | `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json` (+ its `diff/diff-utils.ts` imports), `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/diff-utils.ts` | Grep `highlight\|lowlight\|shiki\|diff` in both package.json; Grep `^import` in `diff-utils.ts` + `CodeColorizer.tsx` | Trace every non-react import; note versions, module systems (ESM/CJS), transitive weight signals | Rule 9 verdict inputs: highlight package choice + opt-in packaging mechanics (optional peer? dynamic import? try/catch require?) + diff-parsing dep verdict — citations; registry checks defer to /deps-audit |
| Q6 | Bench design for large diffs: what to measure (windowed diff rows? highlight cost?) and how the M1/M3 windowing interacts with diff line rows | tools | Our `benchmarks/sampling.ts` + `benchmarks/agent-timeline.bench.tsx` (harness), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx` (height plumbing) | Grep `availableTerminalHeight\|MAX\|maxLines` in DiffRenderer | Map bounding constants to a workload | M4 bench proposal: workload (N-hunk large diff windowed + highlight on/off cost), metrics (same harness), constants adopted — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q4 | Covered |
| Dependencies | Q5 | Covered |
| Tools | Q6 | Covered |
| Techniques | Q1, Q2, Q3 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Edge cases absorbed (from /discover-edge-cases 2026-07-06)

- **EC-1 (MUST-FIX, absorbed into Q2):** The roadmap says "unified/split" but split-view may
  have NO analog evidence in a terminal — if absent, record the verified absence and the
  blueprint MUST take a position (ship unified-only at M4 with split deferred, or design
  split from first principles) rather than silently dropping the word.
- **EC-2 (MUST-FIX, absorbed into Q5):** "Opt-in dep" has ≥ 3 materializations (optional
  peerDependency, dynamic `import()` with graceful degrade, separate entry point). The
  evidence answer must name the mechanism AND its failure mode when the dep is missing
  (typed error? plain render?) — testable via a module-absent test.
- **EC-3 (SHOULD, absorbed into Q1):** react-ink's diff family may compute diffs from
  old/new pairs (intra-line-utils suggests it) while gemini parses patch text — if the
  analogs disagree on the input contract, D3 must weigh BOTH against our M7 adapter story.
- **EC-4 (SHOULD, absorbed into Q3/Q4):** highlight.js theming under FORCE_COLOR vs
  NO_COLOR — the colorizer's output likely embeds theme colors; determinism of highlighted
  snapshots under our pinned env must be verified in Q4 (or flagged as a test hazard).
- **EC-5 (SHOULD, absorbed into Q1):** >800-line files (DiffRenderer, DiffView) — EC
  sampling discipline (wc -l first, named regions, record skips).

## Halt-loop Checkpoints

- After each question: citations verified on disk before recording.
- After Q1/Q2 (techniques block): D3 input-contract verdict drafted; insufficient evidence →
  expand Fase B (budget-permitting).
- Before blueprint synthesis: every question `done` or `blocked` with reason; EC sampling
  recorded for any file > 800 lines.

## Acceptance Criteria

- [ ] All 6 questions answered with `path:line` citations that resolve on disk (or honestly `blocked`)
- [ ] Blueprint drafted at `.claude/knowledge-base/discoveries/blueprints/m4-code-surface-blueprint.md` with 4/4 corners populated and ≥ 1 ADR incl. the D2 highlight verdict + D3 input contract
- [ ] `python3 .claude/skills/discover-confidence/scripts/run_blueprint_score.py` on the blueprint returns verdict ≥ SHIPPABLE_WITH_CAVEATS
- [ ] Zero fabricated citations — path-existence sweep passes

## Global Definition of Done

- [ ] Blueprint SHIPPABLE(_WITH_CAVEATS) committed on `develop`
- [ ] `/to-plan` can start with zero unresolved design questions (input contract + highlight verdict + wrap/windowing contract + test strategy + bench design all locked)
