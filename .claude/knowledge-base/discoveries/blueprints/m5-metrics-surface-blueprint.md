# Blueprint: M5 Metrics surface — TokenUsageChart/CostMeter/ContextWindowBar

> **Version 1.0** — Synthesizes the deep research over `gemini-cli` (ContextUsageDisplay/
> Footer/ProgressBar/quota+stats displays), `bubbles/progress` (THE terminal fill-gauge
> precedent), `codex` (token_usage.rs context-window math + status card formatting),
> `ink-ui` (ProgressBar Ink peer) and `assistant-ui/react-ink` (statusBar family) into
> the locked M5 decisions: ONE shared pure fill-bar core (`renderFillBar` +
> `formatPercent` as the single rounding authority — the D2 hypothesis CONFIRMED),
> data-props input contracts (`{usedTokens, limitTokens?}` — never `{model}`), a
> hand-rolled deterministic k/M formatter, an endpoint-honest percentage contract
> (never "100%" until truly full — more honest than every analog), zero new
> dependencies, and a light with/without-metrics delta bench. All 6 research questions
> answered; 0 blocked.

**Slug:** `m5-metrics-surface`
**Source plan:** `.claude/knowledge-base/discoveries/plans/m5-metrics-surface-plan.md`
**Owner:** paulohenriquevn + Claude (assisted)
**Generated:** 2026-07-07 via `/discover-execute`
**Confidence verdict:** SHIPPABLE (99.7/100 — 2026-07-07, zero caps)

## Context

Inherited from the discovery plan: `ROADMAP.md § M5` — Metrics surface: `TokenUsageChart`
(ASCII bars), `CostMeter`, `ContextWindowBar` (fill gauge); numbers formatted (k/M);
degrade in NO_COLOR; adapt to width; snapshots empty/partial/full + narrow. Risks:
(1) meaningful ASCII charts at small widths; (2) overclaiming precision in a text gauge.

## Objective

Enable `/to-plan` to write the M5 plan with zero unresolved design questions.

---

## Coverage Corner 1 — Integration Tests

*(Answers Q4.)*

- **Exact-percentage string oracles, never recomputed:** gemini pins `'50% used'` /
  `'0%'` / `'80%'` / `'100% used'` with a mocked round denominator (`tokenLimit: () =>
  10000`) —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ContextUsageDisplay.test.tsx:11-18,30,43,71,84`.
- **Hybrid exact-string + snapshot (never snapshot-only):** key values anchored with
  `toContain` FIRST, then `toMatchSnapshot()` for layout —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ModelQuotaDisplay.test.tsx:41-45`,
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.test.tsx:279-280`;
  every one of StatsDisplay's ~16 snapshots is preceded by anchors
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/StatsDisplay.test.tsx:124-131,429-432`).
  Adopted as a HARD convention for M5 — a snapshot update can never silently absorb a
  wrong percentage.
- **Width matrix, boundary-pair style + negative-space:** gemini tests 79 vs 80 (the
  narrow/wide breakpoint) and asserts what must DISAPPEAR
  (`not.toContain('context used')`) —
  `Footer.test.tsx:163-186,324-340`, `ContextUsageDisplay.test.tsx:47-60`. Our M4 idiom
  is stronger for the mechanical half: loop widths `[60, 30, 20]`, assert every
  stripAnsi'd row `length <= width` (`src/diff-viewer.test.tsx:265-289`); M5 adds the
  gemini boundary pair at the widget's own degrade breakpoint.
- **k/M formatter tested through the component:** parametrized `renderWithTokens(n)` +
  `toContain('1.5k tokens')`/`'1.5m'`/`'1.5b'`/`'500 tokens'` —
  `Footer.test.tsx:564-630`. We test the formatter BOTH as a pure exported symbol
  (TDD tables — the D3 contract) and one pass-through per component.
- **Fill-count oracles at pinned widths (bubbles idiom, vitest form):** bubbles pins the
  bar string via golden files over a `{width, percent, options}` table —
  `.claude/knowledge-base/references/bubbles/progress/progress_test.go:11-94`; its
  goldens are literally 5×`█` + 5×`░` at 50%/width 10 (fill-count byte-pinned). Port:
  render at `width={10}`, stripAnsi, count fill glyphs literally — 0% → zero, 100% →
  all, EC-1 edges 0.4%/99.6% → bar/label agreement per ADR D3.
