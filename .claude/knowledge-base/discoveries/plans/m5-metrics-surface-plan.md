# Discovery Plan: M5 Metrics surface — TokenUsageChart/CostMeter/ContextWindowBar

**Slug:** `m5-metrics-surface`
**Owner:** paulohenriquevn + Claude (assisted)
**Created:** 2026-07-07
**Time budget:** 5h (per-project breakdown in ADR D1)

## Context

`ROADMAP.md § M5` — Metrics surface: `TokenUsageChart` (ASCII bars), `CostMeter`,
`ContextWindowBar` (fill gauge); numbers formatted (k/M); degrade in NO_COLOR; adapt to
width; snapshots empty/partial/full + narrow. Depends on M0 (RELEASED). Risks:
(1) meaningful ASCII charts at small widths; (2) overclaiming precision in a text gauge.
We own the theme tokens (M0), the windowed surfaces (M1/M3), tool/code surfaces (M2/M4)
and the bench harness. Metrics are the LIGHTEST milestone — static widgets, likely
zero new dependencies.

## Objective

Answer the 6 research questions below with cited evidence from the local reference clones
so `/to-plan` can write the M5 implementation plan with zero unresolved design questions.

## In-Scope / Out-of-Scope

### In-Scope (per reference project)

- `gemini-cli` — production usage displays: `ContextUsageDisplay`, `ContextSummaryDisplay`,
  `Footer`, `StatsDisplay`/`ModelStatsDisplay`, `ModelQuotaDisplay`, their formatters +
  tests.
- `bubbles` (Go) — `progress/` — THE terminal fill-gauge precedent (glyphs, width
  adaptation, percentage display, gradient).
- `codex` — `token_usage.rs` + `status/` (context-window math, formatting) — patterns
  only.
- `assistant-ui/react-ink` — `statusBar/` family (`StatusBarTokenCount`, `StatusBarRoot`)
  — the package-shaped sibling.

### Out-of-Scope (explicit)

- Live data plumbing (M7 adapters own token/cost streams; M5 renders props).
- Sparklines/time-series charts (no roadmap mention — the "chart" is per-category bars).
- Pricing tables/model catalogs (CostMeter renders a NUMBER the caller computed).
- Interactive drill-down (M6+).

## ADRs

### D1 — Time budget + stop conditions

**Decision:** `gemini-cli`: 2h; `bubbles`: 1h; `codex`: 1h; `react-ink`: 1h. Total 5h.

**Rationale:** gemini has the richest set of shipped usage displays; bubbles/progress is
the canonical gauge implementation worth porting glyph-math from; codex brings the
context-window accounting; react-ink the npm-package API shape.

**Stop condition — per question (mandatory):** Fase A empty on named hotspots → ONE
alternative Grep spelling; still empty → `blocked` with attempts recorded. Never fabricate.

**Stop condition — per project (mandatory):** Budget exhausted → remaining questions
`blocked (budget)`.

**Anti-pattern:** NEVER fabricate Fase B answers (Unbreakable Rule 3).

**Consequences:** Blocked questions seed the next discovery.

### D2 — The three components share ONE bar-rendering core (hypothesis to verify)

**Decision:** Q2 verifies whether a single fill-bar primitive (percentage → glyph string
at width W) can serve TokenUsageChart bars, ContextWindowBar and (visually) CostMeter, or
whether the analogs justify distinct renderers. The blueprint picks one architecture with
evidence.

**Rationale:** Roadmap risk 1 (small widths) is solved ONCE if the bar math is shared;
three hand-rolled bars would triple the width edge cases.

