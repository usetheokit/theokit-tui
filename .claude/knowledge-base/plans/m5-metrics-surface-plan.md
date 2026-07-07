---
slug: m5-metrics-surface
milestone_id: M5
created_at: 2026-07-07
goal: Ship the M5 metrics surface (ContextWindowBar fill gauge, TokenUsageChart category bars, CostMeter) on ONE shared pure fill-bar core with endpoint-honest deterministic formatters (k/M, percent, cost), zero new dependencies, NO_COLOR glyph-distinct degrade, width adaptation, the empty/partial/full+narrow snapshot set, and a committed with/without-metrics delta benchmark baseline.
---

# Plan: M5 Metrics surface — ContextWindowBar + TokenUsageChart + CostMeter

> **Version 1.0** — Implements `ROADMAP.md § M5` on top of M0-M4: a single pure fill-bar
> core (`renderFillBar` + `formatPercent` — THE single rounding authority; label and bar
> can never disagree, EC-1 fixed by construction), hand-rolled deterministic formatters
> (`formatTokens` k/m with boundary promotion; `formatCost` with sub-cent honesty and `~`
> estimate marker), three components on data-props contracts (`{usedTokens, limitTokens?}`
> — never `{model}` registries; unknown limit renders absolute-only, NEVER a fabricated
> percentage), endpoint-honest percentages (99.6% renders "99%", 0.4% renders "1%" — more
> honest than every analog), glyph-distinct `█`/`░` fill (NO_COLOR-readable — the gemini
> color-only bar is the anti-pattern), zero new dependencies (unanimous analog precedent),
> and the with/without-metrics streaming delta bench. All design decisions locked by the
> m5-metrics-surface blueprint (SHIPPABLE 99.7).

## Goal

Enable TypeScript agent-CLI developers to render an always-on metrics footer
(context-window gauge, per-category token bars, cost meter) from the built `@theokit/tui`
package — numbers formatted k/M, honest at the endpoints, readable without color,
degrading gracefully at narrow widths — measured by the CI gate chain (format → lint →
typecheck → test → coverage → build → bench smoke) exiting 0 on `develop`.

## Context

M0-M4 shipped chat, tool, agent and code surfaces. `ROADMAP.md § M5` requires metric
primitives: `TokenUsageChart` (ASCII bars), `CostMeter`, `ContextWindowBar` (fill gauge);
numbers formatted (k/M); degrade in NO_COLOR; adapt to width; snapshots
empty/partial/full + narrow. Risks: (1) meaningful ASCII charts at small widths —
resolved: ONE shared core solves width math once + label-only degrade below a floor
(Blueprint §"D1"/§"D4"); (2) overclaiming precision in a text gauge — resolved:
endpoint-honest `formatPercent` + sub-cent cost honesty + `~` estimate marker (Blueprint
§"D3"). The DISCOVER cycle produced a SHIPPABLE blueprint (99.7) locking six ADRs;
zero new dependencies verified against every analog.

## Baseline Context (deep review of current state)

### Files that will be touched

| File | LoC today | Last commit (sha) | Why it exists today | Invariants to preserve |
|---|---|---|---|---|
| `src/index.ts` | 50 | `f8dfa42` | Composition root | Existing exports unchanged; `VERSION === package.json.version` |
| `src/fill-bar.ts` (NEW) | 0 | — | pure bar core: renderFillBar + formatPercent (single rounding authority) | — |
| `src/fill-bar.test.ts` (NEW) | 0 | — | fill-count + percent TDD tables | — |
| `src/format.ts` (NEW) | 0 | — | pure formatters: formatTokens (k/m) + formatCost | — |
| `src/format.test.ts` (NEW) | 0 | — | formatter TDD tables (D3 oracle rows) | — |
| `src/context-window-bar.tsx` (NEW) | 0 | — | fill gauge component | — |
| `src/context-window-bar.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `src/token-usage-chart.tsx` (NEW) | 0 | — | per-category bars component | — |
| `src/token-usage-chart.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `src/cost-meter.tsx` (NEW) | 0 | — | cost display component | — |
| `src/cost-meter.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `tests/export-surface.test.ts` | 114 | `f8dfa42` | public-entry contract | grows: 3 components present; fill-bar/format internals ABSENT |
| `tests/public-api.integration.test.tsx` | 227 | `526efad` | integration via composition root | grows: metrics footer scene |
| `tests/fixtures/no-color-probe.tsx` | 59 | `f8dfa42` | NO_COLOR subprocess probe | gains a metrics scene (glyph-distinct fill asserts) |
| `src/chat-message.test.tsx` | 191 | `526efad` | NO_COLOR assertions | extends: `█`/`░`/`% left`/`~$` asserts |
| `benchmarks/metrics-footer.bench.tsx` (NEW) | 0 | — | M5 benchmark | — |
| `docs/benchmarks/m5-metrics-baseline.json` (NEW) | 0 | — | committed baseline | M0-M4 baselines refreshed at Final Phase (policy; supersedes the contention-noted m4 baseline — recorded review disposition) |
| `tests/bench-baseline.test.ts` | 405 | `f8dfa42` | baseline schema oracles | gains M5 block (mode matrix + finiteness + recomputes + workload asserts) |
| `examples/metrics.tsx` (NEW) | 0 | — | metrics footer demo (TTFATT caller) | existing examples untouched |
| `tests/example-metrics.integration.test.ts` (NEW) | 0 | — | subprocess smoke (timeout + minimal env) | — |
| `package.json` | 84 | `f8dfa42` | manifest | + `example:metrics` script ONLY (zero new deps) |
| `CHANGELOG.md` | — | `f8dfa42` | M4 entries under Unreleased | every task appends |

### Current callers / dependents

- **No existing production symbol is modified.** New symbols gain first callers inside
  this plan: `examples/metrics.tsx`, `benchmarks/metrics-footer.bench.tsx`,
  integration/probe tests.
- **Symbols consumed (additive):** `useTheoTheme` (`src/theme.tsx` — `status.warning`,
  `status.error`, accent + dim styling); `ChatThread` + `ChatMessage` (bench mount);
  `TheoTUIProvider` (all scenes). The M2/M4 pinned-gutter idiom (`flexShrink={0}` on
  fixed label columns) is reused.
- **Manifest contract test impact:** `tests/export-surface.test.ts` dependency/peer
  assertions UNCHANGED (zero new deps — the M5 delta is components-present +
  internals-absent pins only).
- External: v0.2.0+M2+M3+M4 public API — M5 is purely additive.

### Domain glossary

- **fill-bar core** — pure `renderFillBar(ratio, width, opts?) → {filled, empty,
  filledCells, width}` segments; color-free, Ink-free; the ONE home for clamp + fill
  rounding + glyph repeat (roadmap risk 1 solved once).
- **single rounding authority** — `formatPercent(ratio)` and `renderFillBar` both consume
  the same clamped display percent, so label and bar can never split on 0.4%/99.6%
  (the bubbles granularity mismatch and the gemini round-vs-ceil split are the
  documented trap — Blueprint Corner 4 § Q2/EC-1).
- **endpoint honesty** — "100%" is reserved for ratio ≥ 1 and "0%" for ratio ≤ 0; interior
  ratios clamp to 1..99 ("99%" at 99.6%, "1%" at 0.4%). The bar applies the same rule to
  cells (never full unless truly full, ≥ 1 cell for nonzero, at width ≥ 2). No analog
  protects endpoints (gemini renders "100% used" at 99.5% — live overclaim); this is OUR
  contract, recorded as internal precedent (roadmap risk 2).
- **convention** — ContextWindowBar's `'left'` (codex `"{N}% left ({used} used /
  {window})"` — default; strictly more informative) vs `'used'` (gemini `"{N}% used"`).
- **absolute-only render** — `limitTokens === undefined` → `"{formatTokens(used)} tokens
  used"`, no bar, no percentage — omission over fabrication (codex's `Some(100)`
  unknown-window fallback is the anti-pattern).