- **Empty-state explicitness:** gemini renders `''` for empty buckets and the harness
  throws on empty frames unless opted in —
  `ModelQuotaDisplay.test.tsx:50-57`,
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/test-utils/render.tsx:200-206`.
  Ours: assert `renderFrame(...) === ""` explicitly (our helper coerces undefined).
- **NO_COLOR probe (idiom absent in BOTH analogs — verified gap we fill):** no `NO_COLOR`
  test exists in gemini's four gauge test files nor `progress_test.go`. Extend
  `tests/fixtures/no-color-probe.tsx` with an M5 scene (partial ContextWindowBar +
  2-bar TokenUsageChart + CostMeter) + line-anchored asserts in the existing subprocess
  test (`src/chat-message.test.tsx:127-178` pattern): filled vs empty MUST be distinct
  GLYPHS, never color-only (EC-5). ONE subprocess spawn stays one (fold into the
  existing probe).
- **Flakiness notes:** no time display in M5 scope (else `vi.stubEnv('TZ','UTC')` + fake
  timers per `ModelQuotaDisplay.test.tsx:12-23`); widgets are static — the
  `tests/helpers.tsx` 0ms-tick spinner contract is not a hazard; keep the explicit 20s
  timeout on subprocess spawns.

---

## Coverage Corner 2 — Dependencies

*(Answers Q5.)*

- **Zero new dependencies — unanimous precedent.** No analog pulls a chart/sparkline/
  gauge/format library for these widgets:
  `gemini-cli/packages/cli/package.json` — none (full dep list inspected;
  `ink-gradient`/`tinygradient` are spinner/theme color libs, not chart/format);
  `assistant-ui/packages/react-ink/package.json` — none (`toLocaleString`);
  `.claude/knowledge-base/references/bubbles/go.mod` — progress is pure `fmt.Sprintf`
  (`go-humanize` present but used only by filepicker, never the gauge);
  `ink-ui` — `figures` only, bar is `character.repeat(Math.round(...))`
  (`.claude/knowledge-base/references/ink-ui/source/components/progress-bar/progress-bar.tsx:30-32`).
- **The one exception proves the rule:** codex pulls `icu_decimal`/`sys-locale`
  (`.claude/knowledge-base/references/codex/codex-rs/protocol/Cargo.toml:27-38`) ONLY
  because Rust lacks a stdlib `Intl`; the k/M logic itself is ~40 lines of hand-rolled
  math (`.claude/knowledge-base/references/codex/codex-rs/tui/src/status/helpers.rs:111-150`).
- **`Intl.NumberFormat({notation:'compact'})` evaluated and REJECTED for M5** (ADR D3):
  gemini ships it (`Footer.tsx:444-448`, pinned `'en-US'`, lowercased) but output
  depends on Node's embedded ICU/CLDR version (small-icu builds have en-US only;
  boundary behavior like `1049→"1k"` vs `1050→"1.1k"` is CLDR-defined, not ours) and
  caps at 2 significant figures. A hand-rolled ~30-line formatter gives 100%
  deterministic pinned oracles across Node versions, exact TDD-table ownership, zero
  deps. gemini's own 20+ bare `toLocaleString()` sites are host-locale-dependent — a
  snapshot-determinism bug pattern we avoid entirely.
- **YAGNI list (verified not needed):** chart/sparkline lib; numeral/pretty-bytes/
  humanize; locale plumbing (pin en-US semantics by construction); `Intl` currency mode
  (`$` prefix + 2 decimals is the whole surface); `B`/`T` as designed surface (free
  fall-through only); pricing/model catalogs; animated gauges (bubbles' spring
  animation); time-series history.

---

## Coverage Corner 3 — Tools

*(Answers Q6.)*

- **A bench IS meaningful — one light bench, honestly framed.** The widgets are static
  string-math (a `formatTokens()` micro-bench would be theatre), but the deployment
  shape is hot: gemini's Footer is the always-mounted metrics row subscribing to the
  whole UIState context, its token figure fed per-turn from
  `uiState.sessionStats.lastPromptTokenCount`
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.tsx:179-180,220`)
  — so the metrics row re-renders throughout a streaming turn. The falsifiable claim
  the M5 README implicitly makes ("negligible overhead") needs data.