**Alternatives considered:** deciding by API taste (rejected: bubbles/progress +
gemini's gauges exist — read them).

**Consequences:** The M5 plan's task decomposition hangs off this verdict.

### D3 — Precision honesty is a RENDER contract (roadmap risk 2)

**Decision:** Q3 must deliver how analogs avoid overclaiming: rounding rules for
percentages (does 99.6% show as 100%?), k/M abbreviation thresholds, cost decimal places,
and any explicit "approx" markers. The blueprint locks a formatting contract with
documented rounding.

**Rationale:** A text gauge that shows "100%" at 99.5% or "$0.00" for $0.004 lies; the
roadmap names this as a risk — it needs pinned oracles, not vibes.

**Alternatives considered:** ad-hoc rounding at implement time (rejected: exactly how
precision drift ships).

**Consequences:** The M5 plan's formatters get exact-value TDD tables.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | Context/token usage semantics: what do analogs DISPLAY (% left vs % used, absolute tokens, window size) and what INPUTS do their components take? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ContextUsageDisplay.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ContextSummaryDisplay.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.tsx`, `.claude/knowledge-base/references/codex/codex-rs/tui/src/token_usage.rs`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/statusBar/StatusBarTokenCount.tsx` | Grep `percent\|context\|remaining\|token` in the named files | Read each end-to-end (all are small) | Input-contract table (used/limit/percentage props) + display convention (% left vs used) + ContextWindowBar/TokenUsageChart v0 API proposals — citations |
| Q2 | Fill-gauge/bar rendering: glyph choices (block chars? colors?), width adaptation, empty/partial/full states, gradient/threshold coloring | techniques | `.claude/knowledge-base/references/bubbles/progress/progress.go`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ModelQuotaDisplay.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/StatsDisplay.tsx` (bars? tables?), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MemoryUsageDisplay.tsx` | Grep `█\|▓\|■\|bar\|Percent\|fill\|width` across the named files + `.claude/knowledge-base/references/bubbles/progress/progress_test.go` | Read `progress.go` end-to-end (glyph + width math regions); read the gemini displays fully | Bar-math contract (fill chars, rounding of the filled-cell count, min/max width, threshold colors) + D2 shared-core verdict inputs — citations |
| Q3 | Number/cost formatting: k/M abbreviation thresholds + rounding, percentage rounding honesty, cost decimals; any "approximate" markers | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/formatters.ts`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/StatsDisplay.tsx` + `ModelStatsDisplay.tsx` (their number columns), `.claude/knowledge-base/references/codex/codex-rs/tui/src/token_usage.rs` (its formatting fns) | Grep `toFixed\|Intl\|format\|abbrev\|[kKmM]\b` in the named files | Read the formatter functions end-to-end; collect exact threshold/rounding rules into a table | Formatting contract table (input → exact output) for tokens (k/M), percentages, costs — the D3 TDD source — citations |
| Q4 | Testing stats/gauge displays: snapshot vs exact-string idioms, empty/partial/full fixtures, narrow-width cases, NO_COLOR | tests | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ContextUsageDisplay.test.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.test.tsx`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ModelQuotaDisplay.test.tsx`, `.claude/knowledge-base/references/bubbles/progress/progress_test.go` | `wc -l` first (EC sampling); Grep `toMatchSnapshot\|lastFrame\|Percent` | Read harness + representative cases per file | Test-idiom table + M5 strategy on OUR kit (exact-value formatter tables, gauge fill-count oracles, width matrix, NO_COLOR scene) — `path:line` per row |
| Q5 | Dependencies: does ANY analog pull a chart/format library for these widgets, or is it all string math + stdlib? | deps | `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json`, `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json`, `.claude/knowledge-base/references/bubbles/go.mod` | Grep `chart\|sparkline\|gauge\|d3\|numeral\|pretty-bytes` in the manifests | Trace any hit to its usage; expected VERIFIED ABSENCE → zero-dep verdict | Rule 9 verdict: expected ZERO new deps (bars = string repeat; formatting = ~20-LoC helpers; Intl.NumberFormat stdlib option evaluated) — citations |
| Q6 | Bench design: is a bench meaningful for static widgets, and what shape (streaming token-count updates re-rendering gauges)? | tools | Our `benchmarks/sampling.ts` + M2-M4 bench lineage; `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.tsx` (the always-mounted usage row — the hot path) | Map which M5 widget sits in a hot path (footer-style always-on gauge under streaming) | Decide: light bench (N ticking updates of ContextWindowBar+TokenUsageChart under the M1 thread — the realistic always-on footer shape) with the usual protocol, OR a recorded justification that no bench is meaningful (cycle owner requires data — default to the light bench) | M5 bench proposal (workload, modes if any, metrics) — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q4 | Covered |
| Dependencies | Q5 | Covered |
| Tools | Q6 | Covered |
| Techniques | Q1, Q2, Q3 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Edge cases absorbed (from /discover-edge-cases 2026-07-07)

- **EC-1 (MUST-FIX, absorbed into Q2):** fill-count rounding at the EDGES — 0% must show a
  genuinely empty bar and 100% a genuinely full one, but 0.4% must NOT round to empty-with-
  "1%" label mismatch nor 99.6% to full-with-"99%" (label and bar must agree). The
  evidence answer must state the analogs' rounding direction (floor/round/ceil) for BOTH
  the filled-cell count and the % label.
- **EC-2 (MUST-FIX, absorbed into Q1):** over-limit inputs (used > limit; tokens beyond
  the context window after compaction) — do analogs clamp, overflow the bar, or mark it?
  If silent, our contract decides (clamp + explicit marker) with the fallback recorded as
  internal precedent.
- **EC-3 (SHOULD, absorbed into Q3):** k/M boundary honesty — 999→"999", 1000→"1k"? 
  1_049_999 → "1M" or "1.0M"? Collect EXACT threshold behavior; if analogs disagree,
  the blueprint picks one with rationale.
- **EC-4 (SHOULD, absorbed into Q2):** width floor — what is the MINIMUM meaningful bar
  width (bubbles has one?); below it, degrade to label-only? (roadmap risk 1).
- **EC-5 (SHOULD, absorbed into Q4):** NO_COLOR gauge readability — if fill is color-only,
  the bar dies in pipes; verify analogs use distinct GLYPHS for filled/empty (the M2
  sign-column lesson).

## Halt-loop Checkpoints

- After each question: citations verified on disk before recording.
- After Q1/Q2: D2 shared-core verdict drafted.
- Before blueprint synthesis: every question `done` or `blocked`; EC sampling recorded for
  any file > 800 lines.

## Acceptance Criteria

- [ ] All 6 questions answered with `path:line` citations that resolve on disk (or honestly `blocked`)
- [ ] Blueprint drafted at `.claude/knowledge-base/discoveries/blueprints/m5-metrics-surface-blueprint.md` with 4/4 corners populated and ≥ 1 ADR incl. the D2 shared-core verdict + D3 formatting contract
- [ ] `python3 .claude/skills/discover-confidence/scripts/run_blueprint_score.py` on the blueprint returns verdict ≥ SHIPPABLE_WITH_CAVEATS
- [ ] Zero fabricated citations — path-existence sweep passes

## Global Definition of Done

- [ ] Blueprint SHIPPABLE(_WITH_CAVEATS) committed on `develop`
- [ ] `/to-plan` can start with zero unresolved design questions (bar math + formatting contract + input contracts + test strategy + bench decision all locked)
