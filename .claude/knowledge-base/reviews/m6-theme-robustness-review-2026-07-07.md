# Review: m6-theme-robustness

**Date:** 2026-07-07
**Reviewers (spawned agents):** 6 — architecture, tests, wiring, cross-validation, domain-frontend (TUI), domain-testing
**Findings:** 33 total pre-batch (BLOCKER: 0, HIGH: 0, MEDIUM: 4 dedup, LOW: ~13, INFO: ~16)
**Verdict:** **READY_TO_MERGE** (post-batch `a49f412`) — CI environment blocker still pending (see below)

## Environment blocker (HUMAN ACTION STILL REQUIRED — carried from M4/M5)

GitHub Actions remains billing-blocked since 2026-07-06. Interim evidence: all seven
ci.yml steps mirrored locally (format/lint/typecheck/test/coverage/build/bench-smoke —
ALL PASS, 369/369). **Fix the GitHub billing, then re-run the workflow on HEAD before
cutting the M4/M5/M6 releases.**

## MEDIUM findings (all FIXED in the review batch `a49f412`)

- **Cursor marker keyed on theme IDENTITY, not capability** (arch-2 ≡ dom-frontend-1 —
  empirically confirmed): `theme={{base:"no-color", override:{...}}}` renames to
  `"custom"`, the `name === "no-color"` branch dies, and the level-0-invisible-cursor
  defect D8 exists to fix RETURNS while every color slot is still empty. FIXED — new
  DATA-derived predicate `isMonochrome(theme)` (all color leaves empty; module export,
  entry-absent + pinned); the composer branches on it; regression tests pin the
  customized-no-color-base case in both the theme and composer suites. The
  `TheoTheme.name` JSDoc now warns against identity branching.
- **Pair-form `override` never shape-validated** (arch-1): `{base, override: null}`
  reached `Object.keys(null)` — the ENGINE's TypeError, breaking the EC-5 typed-error
  contract; `override: "light"` was silently accepted. FIXED — `assertPairForm`
  validates the override is a plain object; negatives pinned (null/string/array).
- **Light snapshot order-dependent on highlighter warm-up** (tests-1): the composite
  snapshot pins HIGHLIGHTED bytes but never awaited the loader — a filtered run would
  capture the plain frame (isolation flake). FIXED — `await ensureHighlighter()`
  before the render.
- **Bench framing "18/20 within 1σ" held only under an adverse-only reading**
  (dom-testing-1): two-sided, 5/20 rows exceed 1 max-σ — the large FAVORABLE swings
  (m4-full −2.6σ peak, m1-windowed −3.2σ mean) corroborate machine variance. FIXED —
  implementation log restated as the ADVERSE-only rule (no adverse delta > 2σ; the 2
  adverse WATCH rows sit on M6-untouched paths — git-diff-empty verified by three
  reviewers independently).

## LOW batch (applied)

Single-source `BUILTIN_THEME_NAMES` array + `unionMessage` error derivation (arch-4 —
the tool-call idiom; a new built-in is now a one-touch change); `NO_COLOR_CURSOR_MARKER`
const extracted (arch-3); stale "deferred to/arrives with the M6 theme system" contract
comments rewritten to the SETTLED decisions (arch-5 ×3 incl. tool-call F9); absence
pins for `resolveTheme`/`assertThemeProp`/`mergeToolStatus`/`isMonochrome` (wire-2);
`examples/themes.tsx` now consumes the PUBLIC `themes` map (wire-1); exactly-once
marker assert before the equality normalization (tests-3); no-color oracle audits
EVERY color leaf via the collector (tests-4); unknown-base-in-pair-form negative
(tests-5); 45s it-timeout on the two-spawn equality test (dom-testing-3); provider
JSDoc gains the hoist-your-override stability note (dom-frontend-5); spawn-count
arithmetic corrected to 11 with a logged deviation DV-1 (xval-1 ≡ tests-2).

## Dispositioned (documented, not code)

- **xval-2 (DoD-3 wording):** the snapshot matrix is satisfied per plan D6's
  EQUIVALENCE (named-ANSI-16 built-ins are level-independent — proven; the truecolor
  column is covered by argument + the downsample canary, not snapshots). The
  roadmap-runs file / release notes MUST state this explicitly when flipping M6.