- **`benchmarks/metrics-footer.bench.tsx`:** mount = M1 `ChatThread` (~50 messages) + a
  footer Box with `ContextWindowBar` + `TokenUsageChart` (2-3 bars) + `CostMeter` under
  `TheoTUIProvider`; loop = 150 streaming ticks, each appending to the tail assistant
  message AND incrementing `usedTokens`/cost props, then `rerender` + `tick()` +
  `sampler.sample()` — identical loop skeleton to `benchmarks/agent-timeline.bench.tsx`.
- **Modes: `with-metrics` vs `without-metrics`** (same thread loop, footer omitted) —
  the DELTA between modes IS the widget cost; a single-mode number would have nothing
  to compare against (mirrors the M3 bounded|unbounded matrix).
- **Protocol unchanged:** reuse `benchmarks/sampling.ts` wholesale — frameSampler
  per-frame wall-time, EC-2 zero-frame throw, 1 warmup + 5 measured runs per mode,
  population std dev, EC-15 memoization-swallow guard per run (critical: if M5 widgets
  are memo'd and props DO change per tick, a frozen-props bug would silently zero the
  workload), `--smoke` mode, baseline `docs/benchmarks/m5-metrics-baseline.json` with
  the verbatim "<1σ deltas are INCONCLUSIVE" clause (schema gate:
  `tests/bench-baseline.test.ts` requires `measured_runs >= 3`).
- **The honest claim (and nothing more):** "mounting the M5 metrics surface under a
  streaming M1 thread adds ≤ X ms (± σ) per frame vs the bare thread". Expected
  outcome: delta within noise — that null result IS the evidence for the "lightest
  milestone" positioning; a non-null delta means the bench caught a layout/memo bug
  before release. Either branch pays for the work.
- **Deliberately NOT benched:** formatter micro-throughput (decided by TDD tables, not
  timers); width-adaptation cost (one-shot layout); "N bars" scaling (per-category
  chart — single-digit bars by design, no N to scale).

---

## Coverage Corner 4 — Techniques

*(Answers Q1, Q2, Q3.)*

### Q1 — Usage semantics + input contracts

- **Inputs per analog:** gemini `ContextUsageDisplay` takes `{promptTokenCount, model,
  terminalWidth}` and resolves the limit ITSELF via a model→limit registry
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ContextUsageDisplay.tsx:16-24`,
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/contextUsage.ts:9-22`,
  `.claude/knowledge-base/references/gemini-cli/packages/core/src/core/tokenLimits.ts:21-40`)
  — a coupling a provider-agnostic library cannot own; codex models
  `TokenUsage{input_tokens, cached_input_tokens, output_tokens,
  reasoning_output_tokens, total_tokens}` + `model_context_window: Option<i64>`
  (`.claude/knowledge-base/references/codex/codex-rs/tui/src/token_usage.rs:11-18,57-61`)
  — window-unknown is a REAL state, the status card omits the context line
  (`.claude/knowledge-base/references/codex/codex-rs/tui/src/status/card.rs:327-335`);
  react-ink `StatusBarTokenCount` is absolute-only, `format?` prop, `null` at 0
  (`.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/statusBar/StatusBarTokenCount.tsx:5-31`).
- **Display conventions:** gemini `"{N}% used"` (abbreviating to `"{N}%"` when narrow —
  `ContextUsageDisplay.tsx:27,40-47`); codex `"{N}% left ({used} used / {window})"`
  (`card.rs:394-408`) — strictly more information; codex offers BOTH conventions as
  separate configurable status items
  (`.claude/knowledge-base/references/codex/codex-rs/tui/src/chatwidget/status_surfaces.rs:696-701`).
- **Thresholds (gemini):** warn at `percentage >= 0.5` (compressionThreshold default —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/constants.ts:57`),
  error at `>= 1.0` (`ContextUsageDisplay.tsx:33-38`).
- **EC-2 over-limit:** codex clamps twice (`.max(0)` + `.clamp(0.0, 100.0)` —
  `token_usage.rs:48-52`; consumers re-clamp
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/chatwidget/status_controls.rs:367-377`);
  gemini does NOT clamp — `promptTokenCount` beyond the limit renders `"120% used"`
  (live behavior, no over-limit test exists — verified absence,
  `ContextUsageDisplay.test.tsx:75-84` caps at exactly-100%). codex's missing-window
  status-line fallback `Some(100)` ("100% left" when the window is simply unknown —
  `status_controls.rs:357-360`) is the fabrication anti-pattern our contract rejects.
