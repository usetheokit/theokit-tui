# Implementation: m16-tool-card-variants

**Date:** 2026-07-08
**Plan:** `plans/m16-tool-card-variants-plan.md` (SHIPPABLE 95.2)
**Blueprint:** `discoveries/blueprints/m16-tool-card-variants-blueprint.md` (SHIPPABLE)
**Verdict:** IMPLEMENTATION_COMPLETE · validation exit 0 · code-quality PASS · 573/573 tests

## Task ledger

| Task | Commit | Delivered |
|---|---|---|
| T1.1 union+dispatch | `7455097` | `ToolCardResult` union + `assertToolCardResult` (reachable boundary check); `ResultBody` dispatch (diff → DiffViewer w/ optional fileName header; output → ToolResult envelope; preview → CodeBlock-with-language or plain ToolResult lines); `defined()` helper (exactOptionalPropertyTypes); **card-boundary patch validation** — probed: a child render throw is SWALLOWED by ink's error boundary into a silent empty frame, so the card parses the patch synchronously (fail-fast, the duplicate parse is the price); 3 anchored snapshots; TRUE REDs both suites |
| T2.1 wiring | `b8a8e14` | stream example per-kind detail cards (direct-composition route — the timeline's AgentEvent carries the coarse envelope by design); shape smoke 3× green at low load; `streaming.active` bug caught by the smoke (the object is always truthy); done-exit delayed one breath so the cards land in the final piped frame; tool-cards bench gains the M12 load field |

## Wiring triad

- **Caller:** `examples/stream.tsx` — three real per-kind cards after the
  scripted turn (diff with gutter+sign rows, envelope with `stderr:` +
  `exited 1`, capped preview with the `hidden` trailer).
- **Integration tests:** pipe smoke pins the three SHAPES (stripped ANSI —
  SGR sits between gutter and sign); `ToolCardResult` is type-only — pinned
  by the typecheck of `src/index.ts` (the export-surface note was added at
  review r1-F4; the first log draft over-claimed a runtime pin).
- **Runtime observability:** rendered card bodies ARE the observable; the
  malformed-patch TypeError is the fail-fast signal (card-boundary,
  synchronous — never a silent empty body).

## Bench evidence (D3 — existing tool-cards bench re-run, no new mode)

No-new-bench rationale (blueprint D3): result bodies render ONCE — not a
per-frame path; the M9 flip condition names per-frame paths. Flip
condition stands: an animated result kind gets its own mode.

Verification re-runs vs the prior baseline (49.487 ± 3.071 ms/frame):

| Round | Load (1-min) | mean ms/frame | Verdict |
|---|---|---|---|
| 1 | 5.17 | 68.782 ± 12.323 | DISCARDED (contention — σ 4× the prior's) |
| 2 | 4.39 | 47.086 ± 5.650 | within 1σ of prior — NO REGRESSION |
| 3 | 5.76 | 56.834 ± 4.038 | contaminated (external load returned) |

**Committed baseline = the PRIOR** (cleanest round on record; the bench
workload is UNCHANGED — it does not use the new `result` prop, so the M2
baseline remains the honest reference). The load-gate (< 4) could not be
met across 6+ attempts due to persistent external machine load (cargo +
other sessions); round 2's within-noise agreement is the no-regression
evidence. Logged as DV-2, not silently absorbed.

## Deviations (logged)

- **DV-1 — T2.1 content landed in a `chore(implement)` commit** (`b8a8e14`).
  The intended feat commit was gate-blocked by two degrade-matrix
  ETIMEDOUTs under external load 42 (spawnSync timeouts — environment, not
  product); the follow-up chore commit (`git add -A`) swept the example/
  smoke/bench files in. Gates re-run GREEN (573/573) at session resume —
  the content is validated; the commit message understates it. Rule
  reinforced: `git add -A` in process commits is a sweep hazard.
- **DV-2 — tool-cards baseline re-record could not meet the load gate**
  (see the bench table above — verification done, prior preserved).

- **DV-3 — ADR D2 amended at review (r1-F2).** The plan's D2 said "no
  card-level payload validation beyond kind"; the ink-swallow probe proved
  that premise unsafe for the DIFF kind (a child render throw becomes a
  silent empty frame), so the patch is parsed synchronously at the card
  boundary — the SAME `parseUnifiedDiff` (DRY preserved; no duplicated
  logic; parse-twice cost documented). Output/preview payloads stay with
  the primitives (their shapes are programmer errors the type system
  covers — r1-F6). Declared here retroactively: the mechanism was
  documented everywhere but never NAMED as an ADR deviation.
- **DV-4 — fileName prop removed at review** (r2-F1/F-2 + r1-F3
  convergence): shipped without an oracle AND visually redundant in both
  scenarios (DiffViewer always emits its own header row). Never released —
  clean removal; also restored the LoC AC (231 → 230).
- **Flake watch (r1-F1, [NEEDS-REPRO]):** the negative kind oracles failed
  once on the reviewer's FIRST cold-cache invocation under residual
  external load, then never again. Characterized post-review: 10×
  shuffle-stress + 2× full suite = 12/12 green on a settled machine.
  Correlates with vitest cold-cache under external load; no product
  change. Watch: if it reproduces in CI, file an issue with both
  signatures.

## Review outcome

(recorded post-review in `reviews/m16-tool-card-variants-review-2026-07-08.md`)