- **dom-testing-4** (NO_COLOR probe spawned twice): caching across tests REJECTED —
  test independence wins (`testing.md § 3`); the 45s timeout covers the exposure.
- **dom-testing-2** (max-σ band self-widening on noisy re-runs): noted for the next
  bench-policy revision — gate against baseline σ or add a CV cap. M7 candidate.
- **dom-frontend-2** (light `warning: "yellow"` is the lowest-contrast slot on stock
  white palettes — gemini maps to "orange", which named-ANSI-16 lacks): defensible
  within D3's constraint; revisit only if D3 is ever relaxed to hex.
- **dom-frontend-3** (marker +1 column at exact-fit widths in monochrome text mode):
  cosmetic, documented in the CursorCell JSDoc.
- **dom-frontend-4** (no-color theme on a color TTY keeps bold/dim attributes): judged
  the RIGHT contract — gemini-identical; NO_COLOR targets color, attributes are the
  surviving legibility channel; piped/CI paths emit zero SGR (verified).
- **dom-testing-5 ≡ tests-9** (canary's pnpm-layout coupling): honest, documented
  in-test; repo is pnpm-locked; failure modes elsewhere are loud.
- **dom-testing-6** (bare-pipe scene byte-identical to dumb): coverage is real — it
  exercises the env-free non-TTY detection branch, a distinct code path.
- **wire-3** (probe fixture deep-imports vs entry): pre-existing M0-M5 pattern;
  entry coverage lives in public-api/example tests. Optional tidy.
- **arch-6** (glyphs repeated across the three built-in literals — derivable): D3
  chose frozen literals deliberately; the invariance test guards parity.
- **arch-7** (empty-string colors ride Ink's falsy-color behavior): works, covered by
  the matrix; normalization noted as polish.
- **tests-6/7/8, xval-3/4, dom-frontend-5/6/7**: recorded, no action (tests-7's
  optional inverse-byte anchor left as-is — matches the plan oracle verbatim).

## Cross-validation summary

Plan FROZEN verified; 7/7 tasks + Final Phase traceable to commits touching exactly
the planned files; Coverage Matrix 17/17; ROADMAP § M6 DoD 3/3 (DoD-3 per the
documented D6 equivalence — see disposition); per-task ZERO-snapshot-churn criteria
verified commit-by-commit (whole-range snap delta: 7 insertions, 0 deletions — exactly
the one budgeted light snapshot); implementation-log numbers independently reproduced
(364→369 tests post-batch, 99.76% coverage, ALL 20 bench rows recomputed from raw runs
— exact); the 10 edge-case absorptions spot-verified in code and oracles.

## Quality gates summary (post-batch)

- `pnpm gates` exit 0; **369/369 tests** green
- Coverage: 99.76% stmts/lines global; theme.tsx 100% lines/stmts/funcs
- `/code-quality`: PASS (typescript, 0 findings D1–D4)
- `run_validation`: exit 0 (0 FAIL; 1 LOW human-evidence WARN)
- Snapshot budget: 1 new / 0 changed (byte-identical migration held)
- Degrade matrix: 3 scenes green; dumb≡no-color byte-equal modulo ONE marker
  (positionally verified by the domain reviewer — 528 chars, 1 differing index);
  downsample canary green + GH-Actions-immune (source-cited + empirically verified)
- Bench: no adverse delta > 2σ; themed components' benches dead flat (token
  indirection unmeasurable, as D7 predicted)
- CI: **billing-blocked (see Environment blocker)** — all 7 steps green locally

## Spawned agents (audit trail)

Agent outputs consolidated in this report (subagent transcripts under the session task
store; finding IDs preserved: arch-1..7, tests-1..9, wire-1..3, xval-1..4,
dom-frontend-1..7, dom-testing-1..6).

## Handoff decision

**READY_TO_MERGE** — zero BLOCKER/HIGH; 4 MEDIUM fixed in-batch; LOW batch applied;
dispositions documented. Release gate: fix GitHub billing + green CI run on HEAD first
(M4 + M5 + M6 can release sequentially once CI is green). The M6 checkbox flip must
carry the xval-2 DoD-3 equivalence note in the roadmap-runs file.