- **Baseline quirk:** codex subtracts `BASELINE_TOKENS = 12000` from window AND used
  (`token_usage.rs:9,43-53`) — fresh sessions read "100% left"; gemini does no baseline
  subtraction. Identical inputs → different percentages across ecosystems; exposing
  `baselineTokens` (default 0) makes the divergence explicit.
- **Div-by-zero guards:** gemini returns 0 for `limit <= 0` (`contextUsage.ts:13-19`);
  codex returns 0 when `context_window <= BASELINE_TOKENS` (`token_usage.rs:44-46`).
- **Last-turn vs session-total:** codex distinguishes `last_token_usage` (current
  context) from `total_token_usage` (session accumulation) (`token_usage.rs:37-41,57-61`);
  gemini's footer figure is the LAST turn's prompt count (`Footer.tsx:220`). Props must
  not conflate the two.
- **TokenUsageChart category evidence:** codex tracks input/cached/output/reasoning
  (`token_usage.rs:12-17`); gemini's `ModelMetrics.tokens` tracks
  input/prompt/candidates/total/cached/thoughts/tool
  (`.claude/knowledge-base/references/gemini-cli/packages/core/src/telemetry/uiTelemetry.ts:43-51`)
  rendered as stats-table rows Total/Input/Cache Reads/Thoughts
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ModelStatsDisplay.tsx:154-200`).
  Canonical v0 set `input | output | cached | reasoning` maps onto both; gemini-only
  `tool` waits for a consumer (YAGNI).

### Q2 — Bar math (glyphs, rounding, width, states)

- **Glyphs:** bubbles `'▌'`(default)/`'█'`(alt) vs `'░'`
  (`.claude/knowledge-base/references/bubbles/progress/progress.go:37,42,46`); ink-ui
  `'█'`/`'░'` via figures (both in figures' `common` set — identical on non-unicode
  fallback terminals;
  `.claude/knowledge-base/references/ink-ui/source/components/progress-bar/theme.ts:21,24`);
  gemini `'▬'`/`'▬'` COLOR-ONLY — the fill boundary is invisible on monochrome
  terminals
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ProgressBar.tsx:35-36`).
  2 of 3 (incl. canonical bubbles) glyph-distinguish → EC-5 verdict: default `'█'`/`'░'`.
- **Fill-count rounding:** bubbles `math.Round(tw * percent)` + clamp
  (`progress.go:361-363`); ink-ui `Math.round` (`progress-bar.tsx:31`); gemini
  `Math.ceil` — any nonzero shows ≥ 1 filled cell (`ProgressBar.tsx:23`). All three
  clamp input to [0,1]/[0,100] (`progress.go:305,427`; `ProgressBar.tsx:22`;
  `progress-bar.tsx:30`).
- **EC-1 (label/bar agreement):** bubbles' label (`" %3.0f%%"`, `progress.go:241`) and
  fill round at DIFFERENT granularities with no shared helper — mid-range visual-full
  vs "99%" splits are possible (e.g. percent 0.986 at tw 35); gemini DELIBERATELY
  splits at the bottom edge (label `toFixed(0)` round vs fill ceil: 0.4% → label "0%"
  + 1 filled cell). No analog reconciles structurally → our shared-core-with-single-
  rounding-authority is the fix by construction (ADR D1/D3).
- **EC-4 (width floor):** NO analog enforces a minimum — all clamp-to-zero and degrade
  silently (bubbles `tw = max(0, width − labelWidth)` `progress.go:359`; gemini caller
  floors at 0, `ModelQuotaDisplay.tsx:63-74`; ink-ui renders nothing until flexbox
  gives space, `progress-bar.tsx:38-48`). SOTA norm: degrade, never throw. gemini's
  label-abbreviation move (`'% used'` → `'%'` below a width threshold,
  `ContextUsageDisplay.tsx:41-43`) is the precedent for label-only degrade.
- **Color/threshold policy:** gemini puts thresholds INSIDE the bar (`ProgressBar.tsx:26-31`)
  AND duplicates them in the caller for the label
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ModelQuotaDisplay.tsx:76-81`)
  — a duplication smell; bubbles keeps color fully caller-side (`ColorFunc`,
  `progress.go:108-130`). Follow bubbles: core is color-agnostic; each caller owns its
  threshold mapping against theme tokens.
- **Sibling evidence:** gemini `StatsDisplay` renders TABLES, not bars
  (`StatsDisplay.tsx:139-228`); `MemoryUsageDisplay` is text-only with a single red
  threshold
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MemoryUsageDisplay.tsx:27-31`).
  Not every metric needs a bar — TokenUsageChart rows pair label + bar; totals can be
  plain text.