- **glyph-distinct fill** — `'█'` filled / `'░'` empty defaults (bubbles + ink-ui/figures;
  both in figures' common set): the fill boundary survives NO_COLOR/monochrome — same
  mechanism class as M4's sign column.
- **estimate marker** — `~` prefix on cost (`~$1.23`) ON by default (cost derives from
  token counts × price sheets); `approx={false}` opts out.

### Architecture boundaries affected

Per `rules/architecture.md § 1-3`: `src/fill-bar.ts` and `src/format.ts` are PURE (no ink
import — unit-testable in milliseconds; the critical paths); the three components are
interface-layer consuming theme via `useTheoTheme()` only (DIP) and the pure modules for
ALL math (no arithmetic in render code beyond layout); `src/index.ts` remains the only
public surface (pure-module internals NOT re-exported — M2 truncateLines / M4 fold-helper
precedent). No external I/O anywhere in M5.

## Prior Art & Related Work

- **Internal blueprint:** `knowledge-base/discoveries/blueprints/m5-metrics-surface-blueprint.md` —
  ADRs D1–D6 consumed verbatim (§ ADRs restates condensed); Corners 1–4 carry the evidence.
- **Patterns skills:** (none exist).
- **Reference projects** (key anchors):
  - `knowledge-base/references/bubbles/progress/progress.go:37-46,305,361-363` — glyphs, clamp, round-fill (THE gauge precedent).
  - `knowledge-base/references/bubbles/progress/progress_test.go:11-94` — fill-count golden-pinning idiom.
  - `knowledge-base/references/ink-ui/source/components/progress-bar/progress-bar.tsx:30-48` — Ink two-Text-runs bar structure.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ProgressBar.tsx:22-36` — ceil semantics + the color-only anti-pattern.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ContextUsageDisplay.tsx:16-47` — % used convention, width-adaptive label, thresholds; the `{model}` coupling we reject.
  - `knowledge-base/references/codex/codex-rs/tui/src/token_usage.rs:9-61` — used + Option<window> contract, clamp-twice, baseline subtraction.
  - `knowledge-base/references/codex/codex-rs/tui/src/status/card.rs:327-408` — "% left (used / window)" wording; omission when window unknown.
  - `knowledge-base/references/codex/codex-rs/tui/src/status/helpers.rs:111-150` — hand-rolled compact formatter shape (boundary anomaly fixed by us).
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.test.tsx:163-186,564-630` — width boundary-pair + formatter-through-component idioms.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ModelQuotaDisplay.test.tsx:41-57` — anchor-then-snapshot + explicit-empty idioms.
- **External literature:** none beyond the above.

## Objective

- [ ] `renderFillBar` + `formatPercent` (single authority, endpoint-honest) pass the pinned fill-count/percent TDD tables at every width in the table
- [ ] `formatTokens` (k/m, boundary promotion `999_950→"1m"`) and `formatCost` (`~$X.XX`, `<$0.01` sub-cent honesty) pass the pinned D3 oracle rows; typed errors on NaN/∞/negative
- [ ] `ContextWindowBar` renders `'left'`/`'used'` conventions with bar+label agreement; unknown limit → absolute-only; over-limit → clamped bar + honest label; typed boundary errors
- [ ] `TokenUsageChart` renders input/output/cached/reasoning bars with k/M values; all-empty → renders nothing (explicit `""` state)
- [ ] `CostMeter` renders `~$X.XX` (opt-out `approx`); never `$0.00` for nonzero sub-cent cost
- [ ] Roadmap snapshots exist: empty/partial/full + narrow width, each anchored by exact strings BEFORE the snapshot (hard convention)
- [ ] NO_COLOR probe proves glyph-distinct fill (`█` vs `░`) readable without color
- [ ] `benchmarks/metrics-footer.bench.tsx` baseline committed (with-metrics|without-metrics matrix, ≥ 3 runs, pinned env, mode delta headline)
- [ ] All gates green locally and in CI (node 20 + 22); coverage ≥ 90% on `src/**` (critical paths 100% lines)

## Dependencies

> Contract for `/deps-audit`. **Zero new dependencies** — the unanimous analog precedent
> (Blueprint Corner 2): every analog gauge is string math; every abbreviation is stdlib
> or ~30 hand-rolled lines. `Intl.NumberFormat` compact evaluated and REJECTED
> (ICU/CLDR-version-dependent oracles; 2-sig-fig cap) — determinism owns the decision.

### Existing — use as-is

| Package | Version | Ecosystem | Why |
|---|---|---|---|
| `ink` | `^5.2.0` | npm | Box/Text primitives |
| `ink-spinner` | `^5.0.0` | npm | (unchanged — not used by M5) |
| `parse-diff` | `^0.12.0` | npm | (unchanged — not used by M5) |
| `react` | `^18.0.0 \|\| ^19.0.0` (peer) | npm | component model |
| `lowlight` | `^3.0.0` (optional peer) | npm | (unchanged — not used by M5) |

### New — to be introduced

| Package | Version | Ecosystem | Rule 9 rationale (libs evaluated) | Why this one |
|---|---|---|---|---|
| (none) | — | — | Evaluated per Blueprint Corner 2: chart/sparkline libs (VERIFIED ABSENCE in all analogs — bars are `"█".repeat(n)`); numeral/pretty-bytes/humanize (stdlib/hand-rolled everywhere; bubbles' go-humanize never touches the gauge); `Intl.NumberFormat` compact (stdlib — rejected for oracle determinism: CLDR-version-dependent boundaries, small-icu builds, 2-sig-fig cap) | Hand-rolled ~30-line formatters + string-repeat bars: 100% deterministic pinned oracles, zero transitive risk |

### Removed

| Package | Last version | Why removed |
|---|---|---|
| (none) | | |

## ADRs

> D1–D6 originate in the blueprint (Blueprint §"ADRs" carries the evidence); restated
> condensed and self-contained. D7–D8 are plan-local.

### D1 — ONE shared pure fill-bar core: `renderFillBar` + `formatPercent`

**Decision:** `src/fill-bar.ts` (PURE — no ink, no react, no color):

```ts
renderFillBar(ratio: number, width: number, opts?: { fullChar?: string; emptyChar?: string;
  rounding?: "round" | "ceil" | "floor" }): { filled: string; empty: string;
  filledCells: number; width: number }
formatPercent(ratio: number): string  // "0%" | "1%" | ... | "99%" | "100%"
```

Defaults `fullChar "█"` / `emptyChar "░"` (glyph-distinct — EC-5) / `rounding "round"`
(bubbles/ink-ui majority; `"ceil"` opts into gemini nonzero-visibility). Ratio clamps to
[0,1] (NaN → TypeError — fail-fast, callers validate first); `width` non-integer or
negative clamps: negative → 0 (EC-4 degrade-never-throw), fractional floored. Segments
returned (not a joined string) so callers style filled/empty independently —
color/threshold policy stays caller-side (bubbles ColorFunc model), never in the core.

**Rationale:** gemini factored one `<ProgressBar>` for its quota rows; ink-ui ships one
externally-themed primitive; bubbles serves everything with one `progress.Model`. The
knowledge — clamp, fill rounding, glyph repeat — is ONE business rule (DRY); three
hand-rolled bars would triple the width edge cases and re-open EC-1 three times.

**Alternatives considered:** per-component bar math (rejected: zero analog evidence);
thresholds inside the core (rejected: gemini duplicates them caller-side anyway — smell);
bubbles' half-block gradient blending (rejected v1: YAGNI without a gradient requirement).

**Consequences:** Critical path with exact fill-count tables; components contain zero
bar arithmetic.

### D2 — Input contracts: data props, never model registries; unknown limit → absolute-only

**Decision:**

```ts
ContextWindowBar({ usedTokens, limitTokens?, convention = "left", baselineTokens = 0, width = 40 })
TokenUsageChart({ usage: Partial<Record<"input" | "output" | "cached" | "reasoning", number>>, width = 40 })
CostMeter({ costUsd, approx = true })
```

Boundary validation FIRST (before hooks — F10 idiom), typed TypeErrors:
`usedTokens`/category values/`costUsd` must be finite numbers ≥ 0; `limitTokens`, when
present, finite > 0; `baselineTokens` finite ≥ 0; `width` integer ≥ 0. Unknown limit
(`limitTokens === undefined`) → absolute-only text (`"12.5k tokens used"`), NO bar, NO
percentage — never fabricate. Over-limit (`used > limit`): ratio clamps (bar full at
`'used'` / empty at `'left'`), label stays endpoint-honest ("100%"/"0% left" — truly
over), error threshold coloring marks the state. `baselineTokens` subtracts from BOTH
used and limit before the ratio (codex parity, opt-in, default 0). Convention `'left'`
renders `"{N}% left ({used} used / {limit})"` (codex — detail clause dim); `'used'`
renders `"{N}% used"` (gemini).

**Rationale:** gemini's `{model}` prop couples the component to a model→limit registry a
provider-agnostic library cannot own; codex's `used + Option<window>` is the right shape;
codex's `Some(100)` unknown-window fallback is the fabrication anti-pattern. Categories =
intersection+union of what codex/gemini actually track (`tool` deferred — YAGNI).

**Alternatives considered:** `{model}` + registry (rejected: M7 adapter business);
percentage-only prop (rejected: loses absolute detail, duplicates clamp math in callers);
throwing on unknown limit (rejected: it is a VALID state — codex models it as Option).

**Consequences:** M7 adapters map provider payloads onto these props; last-turn vs
session-total stays caller-side (documented in JSDoc — codex separates the two).

### D3 — Formatting contract: hand-rolled deterministic formatters, endpoint-honest percent, honest cost

**Decision:** `src/format.ts` (PURE):

1. **`formatTokens(n)`** — `< 1000` → exact digits; else scale to `k`/`m` (lowercase —
   gemini), round HALF-UP to 1 decimal, strip trailing `.0`, PROMOTE the unit when the
   rounded scaled value reaches 1000 (`999_949→"999.9k"`, `999_950→"1m"` — codex's
   `"1000K"` anomaly fixed). `b` falls through free (≥ 1e9), not a designed surface.
   Non-integer inputs floored; negative/NaN/∞ → TypeError.
2. **`formatPercent(ratio)`** (lives in `src/fill-bar.ts` — D7) — clamp [0,1];
   `Math.round(ratio*100)`; then reserve `100` for ratio ≥ 1 (else 99) and `0` for
   ratio ≤ 0 (else 1). `renderFillBar` consumes the SAME display percent with the same
   endpoint rule on cells — EC-1 agreement by construction at every width.
3. **`formatCost(costUsd, { approx = true }?)`** — `$X.XX` (half-up via
   `Math.round(cost*100)/100`, then 2-decimal render), hand-rolled thousands separators
   above 999 (`$1,234.50`); sub-cent honesty: `0 < cost < 0.005` → `"<$0.01"` (never
   `"$0.00"`); exactly 0 → `"$0.00"`; `~` prefix when `approx` (default). Negative/NaN/∞
   → TypeError. Float-representation caveat documented: oracle rows chosen away from
   binary-representation edges.

**Rationale:** All analogs round percentages with zero endpoint protection and zero
approx markers (grep-verified) — the field overclaims and roadmap risk 2 names it.
`Intl` compact rejected (Dependencies §). Cost display has NO analog precedent (verified
absence) — internal design under the honesty rule.

**Alternatives considered:** `Intl.NumberFormat` compact (rejected: CLDR determinism);
gemini's plain `toFixed(0)` (rejected: ships the overclaim); floor-used/ceil-remaining
asymmetric rounding (rejected: the symmetric endpoint-reserve rule is one rule for both
conventions); `$0.00` for sub-cent (rejected: a rendered lie).

**Consequences:** Every row in the TDD tables below is a pinned oracle; snapshots can
never absorb locale/ICU drift (none exists by construction).

### D4 — Component anatomy: label+bar composition, width adaptation, caller-side thresholds

**Decision:** One line per rendered row: fixed label/value columns `flexShrink={0}`
(M2/M4 gutter idiom), bar segments wrapped in two `<Text>` runs (filled colored / empty
dim — ink-ui structure with EC-5 glyph fix). `width` prop = the component's total column
budget (default 40, bubbles precedent); bar cells = `width − fixed columns`; when the
remaining bar width < 3 cells → drop the bar, keep the compact label (label-only degrade
— gemini's `'% used'`→`'%'` move generalized; EC-4); clamp-to-zero, never throw.
Thresholds caller-side per component: ContextWindowBar warn at used-ratio ≥ 0.5 /
error ≥ 1.0 (gemini defaults) via `theme.status.warning`/`theme.status.error`;
TokenUsageChart bars neutral accent; CostMeter plain text (no budget semantics at M5 —
YAGNI). NO_COLOR needs zero branches: glyphs + labels carry the meaning.

**Rationale:** Composition mirrors gemini ProgressBar+quota-row and ink-ui two-Text-runs;
threshold policy caller-side per bubbles (gemini's in-bar thresholds get duplicated in
callers — the documented smell).

**Alternatives considered:** ink-ui self-measuring `measureElement` flexGrow bar
(rejected v1: measurement machinery; our width-prop convention is established);
in-bar percentage à la bubbles (rejected: label outside keeps the core pure).

**Consequences:** Width matrix gets a mechanical invariant + a boundary pair at the
label-only breakpoint; M6 theming inherits clean color seams.

### D5 — Test strategy: TDD tables, fill-count oracles, anchor-then-snapshot, NO_COLOR glyph probe

**Decision:** (1) formatter TDD tables as pure-symbol tests (every D3 row) + one
pass-through test per component; (2) fill-count oracles at width 10 over the EC-1 edge
table (0 / 0.004 / 0.5 / 0.996 / 1) counting glyphs literally on stripAnsi'd frames;
(3) HARD convention: every snapshot preceded by exact-string anchors (gemini discipline
— a snapshot update can never silently absorb a wrong number); empty/partial/full +
narrow snapshot set per component; (4) width matrix `[60, 30, 20]` mechanical invariant
(`every stripAnsi(line).length <= W`) + boundary pair at the label-only breakpoint with
negative-space asserts (what must DISAPPEAR); (5) NO_COLOR probe metrics scene — ONE
subprocess spawn stays one (fold into the existing probe; both analogs LACK this test —
verified gap we fill); (6) negatives: typed errors (NaN/∞/negative, `limitTokens <= 0`,
invalid width), unknown-limit absolute-only, over-limit clamp+honest label, all-empty
chart → explicit `""`.

**Rationale:** Blueprint Corner 1 + our kit's stronger mechanical width idiom; rounding
regressions must fail with readable diffs, not snapshot churn.

**Alternatives considered:** bubbles golden files (rejected: vitest inline oracles
already pin bytes); snapshot-only suites (rejected: anchor-first exists because
snapshots absorb drift).

**Consequences:** The fill-count table doubles as the endpoint-honesty regression suite.

### D6 — Bench: with/without-metrics delta under a streaming M1 thread

**Decision:** `benchmarks/metrics-footer.bench.tsx` on the M3/M4 harness: mount =
`ChatThread` (~50 messages) + metrics footer (`ContextWindowBar` + 2-bar
`TokenUsageChart` + `CostMeter`) under `TheoTUIProvider`; 150 measured steps, each
APPENDS a token to the tail assistant message AND increments `usedTokens`/`costUsd`
props (the always-on-footer update shape); modes `with-metrics` | `without-metrics`
(same thread loop, footer omitted) — the mode DELTA is the headline; protocol unchanged
(1 warmup + 5 measured, population std dev, EC-15 per-run stdout-frames guard, EC-2
zero-frame throw, `--smoke`); baseline `docs/benchmarks/m5-metrics-baseline.json` with
the verbatim "<1σ deltas are INCONCLUSIVE" clause. Expected outcome: delta within noise
— that null result IS the "negligible overhead" evidence; a non-null delta is a caught
layout/memo bug.

**Rationale:** The only falsifiable M5 performance claim is footer overhead in the
streaming hot path (gemini's Footer re-renders per turn from context); formatter
micro-benches are theatre (Blueprint Corner 3).

**Alternatives considered:** no bench (rejected: cycle owner requires data); N-bars
scaling sweep (rejected: no N to scale by design).

**Consequences:** Real numbers for the M5 DoD; Final Phase full `pnpm bench` refresh on
a quiet machine also supersedes the contention-noted m4 baseline (recorded review
disposition).

### D7 — Module split: formatPercent lives WITH the bar math; entry exports components only (plan-local)

**Decision:** `formatPercent` + the shared `displayPercent(ratio)` authority live in
`src/fill-bar.ts` (co-located with `renderFillBar` — the EC-1 agreement is enforced by
one rounding site); `displayPercent` is EXPORTED from the module (not the entry) so
ContextWindowBar's `'left'` label derives as `100 − displayPercent(usedRatio)` from the
same authority (edge-case review EC-1); `src/format.ts` holds `formatTokens` +
`formatCost`. The package entry exports ONLY `ContextWindowBar`, `TokenUsageChart`,
`CostMeter` (+ their props types). `renderFillBar`, `formatPercent`, `displayPercent`,
`formatTokens`, `formatCost` are exported from their modules (components + tests import
them) but NOT re-exported from `src/index.ts` — export-surface pins their absence.

**Rationale:** The blueprint names both modules without fixing formatPercent's home —
resolved for cohesion (the authority lives where agreement is enforced). Entry
minimalism: M2 truncateLines / M4 fold-helper precedent; no consumer demand for raw
formatters yet (YAGNI — additive later).

**Alternatives considered:** one merged `metrics-format.ts` (rejected: fill math and
number formatting change for different reasons — SRP); exporting formatters publicly
(rejected: YAGNI, absence pinned like M4 internals).

**Consequences:** A future public formatter export is one line + one export-surface
update.

### D8 — TokenUsageChart row semantics: bars scale to the LARGEST category; all-empty renders nothing (plan-local)

**Decision:** Fixed row order `input, output, cached, reasoning`; only keys PRESENT in
`usage` render (a present 0 renders an empty bar + `"0"`); each row =
`label (padded, dim) + bar + value (formatTokens)`; bar ratio = `value / max(present
values)` — the largest category shows a full bar (relative comparison chart), avoiding a
fabricated denominator (total tokens is NOT a limit). All categories absent → component
renders nothing (`""` — react-ink's null-at-zero precedent; pinned explicitly). Rows
share ONE label column width (longest present label) so bars align.

**Rationale:** A per-category comparison chart answers "where did tokens go" — relative
bars are the honest scaling (no natural 100% exists); gemini's stats views are tables
(no bars) and codex renders text — the bar semantics are OUR design, minimal and
documented. react-ink returns null at zero tokens (`StatusBarTokenCount.tsx:29`).

**Alternatives considered:** ratio vs sum-of-categories (rejected: bars become
percentages of a total nobody displays — misreads as a limit); rendering absent
categories as 0 (rejected: absent ≠ zero; codex/gemini only show tracked fields);
throwing on all-empty (rejected: valid pre-first-turn state).

**Consequences:** The chart needs no `total` prop at M5 (dropped from the blueprint's
tentative sketch — YAGNI); adding one later is additive.

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Endpoint-honest percent diverges from analog conventions (users comparing side-by-side with gemini see "99%" where gemini says "100%") | Medium | JSDoc documents the contract + rationale; the divergence IS the feature (roadmap risk 2); convention props keep wording familiar | implement |
| Float-representation edges in half-up rounding (`toFixed`/`Math.round` on binary floats) could make an oracle row flaky across engines | Medium | Oracle rows chosen away from representation edges; rounding implemented once via integer-scaled `Math.round`; comment documents the caveat honestly | implement |
| Relative-scaling chart (D8) may surprise users expecting bars vs a total/limit | Low | JSDoc states the semantics ("bars compare categories; the gauge is ContextWindowBar"); D8 records the alternative for a future `total` prop | implement |
| Label-only degrade breakpoint (bar < 3 cells) is a magic number | Low | Pinned by the boundary-pair test; documented in JSDoc; adjustable without API change | implement |
| Bench delta expected within noise — an INCONCLUSIVE result could read as a failed bench | Low | The methodology clause makes INCONCLUSIVE the documented honest outcome; the claim proven is "≤ X ms overhead", not "faster" | implement |

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D6 + plan D7–D8.)

## Critical paths

For `/code-quality` D4 when enabled: `src/fill-bar.ts` (clamp + endpoint rule + fill
rounding), `src/format.ts` (k/m promotion + cost honesty).

## Dependency Graph

```
Phase 1 (fill-bar + format pure cores) ──▶ Phase 2 (three components) ──▶ Phase 3 (integration + example + bench)
                                                                                │
                                                                                ▼
                                                                      Final Phase (integration validation)
```

Sequential — one vertical slice; the example and bench compose all three components.

---

## Phase 1: Pure cores

**Objective:** The shared bar math and formatters, oracle-covered — every downstream
number derives from these two modules.

### T1.1 — fill-bar.ts: renderFillBar + formatPercent (single rounding authority)

#### Objective
Pure fill-bar core with endpoint-honest display percent; EC-1 agreement by construction.

#### Why this step (action + reasoning)

1. **What:** RED TDD tables (fill counts at width 10 over the EC-1 edge set; percent
   endpoint rows; glyph/rounding options; width clamps; typed NaN error) then the
   minimal module per D1/D3/D7.
2. **Why now:** Every component and every label derives from this authority; pure tests
   are the fastest loop (M1 text-buffer precedent).

#### Evidence
- Clamp + round fill: `knowledge-base/references/bubbles/progress/progress.go:305,361-363`.
- Fill-count pinning idiom: `knowledge-base/references/bubbles/progress/progress_test.go:11-94`.
- ceil semantics option: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ProgressBar.tsx:23`.

#### Files to edit
```
src/fill-bar.test.ts — (NEW) RED suite
src/fill-bar.ts      — (NEW) renderFillBar + formatPercent + displayPercent (private)
CHANGELOG.md         — Added entry
```

#### Deep file dependency analysis
- `src/fill-bar.ts`: imports NOTHING (pure). Consumed by all three components + tests.
- NOT exported from `src/index.ts` (D7) — export-surface absence pin lands in T2.1.

#### Deep Dives
- `displayPercent(ratio)` (exported from the MODULE — not the entry; the `'left'`
  convention derives from it, EC-1): clamp [0,1]; `Math.round(ratio*100)`; reserve
  endpoints (100 ⇔ ratio ≥ 1; 0 ⇔ ratio ≤ 0; else clamp 1..99). Non-finite ratio
  (NaN/±∞) → TypeError (single validation site).
- `formatPercent` = `displayPercent + "%"`.
- `renderFillBar`: non-finite ratio → TypeError; width floored, negative → 0;
  cells = `rounding((displayPercent * width) / 100)` clamped [0,width] — INTEGER
  NUMERATOR: `displayPercent/100 * width` has VERIFIED float divergences
  (`7/100*100 === 7.000000000000001` → ceil gives 8; `29% of 50` rounds down to 14)
  while `(p * w) / 100` keeps the .0/.5 boundaries exactly representable (EC-2);
  endpoint guard at width ≥ 2: nonzero ratio never 0 cells, sub-full ratio never
  `width` cells (width 1 degrades honestly: 0 or 1 by rounding — documented).
- Options: fullChar/emptyChar MUST be a single UTF-16-length-1 character (default
  `█`/`░`) — multi-char and surrogate-pair glyphs (emoji) break the cells⇔columns
  invariant and every glyph-count oracle → TypeError
  `renderFillBar: fullChar must be a single character` (EC-4); rounding
  round|ceil|floor applied to the base computation BEFORE the endpoint guard.

#### Tasks
1. RED suite (14 tests below) — fails (module absent)
2. GREEN minimal
3. CHANGELOG

#### TDD
```
RED:     format_percent_endpoint_table() — const rows: [number, string][] = [[-0.5, "0%"], [0, "0%"], [0.004, "1%"], [0.42, "42%"], [0.5, "50%"], [0.995, "99%"], [0.996, "99%"], [1, "100%"], [1.3, "100%"]]; for each: expect(formatPercent(ratio)).toBe(expected)
RED:     format_percent_throws_on_non_finite() — for bad of [Number.NaN, Infinity, -Infinity]: expect(() => formatPercent(bad)).toThrow(TypeError)
RED:     fill_bar_counts_at_width_10() — table [[0, 0], [0.004, 1], [0.5, 5], [0.996, 9], [1, 10]]; for each: const seg = renderFillBar(ratio, 10); expect(seg.filledCells).toBe(cells); expect(seg.filled).toBe("█".repeat(cells)); expect(seg.empty).toBe("░".repeat(10 - cells))
RED:     fill_never_full_until_truly_full() — renderFillBar(0.999, 10).filledCells === 9; renderFillBar(1, 10).filledCells === 10 (endpoint guard)
RED:     fill_never_empty_when_nonzero() — renderFillBar(0.001, 10).filledCells === 1; renderFillBar(0, 10).filledCells === 0
RED:     label_and_bar_agree_at_edges() — for ratio of [0.004, 0.42, 0.996]: (formatPercent(ratio) === "0%") === (renderFillBar(ratio, 10).filledCells === 0) and (formatPercent(ratio) === "100%") === (filledCells === 10) (EC-1 single authority)
RED:     ratio_clamps_out_of_range() — renderFillBar(-2, 10).filledCells === 0; renderFillBar(7, 10).filledCells === 10
RED:     width_zero_and_negative_render_empty_segments() — for w of [0, -5]: seg = renderFillBar(0.5, w); expect(seg.filled).toBe(""); expect(seg.empty).toBe(""); expect(seg.width).toBe(0) (EC-4 degrade)
RED:     fractional_width_floors() — renderFillBar(0.5, 10.9).width === 10
RED:     custom_glyphs_render() — renderFillBar(0.5, 4, { fullChar: "▌", emptyChar: "·" }).filled === "▌▌"
RED:     ceil_rounding_shows_cell_for_tiny_ratio() — renderFillBar(0.42, 10, { rounding: "ceil" }).filledCells === 5; floor at 0.48 width 10 === 4
RED:     fill_cells_integer_numerator_at_wide_widths() — renderFillBar(0.07, 100, { rounding: "ceil" }).filledCells === 7 (NOT 8 — 7/100*100 float trap); renderFillBar(0.29, 50).filledCells === 15 (true half-up — NOT 14) (EC-2)
RED:     glyph_options_reject_non_single_char() — for bad of ["", "ab", "🟩"]: expect(() => renderFillBar(0.5, 10, { fullChar: bad })).toThrow(TypeError); same for emptyChar; expect message "must be a single character" (EC-4)
RED:     fill_bar_throws_on_non_finite_ratio() — for bad of [Number.NaN, Infinity, -Infinity]: expect(() => renderFillBar(bad, 10)).toThrow(TypeError); expect(() => renderFillBar(Number.NaN, 10)).toThrow("renderFillBar: ratio must be a finite number")
GREEN:   Implement fill-bar.ts until all pass
REFACTOR: Keep pure; single displayPercent authority (no second rounding site)
VERIFY:  pnpm vitest run src/fill-bar.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/fill-bar.test.ts` exits 0 (14 tests)
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0 with 0 warnings
- [ ] CHANGELOG updated — `grep -q "fill-bar" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T1.2 — format.ts: formatTokens + formatCost

#### Objective
Deterministic hand-rolled k/m formatter with boundary promotion + honest cost formatter.

#### Why this step (action + reasoning)

1. **What:** RED — the pinned D3 oracle tables (k/m boundaries incl. the promotion rows;
   cost decimals, separators, sub-cent, `~` marker; typed negatives) then the ~40-line
   module.
2. **Why now:** Components render these strings; the tables are the D3 contract the
   whole milestone hangs on.

#### Evidence
- Hand-rolled shape (fixed): `knowledge-base/references/codex/codex-rs/tui/src/status/helpers.rs:111-150`.
- k/m casing + oracle idiom: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.test.tsx:564-630`.

#### Files to edit
```
src/format.test.ts — (NEW) RED suite
src/format.ts      — (NEW) formatTokens + formatCost
CHANGELOG.md       — Added entry (grouped with T1.1)
```

#### Deep Dives
- `formatTokens`: validate finite ≥ 0 (TypeError `formatTokens: value must be a finite
  number >= 0`); floor non-integers; `< 1000` → `String(n)`; units `["k", "m", "b"]` at
  1e3/1e6/1e9: scaled = n/unit; `d = Math.round(scaled * 10) / 10`; if `d >= 1000` →
  promote to next unit (re-round); promotion SATURATES at `b` (the last unit) —
  `999_950_000_000 → "1000b"`, pinned as the undesigned-but-defined tail (EC-10 — the
  codex `"1000K"` anomaly is fixed at k/m where it matters; past `b` there is no next
  unit to promote into); render `d` stripping `.0` (`1k`, `1.1k`).
- `formatCost`: validate finite ≥ 0; `0` → `$0.00`; `0 < cost < 0.005` → `<$0.01`
  (approx marker still applies: `~<$0.01`? NO — sub-cent already communicates
  imprecision; `<$0.01` renders WITHOUT the `~` — documented); else
  `cents = Math.round(cost * 100)`, dollars grouped with hand-rolled comma insertion,
  2-decimal remainder; `~` prefix when approx (default true).
- Float caveat comment: oracle rows chosen away from representation edges (Drawbacks §).

#### Tasks
1. RED suite (8 tests below)
2. GREEN minimal
3. CHANGELOG

#### TDD
```
RED:     format_tokens_boundary_table() — rows: [[0, "0"], [999, "999"], [1000, "1k"], [1049, "1k"], [1050, "1.1k"], [9999, "10k"], [999_949, "999.9k"], [999_950, "1m"], [1_050_000, "1.1m"], [1_500_000_000, "1.5b"], [999_950_000_000, "1000b"]]; for each: expect(formatTokens(input)).toBe(expected) (blueprint EC-3 boundary table + promotion fix + saturation tail EC-10)
RED:     format_tokens_floors_fractional_input() — expect(formatTokens(1500.9)).toBe("1.5k")
RED:     format_tokens_throws_typed_on_invalid() — for bad of [-1, Number.NaN, Infinity]: expect(() => formatTokens(bad)).toThrow(TypeError); expect(() => formatTokens(-1)).toThrow("formatTokens: value must be a finite number >= 0")
RED:     format_cost_table() — rows: [[0, "$0.00"], [1.234, "~$1.23"], [1.236, "~$1.24"], [3.05, "~$3.05"], [999.994, "~$999.99"], [1234.5, "~$1,234.50"], [1_234_567.891, "~$1,234,567.89"]]; for each: expect(formatCost(input)).toBe(expected) (multi-group commas + cents pad — EC-9; all rows verified float-safe)
RED:     format_cost_sub_cent_honesty() — expect(formatCost(0.004)).toBe("<$0.01"); expect(formatCost(0.0001)).toBe("<$0.01"); expect(formatCost(0.005)).toBe("~$0.01") (never "$0.00" for nonzero)
RED:     format_cost_approx_opt_out() — expect(formatCost(1.234, { approx: false })).toBe("$1.23"); expect(formatCost(0, { approx: false })).toBe("$0.00")
RED:     format_cost_zero_has_no_marker() — expect(formatCost(0)).toBe("$0.00") (exact zero is exact)
RED:     format_cost_throws_typed_on_invalid() — for bad of [-0.01, Number.NaN, Infinity]: expect(() => formatCost(bad)).toThrow(TypeError)
GREEN:   Implement format.ts until all pass
REFACTOR: Keep pure; one rounding site per formatter
VERIFY:  pnpm vitest run src/format.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/format.test.ts` exits 0 (8 tests)
- [ ] `pnpm typecheck` + `pnpm lint` exit 0
- [ ] CHANGELOG updated

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 2: Components

**Objective:** The three metric components on the pure cores, snapshot-covered.

### T2.1 — ContextWindowBar

#### Objective
Fill gauge per D2/D4: conventions, unknown-limit absolute-only, over-limit clamp,
thresholds, label-only degrade.

#### Why this step (action + reasoning)

1. **What:** RED — convention wording, bar/label agreement, unknown-limit, over-limit,
   baseline subtraction, thresholds (color bytes), width degrade boundary pair,
   empty/partial/full+narrow anchored snapshots, typed negatives; then the component.
2. **Why now:** The gauge is the roadmap's centerpiece and the richest contract; chart
   and meter reuse its patterns.

#### Evidence
- Wording: `knowledge-base/references/codex/codex-rs/tui/src/status/card.rs:394-408`;
  `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ContextUsageDisplay.tsx:27,40-47`.
- Clamp: `knowledge-base/references/codex/codex-rs/tui/src/token_usage.rs:43-53`.
- Two-Text-runs bar: `knowledge-base/references/ink-ui/source/components/progress-bar/progress-bar.tsx:36-49`.

#### Files to edit
```
src/context-window-bar.test.tsx — (NEW) RED suite
src/context-window-bar.tsx      — (NEW) component
src/index.ts                    — export ContextWindowBar (+ props type)
tests/export-surface.test.ts    — extend (+ absence pins: renderFillBar/formatPercent/displayPercent/formatTokens/formatCost NOT on entry)
CHANGELOG.md                    — Added entry
```

#### Deep Dives
- Boundary guards FIRST (before hooks — F10): usedTokens finite ≥ 0; limitTokens
  (when present) finite > 0; baselineTokens finite ≥ 0; width integer ≥ 0.
- Effective ratio: `used' = max(0, used − baseline)`, `limit' = limit − baseline`;
  `limit' <= 0` → TypeError (`ContextWindowBar: baselineTokens must be < limitTokens`);
  usedRatio = used'/limit' (clamped by the core).
- Render (limit known): `[filled][empty] {percentLabel} {convention wording}
  ({formatTokens(used)} used / {formatTokens(limit)})` — the bar fills with USAGE in
  both conventions (the bar shows consumption; the label states the convention). The
  `'left'` percent DERIVES from the single authority:
  `leftPercent = 100 − displayPercent(usedRatio)` — NEVER a second
  `formatPercent(1 − usedRatio)` call (VERIFIED float trap: `1 − 5e-17 === 1` exactly
  → would render "100% left" while tokens are in use — the endpoint-overclaim class
  roadmap risk 2 forbids; interior drift 34% used / 67% left sums to 101 — EC-1);
  detail clause dim.
- Colors: filled run `theme.status.warning` when usedRatio ≥ 0.5, `theme.status.error`
  when ≥ 1.0, else accent; empty run dim.
- Degrade: fixed columns = the FULL label INCLUDING the detail clause + 1 spacer; bar
  cells = width − fixed; < 3 cells → label-only (drop bar AND detail clause, keep
  `{percent} {wording}`); the degrade is BINARY — no intermediate drop-detail state
  (documented; adjustable later without API change). For the 64k/128k `'left'` fixture
  the label is 26 columns → breakpoint: width 30 renders a 3-cell bar, width 29 is
  label-only — THE boundary pair tested (EC-5).
- Unknown limit: `{formatTokens(used)} tokens used` (dim) — no bar, no percent;
  `baselineTokens` is IGNORED in this state (raw used displayed — the baseline is a
  ratio concept; the baseline<limit guard is unreachable without a limit — EC-12).

#### Tasks
1. RED (17 tests below)
2. GREEN component
3. Exports + absence pins + CHANGELOG

#### TDD
```
RED:     renders_left_convention_with_detail() — renderFrame(<ContextWindowBar usedTokens={64_000} limitTokens={128_000} width={40}/>); plain = stripAnsi(frame); expect(plain).toContain("50% left"); expect(plain).toContain("(64k used / 128k)")
RED:     renders_used_convention() — convention="used"; expect(plain).toContain("50% used"); expect(plain).not.toContain("left")
RED:     bar_glyph_counts_match_label() — width such that bar = 10 cells; usedTokens 50%: count of "█" === 5 and "░" === 5 in stripAnsi(frame) (fill-count oracle, bubbles idiom)
RED:     endpoint_honesty_99_6_percent() — used 127_488 / limit 128_000 (99.6%); expect(plain).toContain("1% left"); bar NOT all "█" (at least one "░") (roadmap risk 2)
RED:     endpoint_honesty_tiny_usage() — used 512 / limit 128_000 (0.4%); expect(plain).toContain("99% left"); expect count of "█" >= 1 via convention-used variant asserting "1% used"
RED:     unknown_limit_renders_absolute_only() — no limitTokens; expect(plain).toContain("64k tokens used"); expect(plain).not.toContain("%"); expect(plain).not.toContain("█") (omission over fabrication)
RED:     over_limit_clamps_bar_and_stays_honest() — used 140_000 / limit 128_000; expect(plain).toContain("0% left"); bar all "█" (clamped full); frame contains error color bytes ("[31m")
RED:     baseline_tokens_shift_ratio() — used 12_000 / limit 24_000 / baselineTokens 12_000; expect(plain).toContain("100% left") (codex parity: used' = 0)
RED:     warning_threshold_boundary_pair() — used 63_999 / limit 128_000: expect(frame).not.toContain("[33m"); used 64_000 / 128_000: expect(frame).toContain("[33m") (>= 0.5 pinned on BOTH sides — EC-11)
RED:     narrow_width_degrades_to_label_only() — THE computed boundary pair (EC-5): width 30 (64k/128k 'left') → expect "█" present with exactly 3 bar cells; width 29 → expect(plain).toContain("% left") and expect(plain).not.toContain("█") and expect(plain).not.toContain("used /") (negative space)
RED:     left_label_never_100_while_used_nonzero() — usedTokens 1 / limitTokens 2e16; expect(plain).toContain("99% left"); expect count of "█" >= 1 (EC-1 — the 1−5e-17===1 float trap)
RED:     used_plus_left_display_percents_sum_to_100() — used 42_880 / limit 128_000 (ratio 0.335): render both conventions; parseInt(usedLabel) + parseInt(leftLabel) === 100 (EC-1 interior drift)
RED:     unknown_limit_ignores_baseline() — usedTokens 12_000, baselineTokens 5_000, no limitTokens; expect(plain).toContain("12k tokens used") (raw used — EC-12)
RED:     width_matrix_lines_fit() — for W of [60, 30, 20]: render in <Box width={W}>; every stripAnsi row length <= W
RED:     snapshots_empty_partial_full_narrow() — 4 renders (0%, 50%, 100%, width 20); each: anchor exact strings FIRST (e.g. toContain("100% left"), fill-glyph count; the 50% partial anchors "[33m" — it sits exactly ON the warning threshold BY DESIGN, EC-11), THEN toMatchSnapshot("context-window-bar-{state}") (anchor-then-snapshot hard convention)
RED:     invalid_inputs_throw_typed_errors() — direct calls: usedTokens -1 → TypeError("ContextWindowBar: usedTokens must be a finite number >= 0"); limitTokens 0 → TypeError; usedTokens NaN → TypeError; width 1.5 → TypeError
RED:     baseline_at_or_above_limit_throws() — baselineTokens 128_000 / limit 128_000 → TypeError("baselineTokens must be < limitTokens")
GREEN:   Implement context-window-bar.tsx until all pass
REFACTOR: Extract label-builder helper if complexity > 10
VERIFY:  pnpm vitest run src/context-window-bar.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/context-window-bar.test.tsx` exits 0 (17 tests)
- [ ] `pnpm vitest run tests/export-surface.test.ts` exits 0 (presence + absence pins)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/context-window-bar.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.2 — TokenUsageChart

#### Objective
Per-category comparison bars per D2/D8: fixed order, relative scaling, aligned rows,
explicit empty state.

#### Why this step (action + reasoning)

1. **What:** RED — row order/presence, relative scaling (largest = full bar), k/M
   values, zero-value row, all-empty `""`, width fit, anchored snapshots, typed
   negatives; then the component.
2. **Why now:** Second consumer of the core proves the shared-bar architecture (D1)
   holds beyond the gauge.

#### Evidence
- Category fields: `knowledge-base/references/codex/codex-rs/tui/src/token_usage.rs:12-17`;
  `knowledge-base/references/gemini-cli/packages/core/src/telemetry/uiTelemetry.ts:43-51`.
- Null-at-zero: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/statusBar/StatusBarTokenCount.tsx:29`.

#### Files to edit
```
src/token-usage-chart.test.tsx — (NEW) RED suite
src/token-usage-chart.tsx      — (NEW) component
src/index.ts                   — export TokenUsageChart (+ props type)
tests/export-surface.test.ts   — extend
CHANGELOG.md                   — Added entry
```

#### Deep Dives
- Guards: every present value finite ≥ 0 (TypeError naming the category); width
  integer ≥ 0.
- Rows: fixed order input/output/cached/reasoning filtered to PRESENT keys; label
  column = longest present label + 1 (padEnd, dim); value column = formatTokens
  (padStart across rows); bar cells = width − label − value − 2 spacers, floor 0;
  ratio = value / max(present values), passed to the core UNMANGLED (no intermediate
  rounding — the core's ≥1-cell endpoint guard must protect tiny categories, EC-8);
  `max === 0` (all present values 0) is SPECIAL-CASED before the division — every row
  ratio 0 (`0/0` is NaN and the core throws on a VALID input otherwise, EC-3); bar via
  core (accent filled / dim empty).
- All absent → return null (renders "").
- Label-only degrade: bar cells < 3 → label + value only (no bar).

#### Tasks
1. RED (13 tests below)
2. GREEN component
3. Exports + CHANGELOG

#### TDD
```
RED:     renders_categories_in_fixed_order() — usage {reasoning: 100, input: 1000, output: 500}; plain rows: expect(rows[0]).toMatch(/^input/); expect(rows[1]).toMatch(/^output/); expect(rows[2]).toMatch(/^reasoning/) (cached absent — not rendered)
RED:     largest_category_shows_full_bar() — input 1000 / output 500 at bar width 10: input row has 10 "█"; output row has 5 "█" + 5 "░" (relative scaling — D8)
RED:     values_render_k_m_formatted() — input 12_500; expect(plain).toContain("12.5k")
RED:     present_zero_renders_empty_bar_and_zero() — usage {input: 1000, cached: 0}; cached row present with 0 "█" and value "0"
RED:     all_present_zero_renders_zero_rows_without_throw() — usage {input: 0, output: 0}; renders 2 rows, 0 "█", values "0", no throw (max===0 special case — EC-3; edge of VALID, distinct from all-absent)
RED:     tiny_category_next_to_huge_keeps_one_cell() — usage {input: 1, output: 1_000_000}; input row has >= 1 "█" (the core endpoint guard reached unmangled — EC-8)
RED:     single_category_renders_full_bar() — usage {input: 500}; all bar cells "█" (max = itself — D8 semantics pinned, EC-8)
RED:     all_absent_renders_nothing() — usage {}; expect(await renderFrame(<TokenUsageChart usage={{}}/>)).toBe("") (explicit empty — react-ink precedent)
RED:     rows_align_on_shared_label_column() — usage {input: 1, reasoning: 1}; both bars start at the same column index in stripAnsi rows
RED:     width_matrix_lines_fit() — for W of [60, 30, 20]: every stripAnsi row length <= W
RED:     narrow_width_drops_bars_keeps_values() — width 14: expect(plain).toContain("12.5k"); expect(plain).not.toContain("█") (label-only degrade boundary)
RED:     snapshots_partial_full_narrow() — 3 states (two categories, all four categories, width 20); anchors first (category names + a formatted value + fill-glyph count), then toMatchSnapshot("token-usage-chart-{state}")
RED:     invalid_category_value_throws_typed() — usage {input: -5} direct call → TypeError("TokenUsageChart: usage.input must be a finite number >= 0"); {output: Number.NaN} → TypeError
GREEN:   Implement token-usage-chart.tsx until all pass
REFACTOR: Reuse a shared row-layout helper only if duplication reaches rule-of-3
VERIFY:  pnpm vitest run src/token-usage-chart.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/token-usage-chart.test.tsx` exits 0 (13 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/token-usage-chart.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.3 — CostMeter

#### Objective
Honest cost display per D2/D3: `~$X.XX`, sub-cent honesty, opt-out marker, typed
boundary.

#### Why this step (action + reasoning)

1. **What:** RED — formatted output through the component, sub-cent, approx opt-out,
   zero, snapshot, typed negatives; then the (thin) component.
2. **Why now:** Completes the roadmap trio; the example/bench footer needs it.

#### Evidence
- Verified absence of any analog cost display (Blueprint Corner 4 § Q3) — internal
  design; honesty rules from `knowledge-base/references/codex/codex-rs/tui/src/status/rate_limits.rs:382-410`
  (nearest analog: whole-integer credits).

#### Files to edit
```
src/cost-meter.test.tsx — (NEW) RED suite
src/cost-meter.tsx      — (NEW) component
src/index.ts            — export CostMeter (+ props type)
tests/export-surface.test.ts — extend
CHANGELOG.md            — Added entry
```

#### Deep Dives
- Guards first: costUsd finite ≥ 0 → else TypeError.
- Render: dim label `cost` + one space + `formatCost(costUsd, { approx })` — one Text
  row; no bar, no thresholds (D4 — YAGNI).
- Formatter validation runs in formatCost (single source); component adds its name to
  the boundary error (`CostMeter: costUsd must be a finite number >= 0`).

#### Tasks
1. RED (6 tests below)
2. GREEN component
3. Exports + CHANGELOG

#### TDD
```
RED:     renders_approx_cost_by_default() — <CostMeter costUsd={1.234}/>; expect(stripAnsi(frame)).toContain("cost ~$1.23")
RED:     approx_false_drops_marker() — approx={false}; expect(plain).toContain("cost $1.23"); expect(plain).not.toContain("~")
RED:     sub_cent_never_renders_zero_dollars() — costUsd 0.004; expect(plain).toContain("<$0.01"); expect(plain).not.toContain("$0.00")
RED:     zero_renders_exact_zero() — costUsd 0; expect(plain).toContain("$0.00"); expect(plain).not.toContain("~")
RED:     snapshot_cost_meter() — anchor toContain("~$1,234.50") first, then toMatchSnapshot("cost-meter") (costUsd 1234.5)
RED:     invalid_cost_throws_typed() — direct calls: -0.01 → TypeError("CostMeter: costUsd must be a finite number >= 0"); Number.NaN → TypeError
GREEN:   Implement cost-meter.tsx until all pass
REFACTOR: None expected (thin component)
VERIFY:  pnpm vitest run src/cost-meter.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/cost-meter.test.tsx` exits 0 (6 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/cost-meter.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 3: Integration + example + bench

**Objective:** Wiring closure + evidence artifacts.

### T3.1 — Composition scene, NO_COLOR metrics scene

#### Objective
Public-entry metrics footer scene; probe metrics scene proving glyph-distinct fill.

#### Why this step (action + reasoning)

1. **What:** Integration scene via `src/index.js` (all three components in one footer
   Box); NO_COLOR probe gains the metrics scene; extended no_color asserts.
2. **Why now:** Wiring pillar (b) + the DoD's NO_COLOR degrade claim needs subprocess
   proof (both analogs lack this test — the gap is ours to close).

#### Evidence
- Probe conventions: `tests/fixtures/no-color-probe.tsx` header lineage; glyph
  distinctness verified in `knowledge-base/references/bubbles/progress/progress.go:37-46`.

#### Files to edit
```
tests/public-api.integration.test.tsx — extend: metrics footer scene via src/index.js
tests/fixtures/no-color-probe.tsx — extend: metrics scene
src/chat-message.test.tsx — extend no_color assertions (█/░ distinct, % left, ~$)
CHANGELOG.md — entry (grouped with T3.2)
```

#### Deep Dives
- Scene: provider + `<Box flexDirection="column">` with ContextWindowBar (partial, limit
  known) + TokenUsageChart (2 categories) + CostMeter — asserts compose in one tree.
- Probe additions: partial gauge (50%) + 2-bar chart + cost; assert BOTH `█` and `░`
  present (distinct glyphs carry the boundary), `% left`, `~$`, no ANSI bytes.

#### Tasks
1. RED (3 tests below)
2. GREEN (wiring only)
3. CHANGELOG

#### TDD
```
RED:     public_entry_composes_metrics_surface() — import { ContextWindowBar, TokenUsageChart, CostMeter } from "../src/index.js"; footer scene render; expect(plain).toContain("% left"); expect(plain).toContain("input"); expect(plain).toContain("~$")
RED:     composed_scene_matches_snapshot() — <Box width={60}> scene; anchors first ("% left", "~$", fill glyphs), then toMatchSnapshot("metrics-surface-scene")
RED:     no_color_render_keeps_glyph_distinct_fill() — probe out: expect(out).toContain("█"); expect(out).toContain("░"); expect(out).toMatch(/\d+% left/); expect(out).toContain("~$"); expect(out).not.toContain("[") (ESC-prefixed house form, src/chat-message.test.tsx:148 — EC-7; glyph-distinct fill = meaning survives without color, blueprint EC-5)
GREEN:   Wire the scenes
REFACTOR: None expected
VERIFY:  pnpm vitest run tests/public-api.integration.test.tsx src/chat-message.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suites exit 0; snapshots stable across two consecutive `pnpm test` runs
- [ ] `pnpm vitest run src/chat-message.test.tsx -t no_color` exits 0 with the extended asserts

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T3.2 — Example + metrics-footer benchmark + committed baseline

#### Objective
`examples/metrics.tsx` demo + `benchmarks/metrics-footer.bench.tsx` +
`docs/benchmarks/m5-metrics-baseline.json`.

#### Why this step (action + reasoning)

1. **What:** RED — M5 baseline schema block (mode matrix `with-metrics`/`without-metrics`
   + finiteness + recomputes + workload asserts) + example smoke; then the demo and the
   bench per D6; full `pnpm bench` run on a QUIET machine; commit baseline.
2. **Why now:** Wiring pillars (a)+(c); cycle owner requires benchmark data; the M5
   full-refresh also supersedes the contention-noted m4 baseline (review disposition).

#### Evidence
- Harness: `benchmarks/sampling.ts` + M3/M4 bench lineage (EC-15 per-run, append-range
  lesson, honest deltas); hot-path rationale
  `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.tsx:179-180,220`.

#### Files to edit
```
tests/bench-baseline.test.ts — extend: M5 block (mode matrix, finiteness, recomputes, workload fields)
tests/example-metrics.integration.test.ts — (NEW) subprocess smoke (execFileSync timeout + minimal env)
benchmarks/metrics-footer.bench.tsx — (NEW) workload per D6
docs/benchmarks/m5-metrics-baseline.json — (NEW) generated via pnpm bench, committed
examples/metrics.tsx — (NEW) demo
package.json — "example:metrics" script
CHANGELOG.md — Added entry
```

#### Deep Dives
- Bench: mount ChatThread with 50 PRE-GENERATED messages + footer (with-metrics mode
  only); 150 steps: append token to tail message text AND `usedTokens += 400`,
  `costUsd += 0.002` (pre-generated step arrays — EC-17 fixture-noise rule);
  per-run EC-15 stdout-frames guard; **cadence symmetry (EC-6): exactly ONE
  `rerender()` per step in BOTH modes; the pre-generated step arrays (message text +
  usedTokens + costUsd) are SHARED — without-metrics runs the same loop with the
  footer subtree simply not mounted** (the tail-message append drives frames in both
  modes, so the EC-15/EC-2 guards behave identically); delta = with − without on
  mean/peak; methodology carries the INCONCLUSIVE clause verbatim + "the reportable
  result is the mode delta".
- Example: non-TTY → static footer scene once (gauge 62% used, 3-category chart, cost),
  exit 0 (M4 examples/code.tsx shape; no async preload needed — no optional deps).
- Baseline JSON: M3/M4 shape; `workload {messages, steps, tokens_per_step,
  categories}`; modes array `["with-metrics", "without-metrics"]`.

#### Tasks
1. RED schema + smoke tests
2. Implement bench + example; `pnpm bench` full run (quiet machine — load < ~9); commit baseline
3. CHANGELOG

#### TDD
```
RED:     m5_metrics_baseline_exists_with_mode_matrix() — parse docs/benchmarks/m5-metrics-baseline.json; expect(modes sorted).toEqual(["with-metrics", "without-metrics"]); protocol.measured_runs >= 3; warmup_runs >= 1; color_env.FORCE_COLOR === "1"; per mode: runs.length === measured_runs, every frames > 0, every metric Number.isFinite (incl. aggregate std_dev + frames_mean), recompute mean/peak/frames_mean within 0.01, std_dev >= 0; workload.messages > 0; workload.steps > 0; methodology contains "INCONCLUSIVE" and contains "delta"
RED:     metrics_example_renders_and_exits_cleanly_when_piped() — execFileSync tsx examples/metrics.tsx (timeout: 30000, minimal env PATH/HOME/FORCE_COLOR); expect(out).toMatch(/\d+% (left|used)/); expect(out).toContain("~$"); expect(out).toContain("█"); exit 0
GREEN:   Implement bench + example; run pnpm bench; commit baseline
REFACTOR: None expected (harness shared)
VERIFY:  pnpm vitest run tests/bench-baseline.test.ts tests/example-metrics.integration.test.ts && pnpm bench --smoke
```

#### Concurrency tests

(none — single-threaded) — sequential awaited rerender loop.

#### Acceptance Criteria
- [ ] `pnpm bench` exits 0; baseline committed with both modes, ≥ 3 finite self-consistent runs each + pinned env
- [ ] `pnpm bench --smoke` exits 0 in < 240s
- [ ] `pnpm example:metrics | cat` exits 0 with gauge + chart + cost content
- [ ] Pass: quality — `pnpm lint` exits 0 on benchmarks/ and examples/

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0; real measured numbers committed

---

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | `TokenUsageChart` ASCII bars (ROADMAP M5 DoD-1) | T1.1, T2.2 | Shared core bars + relative category scaling (D8) |
| 2 | `CostMeter` (DoD-1) | T1.2, T2.3 | formatCost honesty contract (`~`, `<$0.01`) |
| 3 | `ContextWindowBar` fill gauge (DoD-1) | T1.1, T2.1 | Core segments + conventions + unknown-limit/over-limit semantics |
| 4 | Numbers formatted k/M (DoD-2) | T1.2, T2.1, T2.2 | Hand-rolled formatTokens with boundary promotion; pinned tables |
| 5 | Degrade in NO_COLOR (DoD-2) | T2.1, T3.1 | Glyph-distinct `█`/`░` defaults + probe scene subprocess proof |
| 6 | Adapt to width (DoD-2) | T1.1, T2.1, T2.2 | Core width clamp + label-only degrade + width matrix + boundary pairs |
| 7 | Snapshots empty/partial/full + narrow (DoD-3) | T2.1, T2.2, T2.3, T3.1 | Anchored snapshot sets per component + composed scene |
| 8 | Roadmap risk 1 — meaningful charts at small widths | T1.1, T2.1, T2.2 | ONE shared width math + degrade floor + negative-space tests |
| 9 | Roadmap risk 2 — overclaiming precision | T1.1, T1.2, T2.1, T2.3 | Endpoint-honest formatPercent + sub-cent cost + `~` marker + EC-1 agreement oracles |
| 10 | Benchmark data with statistical protocol (cycle owner) | T3.2 | Committed with/without-metrics baseline, pinned env, delta headline |
| 11 | Wiring triad (`rules/cycle-implement.md`) | T3.1, T3.2 | Integration scene + example + bench callers; baseline = runtime evidence |
| 12 | CHANGELOG discipline (Rule 6) | T1.1, T1.2, T2.1, T2.2, T2.3, T3.1, T3.2 | [Unreleased] per task |
| 13 | Zero-new-deps verdict (deps-audit golden rule) | T3.2 | Rule 9 table (Dependencies §) records the evaluated-and-rejected list; /deps-audit PASS 2026-07-07 (0 vulns, both auditors); T3.2 is the only manifest touch (`example:metrics` script — no dep delta) |
| 14 | Edge-case review MUST-FIX EC-1..EC-5 + SHOULD EC-6..EC-12 (review 2026-07-07) | T1.1, T1.2, T2.1, T2.2, T3.1, T3.2 | Absorbed: ADR D7 addendum (displayPercent authority export) + Deep-Dive amendments (integer-numerator fill, single-char glyphs, binary degrade breakpoint, max-0 chart special case, bench cadence pin, unknown-limit-ignores-baseline) + 12 added/strengthened RED oracles |

**Coverage: 14/14 gaps covered (100%)**

## Global Definition of Done

- [ ] All phases completed
- [ ] All tests passing — `pnpm test` green (M0-M4 suites + ~62 new M5 tests)
- [ ] Zero type errors — `pnpm typecheck`; zero lint warnings — `pnpm lint`; format clean — `pnpm format:check`
- [ ] Build green — `pnpm build` produces `dist/index.js` + `dist/index.d.ts`
- [ ] Coverage ≥ 90% on `src/**` — `pnpm test:coverage` exits 0 (critical paths § above: 100% lines)
- [ ] File-size budget — `wc -l` <= 500 per changed source file
- [ ] CHANGELOG `[Unreleased]` updated per task (Rule 6)
- [ ] Backward compatibility — existing API unchanged (M5 purely additive)
- [ ] **Benchmark proof** — `docs/benchmarks/m5-metrics-baseline.json` committed with real numbers (2 modes × ≥ 3 runs, mean ± std dev, finite, self-consistent, `color_env.FORCE_COLOR === "1"`)
- [ ] CI green on develop (node 20 + 22, 7 steps) — NOTE: GitHub Actions is billing-blocked (human action pending); all 7 steps mirrored locally until resolved
- [ ] **Plan archived** — after `/review` READY_TO_MERGE AND the release PR merges, move to `knowledge-base/plans/completed/`

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Final Phase: Integration Validation (MANDATORY)

**Objective:** Prove the M5 surface as a composed workload.

### Execution

```
pnpm gates                    # format:check → lint → typecheck → test → build
pnpm test:coverage            # >= 90% src/**
pnpm bench                    # full run on a QUIET machine (load < ~9) — all six baselines refreshed under pinned env; commit diffs (per-milestone refresh policy; supersedes the contention-noted m4 baseline — review disposition)
pnpm example:metrics | cat    # non-TTY smoke
pnpm vitest run               # second consecutive full run (stability)
```

### Acceptance Criteria

- [ ] `pnpm gates` exits 0; `pnpm test:coverage` exits 0
- [ ] Two consecutive `pnpm vitest run` green
- [ ] `pnpm example:metrics | cat` exits 0 with the metrics footer scene
- [ ] All committed baselines pinned-env + self-consistent; refresh diffs committed
- [ ] Failure scenarios — skipped ("(none — no external I/O touched)")

### If Validation Fails

1. All failures are plan-caused — fix before declaring complete; re-run the chain
2. Document environment quirks in the PR description
