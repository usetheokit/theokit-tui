# Implementation: m7-stream-adapter

**Date:** 2026-07-07
**Plan:** `.claude/knowledge-base/plans/m7-stream-adapter-plan.md` (SHIPPABLE 97.6→98.8, zero caps)
**Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m7-stream-adapter-blueprint.md` (SHIPPABLE 100.0)
**Verdict:** IMPLEMENTATION_COMPLETE
**Validation gate:** `run_validation.py m7-stream-adapter` → exit 0 (8 PASS / 0 FAIL / 1 WARN advisory / 1 SKIP / 1 N/A)
**Code-quality:** PASS (audit `.claude/knowledge-base/audits/m7-stream-adapter-code-quality-2026-07-07.md`, 0 hard caps, typescript audited)

## Task ledger (all 6/6 committed, gates-gated)

| Task | Commit | Delivered |
|---|---|---|
| T1.1 union + guards | `ced0618` | `src/agent-stream-event.ts` — structural `AgentStreamEvent` (coarse SDKMessage + fine onDelta vocabularies under REAL names; `message` widened for the SDKStatusMessage string arm); `isShellEnvelope` (EC-12 string-when-present) + `extractAssistantText`; 6 tests |
| T1.2 reducer | `a4b33bb` | `src/agent-stream-reducer.ts` — pure fold onto the M3 `AgentEvent` timeline; 25-test fold table (later 28) incl. all 8 EC-absorbed rows + M3-boundary render oracle per scenario |
| T2.1 hook | `bffbaf9` | `src/use-agent-stream.ts` — cancelled-flag-after-every-await loop, `iterator.return` teardown, `__reset__` wrapper reducer (EC-4), `cancel()`; 10 tests (later 12), probe-component + timer-free fakes |
| T2.2 reconnect | `7fb0304` | `src/use-agent-stream.reconnect.test.tsx` — producer-side exactly-once resume + total-replay reset+refold; ZERO adapter changes (plan-predicted design proof) |
| T3.1 tripwire | `c462d79` | `tests/sdk-assignability.test.ts` — whole-union + per-member compile-time assignability vs the REAL `@theokit/sdk` + canonical runtime fold contract; devDep `^2.19.0` import-type-only; manifest pins; `pnpm audit` clean post-add |
| T3.2 wiring | `ae639f6` | entry exports (D8 trio + types), composed integration scene + 1 anchored snapshot, `examples/stream.tsx` (done-gated exit, EC-8) + subprocess smoke + `example:stream` script |
| Final-phase coverage | `b8ffa66` | +6 tests closing M7 modules to 100% lines (non-live map arms, no-exitCode envelope, double-cancel, post-teardown rejection, non-Error throw) |

## Wiring triad (per `rules/cycle-implement.md`)

- **(a) Caller:** `examples/stream.tsx` folds a scripted turn through the REAL
  `useAgentStream` → `AgentTimeline`/`AgentStreaming` (human-runnable:
  `pnpm example:stream`); the integration scene in
  `tests/public-api.integration.test.tsx` does the same via the package entry.
- **(b) Integration test:** `public_entry_composes_stream_adapter` +
  `composed_stream_scene_matches_snapshot` (composition-root imports only) +
  `tests/example-stream.integration.test.ts` subprocess smoke.
- **(c) Runtime evidence:** the smoke asserts the RENDERED runtime output
  (thinking row, ✓ tool, streamed final text, exit 0); the 6-bench regression
  re-run below guards the render path.

## Suite state

- 424/424 tests green (369 pre-M7 + 55 new); two consecutive `pnpm test` runs
  green with byte-identical snapshots; snapshot budget: **1 new**
  (`stream-adapter-scene`), zero existing snapshots changed.
- Coverage 99.71% lines all-files; M7 modules 100% lines
  (`agent-stream-event.ts` 100/100 branches; `agent-stream-reducer.ts` 100
  lines / 90.2 branches — residual arms are `??` defensive fallbacks behind
  guards; `use-agent-stream.ts` 100/100).
- `pnpm build` green; `grep -c "@theokit/sdk" dist/index.d.ts` → **0** (no sdk
  type leaks into the public surface).
- Subprocess spawn count suite-wide: 9 (budget ≤ 12).

## Deviations (logged, honest)

- **DV-1 — StrictMode double-invoked effects unavailable under ink's
  reconciler.** The plan's EC-6 rows assumed `<StrictMode>` double-invokes
  effects in tests. Probe-proven (in-session): ink's custom react-reconciler
  build does NOT enable strict effects — one `create` per mount; passive-effect
  cleanup flushes one tick AFTER `unmount()`. Resolution: the two StrictMode
  tests pin environment-robust invariants (single fold, clean terminal state,
  clean console under EITHER reconciler behavior), and the EC-6 mechanics
  (run-1 aborted invisibly mid-pending-next, run-2 self-sufficient after
  reset) are pinned DETERMINISTICALLY by `double_effect_run_aborts_invisibly`
  via rerender — the same destroy→create sequence StrictMode uses. No
  weakening: 12 hook tests vs the plan's 8+.
- **DV-2 — sdk devDep manifest range `^2.19.0` (plan wrote `^2.18.1`).**
  `pnpm add -D @theokit/sdk@^2.18.1` records the resolved latest (2.19.0) with
  caret. Same major, exactly the resolution the deps-audit predicted and
  blessed ("caret resolves to 2.19.0 — intended"); the tripwire checks against
  the newest 2.x by design. `pnpm audit` clean post-add (0 vulns).

## Bench regression evidence (Final Phase, ADVERSE-only rule)

**No-new-bench justification (plan D7):** M7 adds NO render path of its own —
the reducer is a pure fold (µs-scale, exercised 89× per suite run by the fold
tables) and the hook renders nothing; every frame M7 produces is drawn by the
M3 `AgentTimeline`/`AgentStreaming` components already covered by
`m3-agent-timeline` bench. A dedicated M7 bench would measure the fakes, not
the library. **Flip condition:** the day the adapter grows its own render path
(e.g., a built-in `<AgentStream>` component or adapter-side memoization), that
slice MUST land with its own bench.

**Methodology note (shared-machine contention + env fix):** suite-level
re-runs were polluted by unrelated multi-hundred-% CPU workloads (postgres
under another OS user; a sibling-project tsc) producing contradictory ADVERSE
readings in DIFFERENT benches per run — while isolated re-runs of the same
benches were clean. Per the established protocol (never weaken, wait for
quiet), each bench was re-run ISOLATED and LOAD-GATED (1-min loadavg < 4 at
start: 3.22/3.07/3.33/3.14/3.00/3.16). A FIRST isolated round accidentally ran
without `FORCE_COLOR=1` (the suite runner injects it; direct `tsx` invocation
did not) — the committed baseline contract tests caught it
(`color_env.FORCE_COLOR: "unset"`), and the round was DISCARDED as
incomparable (less ANSI = spuriously cheap frames). The table below is the
corrected round (`FORCE_COLOR=1 NO_COLOR= CI=`, matching `benchmarks/run.ts`),
compared against the last VALID M6 baselines (`e86d545~1`).

| bench | metric | M6 | M7 | delta | max σ | verdict |
|---|---|---|---|---|---|---|
| m0-chat-message | aggregate.mean_ms_per_frame | 15.117±0.696 | 11.311±1.210 | -3.806 | 1.210 | OK |
| m0-chat-message | aggregate.peak_ms_per_frame | 32.347±4.171 | 28.426±4.630 | -3.921 | 4.630 | OK |
| m1-chat-thread | plain.mean_ms_per_frame | 82.839±20.190 | 65.798±10.187 | -17.041 | 20.190 | OK |
| m1-chat-thread | plain.peak_ms_per_frame | 160.986±47.049 | 131.439±32.612 | -29.547 | 47.049 | OK |
| m1-chat-thread | windowed.mean_ms_per_frame | 2.015±0.090 | 1.590±0.020 | -0.425 | 0.090 | OK |
| m1-chat-thread | windowed.peak_ms_per_frame | 5.535±1.564 | 3.142±0.368 | -2.393 | 1.564 | OK |
| m2-tool-cards | aggregate.mean_ms_per_frame | 13.013±2.828 | 7.803±0.457 | -5.210 | 2.828 | OK |
| m2-tool-cards | aggregate.peak_ms_per_frame | 29.721±6.302 | 21.998±7.392 | -7.723 | 7.392 | OK |
| m3-agent-timeline | bounded.mean_ms_per_frame | 3.032±0.619 | 2.156±0.072 | -0.876 | 0.619 | OK |
| m3-agent-timeline | bounded.peak_ms_per_frame | 6.906±1.748 | 5.043±0.477 | -1.863 | 1.748 | OK |
| m3-agent-timeline | unbounded.mean_ms_per_frame | 5.545±0.264 | 3.861±0.190 | -1.684 | 0.264 | OK |
| m3-agent-timeline | unbounded.peak_ms_per_frame | 48.292±4.361 | 35.515±1.705 | -12.777 | 4.361 | OK |
| m4-diff-viewer | windowed.mean_ms_per_frame | 13.539±1.301 | 7.245±0.112 | -6.294 | 1.301 | OK |
| m4-diff-viewer | windowed.peak_ms_per_frame | 23.487±5.688 | 13.874±1.709 | -9.613 | 5.688 | OK |
| m4-diff-viewer | full.mean_ms_per_frame | 106.686±21.301 | 89.858±1.955 | -16.828 | 21.301 | OK |
| m4-diff-viewer | full.peak_ms_per_frame | 184.158±25.284 | 153.846±9.465 | -30.312 | 25.284 | OK |
| m5-metrics | with-metrics.mean_ms_per_frame | 3.391±0.292 | 2.518±0.142 | -0.873 | 0.292 | OK |
| m5-metrics | with-metrics.peak_ms_per_frame | 6.011±1.168 | 4.111±0.264 | -1.900 | 1.168 | OK |
| m5-metrics | without-metrics.mean_ms_per_frame | 2.612±0.084 | 2.170±0.122 | -0.442 | 0.122 | OK |
| m5-metrics | without-metrics.peak_ms_per_frame | 4.178±0.296 | 3.515±0.230 | -0.663 | 0.296 | OK |

**Result: 20/20 metrics OK — ZERO ADVERSE beyond 1σ** (all 20 deltas
favorable, consistent with the load-gated quiet windows vs the M6 run's
noisier machine). M7 touches none of the benched render paths.

## Follow-ups

- USER ACTION: GitHub Actions billing — CI re-run on HEAD pending (M4–M7
  releases queued); all 7 CI steps mirrored locally throughout.
- Plan archives to `knowledge-base/plans/completed/` after `/review`
  READY_TO_MERGE + release PR merge (plan Global DoD).