### Q3 — Formatting contract (the D3 TDD source)

- **k/M abbreviation per analog:** gemini Footer = `Intl` compact en-US, maxFrac 1,
  lowercased (`1500→"1.5k"`, `999999→"1m"`, trailing `.0` dropped —
  `Footer.tsx:444-448`, oracles `Footer.test.tsx:610-628`); codex
  `format_tokens_compact` = hand-rolled `K/M/B/T`, 2-3 sig figs, zero-strip, with a
  traced boundary anomaly (`999_999→"1000K"` — decimals=0 rounds up without unit
  promotion, `helpers.rs:111-150`); codex `format_si_suffix` promotes at the boundary
  (`999_500→"1.00M"`,
  `.claude/knowledge-base/references/codex/codex-rs/protocol/src/num_format.rs:35-76,84-104`)
  but has NO usage site outside its own module (verified); detail views everywhere use
  full separators (`toLocaleString` — `StatsDisplay.tsx:106-108`; icu
  `format_with_separators` — `num_format.rs:27-29`).
- **Two-tier convention is universal:** abbreviated k/M in the always-on footer/meter;
  exact separators in detail/stats views.
- **Percentage rounding:** ALL analogs round to integer with NO endpoint protection —
  gemini `toFixed(0)` shows "100% used" at 99.5% in non-error color
  (`ContextUsageDisplay.tsx:27,34-42`); codex `.round()` clamped
  (`token_usage.rs:43-53`); bubbles `%3.0f` (`progress.go:208,241`). Zero "approx"
  markers anywhere (grep-verified). **A gap to improve on, not a precedent to copy**
  (roadmap risk 2) — ADR D3 locks endpoint honesty.
- **Cost display: VERIFIED ABSENCE in every analog.** codex has no monetary display
  (credits are rounded whole integers —
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/status/rate_limits.rs:382-410`);
  gemini's closest is a unitless credit count; react-ink's statusBar family has no cost
  primitive. CostMeter's contract is OUR design, governed by D3 honesty rules —
  fallback recorded as internal precedent (EC-2 clause of the discovery plan).

## Cross-cutting Comparison

| Dimension | gemini-cli | codex | bubbles | ink-ui | react-ink |
|---|---|---|---|---|---|
| Gauge input | `{promptTokenCount, model}` (registry-coupled) | `used + Option<window>` | `percent` | `progress` 0-100 | absolute only |
| Convention | "% used" | "% left (used / window)" | bare % | none | "N tokens" |
| Over-limit | NOT clamped ("120% used") | clamped twice | clamped | clamped | n/a |
| Fill glyphs | `▬`/`▬` color-only | n/a (text) | `▌`/`░` | `█`/`░` | n/a |
| Fill rounding | ceil | n/a | round | round | n/a |
| Label/bar authority | split (round vs ceil) | n/a | two granularities, unreconciled | no label | n/a |
| k/M formatter | Intl compact en-US lowercase | hand-rolled K/M/B/T | n/a | n/a | none |
| Cost display | none | none | n/a | n/a | none |
| New deps for widgets | none | icu (Rust-only gap) | none | figures only | none |

## ADRs

### D1 — ONE shared pure fill-bar core: `renderFillBar` + `formatPercent` (D2 hypothesis CONFIRMED)

**Decision:** A single pure, color-free, Ink-free module (`src/fill-bar.ts`) serves all
three components:

```ts
renderFillBar(ratio, width, opts?: { fullChar?, emptyChar?, rounding? })
  → { filled, empty, filledCells, width }   // segments, not a joined string
formatPercent(ratio) → "0%" | "42%" | "99%" | "100%"  // THE single rounding authority
```

Defaults: `fullChar '█'`, `emptyChar '░'` (EC-5 — glyph-distinct), `rounding 'round'`
(bubbles/ink-ui majority; `'ceil'` opts into gemini's nonzero-visibility semantics).
Ratio clamped to [0,1]; `width < 0` clamps to 0 (EC-4 — degrade, never throw). Returns
SEGMENTS so each caller styles filled vs empty independently — color/threshold policy
stays caller-side (bubbles `ColorFunc` model), never in the core.

**Rationale:** gemini factored one `<ProgressBar>` consumed by its quota rows; ink-ui's
entire offering is one primitive themed externally; bubbles serves every Bubble Tea app
with one `progress.Model`. The knowledge encoded — clamp, fill rounding, glyph repeat —
is ONE business rule (DRY); three hand-rolled bars would triple the width edge cases
(roadmap risk 1) and re-open the EC-1 split three times.

**Alternatives considered:** per-component bar math (rejected: zero analog evidence;
triplicates the EC-1 bug class); threshold colors inside the core (rejected: gemini's
in-bar thresholds get DUPLICATED in callers — smell; bubbles keeps color caller-side);
bubbles' half-block fg/bg gradient blending (rejected v1: per-cell styling machinery
that only pays off with gradients — YAGNI).

**Consequences:** label and bar can never disagree — both consume the same clamped
display percent (see D3 endpoint rule); the core is unit-testable in milliseconds with
exact fill-count tables.

### D2 — Input contracts: data props, never model registries; unknown limit renders absolute-only

**Decision:**

```ts
ContextWindowBar({ usedTokens, limitTokens?, convention? /* 'left'|'used', default 'left' */,
                   baselineTokens? /* default 0 */, width?, ... })
TokenUsageChart({ usage: Partial<Record<'input'|'output'|'cached'|'reasoning', number>>,
                  total? /* derived as sum when omitted */, ... })
CostMeter({ costUsd, ... })   // caller-computed number — M5 renders, M7 computes
```

`limitTokens === undefined` → absolute-only render (`"12.5k tokens"`), NEVER a
fabricated percentage. `limitTokens <= 0` or negative/NaN/∞ inputs → typed
`TypeError` at the boundary (fail-fast, before hooks — F10 idiom). Over-limit
(`used > limit`): bar clamps to [0,100] (codex precedent) + explicit over-limit
signal (label keeps the honest number per D3; threshold coloring marks the state).
Default convention `'left'` with the dim absolute detail clause
(`"{N}% left ({used} used / {window})"` — codex, strictly more informative);
`'used'` offered since codex proves both are demanded.

**Rationale:** gemini's `{model}` prop couples the component to a model→limit registry
a provider-agnostic library cannot own; codex's `used + Option<window>` is the right
shape. codex's `Some(100)` unknown-window fallback ("100% left" when nothing is known)
is the documented fabrication anti-pattern — omission over fabrication. Category set is
the intersection+union of what codex and gemini actually track.

**Alternatives considered:** `{model}` prop with a built-in registry (rejected:
registry churn is provider business — M7 adapters); percentage-only prop (rejected:
loses the absolute detail + forces callers to duplicate clamp math); gemini-only
`tool` category now (rejected: YAGNI — no consumer).

**Consequences:** M7 adapters map provider payloads onto these props; last-turn vs
session-total distinction stays caller-side and documented (codex separates the two).

### D3 — Formatting contract: hand-rolled deterministic formatters + endpoint-honest percentages + honest cost

**Decision:** Module `src/format.ts` (pure):

1. **`formatTokens(n)`** — hand-rolled (~30 lines, codex shape with the boundary
   anomaly FIXED): `< 1000` → exact digits; otherwise scale to `k`/`m` (lowercase —
   gemini convention), round HALF-UP to 1 decimal, strip trailing `.0`, and PROMOTE the
   unit when the rounded scaled value reaches 1000 (`999_949→"999.9k"`,
   `999_950→"1m"` — never codex's `"1000K"`). `b` falls through free (values ≥ 1e9),
   not a designed surface. Pinned TDD table: `0→"0"`, `999→"999"`, `1000→"1k"`,
   `1049→"1k"`, `1050→"1.1k"`, `9999→"10k"`, `999_949→"999.9k"`, `999_950→"1m"`,
   `1_050_000→"1.1m"`. Negative/NaN/∞ → typed error.
2. **`formatPercent(ratio)` — endpoint-honest:** clamp ratio [0,1]; `Math.round(ratio*100)`;
   then `100` is reserved for `ratio >= 1` (else 99) and `0` for `ratio <= 0` (else 1).
   99.6% renders `"99%"`, 0.4% renders `"1%"` — never "100% used" while room remains
   (gemini's live overclaim) nor "0%" while tokens exist. `renderFillBar` consumes the
   SAME clamped display percent with the same endpoint rule (full cells only at
   ratio ≥ 1, ≥ 1 cell for nonzero ratio when width ≥ 2) — EC-1 agreement by
   construction, at every width.
3. **`formatCost(costUsd)`** — `$X.XX` (2 decimals half-up), hand-rolled thousands
   separators above $999 (`$1,234.56`); sub-cent honesty: `0 < cost < 0.005` →
   `"<$0.01"`, never `"$0.00"`; exactly 0 → `"$0.00"`; estimate marker `~` prefix ON
   by default (`~$1.23` — the number derives from token counts × price sheets) with an
   explicit opt-out prop; negative/NaN/∞ → typed error.
4. **Two-tier convention:** abbreviated k/M in meters; exact `1,234,567` separators
   reserved for future detail/stats views (not an M5 surface).

**Rationale:** All analogs round percentages to integer with zero endpoint protection
and zero approx markers (grep-verified) — the field overclaims; roadmap risk 2 names
this. `Intl` compact rejected (Corner 2): CLDR-version-dependent oracles vs our
hand-rolled table ownership. Cost display has NO analog precedent (verified absence) —
contract is internal design under the honesty rule, recorded as internal precedent.

**Alternatives considered:** `Intl.NumberFormat` compact (rejected: ICU/CLDR
determinism + 2-sig-fig cap); copying gemini's plain `toFixed(0)` (rejected: ships the
overclaim); floor-used/ceil-remaining asymmetric rounding (considered; rejected for the
simpler symmetric endpoint-reserve rule — same honesty, one rule for both conventions);
`$0.00` for sub-cent (rejected: a rendered lie).

**Consequences:** Every formatter row above becomes a pinned TDD oracle; snapshots can
never absorb drift (no locale/ICU variance by construction).

### D4 — Component anatomy: label + bar composition, width adaptation, thresholds

**Decision:** Each component renders `[label][bar][detail]` on one line (chart = one
line per category, aligned): bar segments from D1 wrapped in two `<Text>` runs; width
via explicit `width` prop with a sane default (bubbles' 40-cell default precedent),
bar width = what remains after fixed label/detail columns (gemini caller math,
`flexShrink={0}` on labels — our M2/M4 gutter idiom); below a minimum bar width
(< 3 cells after label subtraction) → drop the bar, keep the compact numeric label
(gemini's `'% used'`→`'%'` degrade generalized to label-only — EC-4); clamp-to-zero,
never throw. Threshold coloring caller-side per component: ContextWindowBar warn ≥ 0.5
/ error ≥ 1.0 (gemini defaults) via theme `status.warning`/`status.error`;
TokenUsageChart bars neutral (`theme` accent); CostMeter plain text (no thresholds —
no budget semantics at M5, YAGNI).

**Rationale:** Composition mirrors gemini ProgressBar + quota-row shape and ink-ui's
two-Text-runs structure with the EC-5 glyph fix; NO_COLOR readability needs zero
branches (glyph-distinct fill + label carry the meaning — same mechanism as M4's sign
column).

**Alternatives considered:** ink-ui's self-measuring `measureElement` flexGrow bar
(rejected v1: measurement machinery + our width-prop convention already established in
M1-M4; additive later); in-bar percentage à la bubbles (rejected: label outside the
bar keeps the core pure and matches gemini/ink-ui).

**Consequences:** Width matrix tests get a mechanical invariant + a boundary pair at
the degrade breakpoint; M6 theming inherits clean color seams (all colors via theme
tokens, no hardcoded palettes).

### D5 — Test strategy per Corner 1

**Decision:** (1) formatter TDD tables as pure-symbol tests (every D3 row) + one
pass-through test per component; (2) fill-count oracles at width 10 over the EC-1 edge
table (0%, 0.4%, 50%, 99.6%, 100%) counting glyphs literally on stripAnsi'd frames;
(3) hybrid anchor-then-snapshot for empty/partial/full + narrow states (HARD
convention: no snapshot without a preceding exact-string anchor); (4) width matrix
`[60, 30, 20]` mechanical invariant + boundary pair at the label-only breakpoint with
negative-space asserts (what must disappear); (5) NO_COLOR probe scene extension (one
subprocess spawn stays one) asserting glyph-distinct fill; (6) negatives: typed errors
for NaN/∞/negative inputs, `limitTokens <= 0`, invalid width; unknown-limit
absolute-only render; over-limit clamped bar + honest label; empty-usage chart →
explicit `""` assertion.

**Rationale:** Corner 1 evidence + our kit's stronger mechanical width idiom; the
NO_COLOR gap is ours to fill (absent in both analogs).

**Alternatives considered:** golden files à la bubbles (rejected: vitest inline
oracles + our snapshot harness already pin bytes); snapshot-only suites (rejected:
gemini's anchor-first discipline exists precisely because snapshots absorb drift).

**Consequences:** Rounding regressions fail with readable diffs, not snapshot churn.

### D6 — Bench per Corner 3: with/without-metrics delta under a streaming thread

**Decision:** `benchmarks/metrics-footer.bench.tsx` exactly as Corner 3 specifies —
M1 thread + metrics footer, 150 ticks appending tokens AND incrementing usedTokens/
cost, modes `with-metrics` | `without-metrics`, full M2-M4 protocol (sampling.ts,
1+5 runs, EC-15 guard per run, --smoke, baseline JSON with the INCONCLUSIVE clause),
headline = the mode delta on mean/peak ms_per_frame. Final-Phase full `pnpm bench`
refresh on a quiet machine also supersedes the contention-noted m4 baseline (recorded
review disposition).

**Rationale:** The only falsifiable performance claim M5 makes is "negligible overhead
in the streaming hot path" — measure it; micro-benching formatters is theatre.

**Alternatives considered:** no bench (rejected: cycle owner requires data over
adjectives; the always-on footer IS a hot path); N-bars scaling sweep (rejected: no N
to scale by design).

**Consequences:** Real numbers for the M5 DoD; a non-null delta becomes a caught bug,
not a shipped surprise.

## Recommendations for the project

| # | Recommendation | Linked to | Priority |
|---|---|---|---|
| 1 | `src/fill-bar.ts` pure core (renderFillBar + formatPercent single authority) | Q2, D1, D3 | HIGH |
| 2 | `src/format.ts` (formatTokens k/M + formatCost) with pinned TDD tables | Q3, D3 | HIGH |
| 3 | `ContextWindowBar` (data props, % left default, unknown-limit absolute-only, over-limit clamp) | Q1, D2, D4 | HIGH |
| 4 | `TokenUsageChart` (input/output/cached/reasoning category bars) | Q1, D2, D4 | HIGH |
| 5 | `CostMeter` (~$X.XX, <$0.01 honesty, typed-error boundary) | Q3, D2, D3 | HIGH |
| 6 | Test kit per D5 (incl. the NO_COLOR gauge probe both analogs lack) | Q4, D5 | HIGH |
| 7 | `benchmarks/metrics-footer.bench.tsx` + baseline + M5 full bench refresh | Q6, D6 | HIGH |
| 8 | Defer: gradient/half-block blending, self-measuring width, `tool` category, budget thresholds on CostMeter, detail/stats views | D1-D4 YAGNI | LOW |

## Blocked questions (if any)

(none — all 6 answered)

## Halt-loop progress (audit trail)

- Iterations used: 1 (inline — 4 parallel research agents + synthesis; Stop hook active)
- Questions answered: 6/6 · blocked: 0
- EC-1..EC-5 all answered with evidence (EC-1 rounding-split trap documented in two
  analogs; EC-2 clamp-vs-overflow table; EC-3 exact boundary table with 4 recorded
  disagreements; EC-4 no-analog-enforces-floor verdict; EC-5 glyph-distinct 2-of-3)
- Honesty notes preserved: plan path correction (react-ink lives under
  `assistant-ui/packages/react-ink/` — no top-level `react-ink/` dir); codex
  `format_si_suffix` has zero usage sites (dead in its own repo); codex
  `format_tokens_compact` boundary anomaly (`999_999→"1000K"`) traced, not copied;
  bubbles label/fill rounding granularity mismatch documented
- Citations verified: pre-synthesis path-existence sweep (all reference paths resolve)

## Related

- Discovery plan: `.claude/knowledge-base/discoveries/plans/m5-metrics-surface-plan.md`
- Project rules linked: `.claude/rules/architecture.md`, `.claude/rules/testing.md`,
  `.claude/rules/error-handling.md`, `.claude/rules/parsimony-ladder.md`
