# Review: m1-chat-surface

**Date:** 2026-07-06
**Reviewers (spawned agents):** 6 — architecture, tests, wiring, cross-validation, domain-frontend (TUI), domain-testing
**Findings:** 47 total pre-batch (BLOCKER: 0, HIGH: 3 dedup, MEDIUM: 6 dedup, LOW: ~15, INFO: ~23)
**Verdict:** **READY_TO_MERGE** (post-batch `ae00ca0`)

## BLOCKER findings

(none)

## HIGH findings (all FIXED in the review batch)

### H-1 (wire-1 ≡ dom-testing-3 ≡ xval-1): Plan-declared composer integration scene missing
- T3.2 Files-to-edit listed a composer scene in `tests/public-api.integration.test.tsx`; only
  the thread scene shipped. **FIXED:** `public_entry_composes_composer_typing_and_submit` —
  ChatComposer via `src/index.js`, real stdin type + Enter submit.

### H-2 (dom-testing-1 ≡ wire-2 ≡ xval-2): Committed baseline contradicted its own methodology
- `color_env.FORCE_COLOR: "unset"` (bench invoked directly, bypassing `run.ts`'s pin) while the
  methodology claimed the pin. **FIXED:** both baselines regenerated via `pnpm bench`
  (`FORCE_COLOR: "1"` recorded); M1 schema oracle now asserts `color_env.FORCE_COLOR === "1"` +
  full M0-parity assertions (protocol cross-check, peak finiteness/recompute, hardware) — a
  bypassed runner can never go green again. Fresh pinned data: windowed **2.546 ± 0.507 ms/frame**
  vs plain **78.401 ± 8.04 ms/frame** (~31×; conclusion unchanged).

### H-3 (tests-1): Plan edge case "unfocused composer ignores input" untested
- **FIXED:** `unfocused_composer_ignores_input` (autoFocus={false} → onSubmit never called).

## MEDIUM findings (all FIXED)

- **Example interval bug** (arch-1 ≡ dom-frontend-1): overlapping submits froze the second reply
  and leaked the first interval → per-stream handles in a `Set`, each stream clears its own.
- **Over-scoped v8 pragmas** (dom-testing-4 ≡ tests-6): kitty-only condition extracted to
  `isShiftReturn` (scoped pragma-free — now unit-tested with a synthetic key via exported
  `isNewlineChord`); the submit gate re-derived from the single predicate (also closes arch-3
  DRY drift) and back under coverage accounting.
- **moveEnd found-newline branch uncovered** (tests-2): test added
  (`move_end_on_non_last_line_lands_on_next_newline`); home/end tests split (tests-4).
- **M1 schema oracle weaker than M0** (dom-testing-2 ≡ tests-7): parity restored (see H-2).

## LOW findings — fixed in batch

- Reducer public-boundary clamp for out-of-range cursor + test (arch-4).
- `onSubmit` before clear — throwing handler preserves the draft + propagation test (dom-frontend-6);
  EC-5 propagation proven synchronous through the stdin emit chain.
- Cursor cell gated on `isFocused` + JSDoc caveats: NO_COLOR cursor invisibility, non-TTY raw-mode
  requirement (dom-frontend-2/4/5).
- Window-growth duplication hazard documented in ChatThreadProps JSDoc (arch-2 ≡ dom-frontend-3).
- Byte constants normalized to explicit `\uXXXX` escapes; throttle comments reworded to the
  verified observable (dom-testing-7, tests-9 — installed ink uses trailing:true, yet burst
  frames verifiably never reach lastFrame; the tests' oracles were correct, wording fixed).
- Trim-payload, windowSize=0+overscan, empty-string-id, long-thread split-proof (spy delta)
  tests added (tests-3/5, dom-testing-5).
- Example subprocess smoke test (`tests/example-chat.integration.test.ts`) — the TTFATT demo is
  now CI-covered (tests-8); bench `--smoke` skips warmups (xval-3 budget).

## Dispositioned (documented, not code)

- **key.delete = erase-backward** (dom-frontend-7, xval-4): verified honest trade-off — ink 5.2.1
  conflates 0x7f into `key.delete` (upstream TODO to split in ink 6). CHANGELOG § Changed entry
  added; ink-6 migration note: rebind `key.delete` → `delete-forward`.
- **ChatComposer production path TTY-gated** (wire-3): human evidence — interactive
  `pnpm example:chat` run verified during T4.2; composition-root stdin scene (H-1 fix) now covers
  the automated path. PTY-based smoke deferred (node-pty dep — future milestone).
- Reducer ops `delete-forward`/`move-home`/`move-end` key-unbound (wire-4): plan-declared YAGNI.
- Process notes (xval-5/6): debug fixture committed-then-removed; audit docs bundled in T2.2
  commit — prefer dedicated `docs()` commits (M2 process note).
- check_wiring kit gaps re-confirmed (wire-5 ≡ issue #5 family).

## Cross-validation summary

- Plan FROZEN verified (single plan commit precedes all implementation commits); 8/8 tasks
  traceable to task-tagged commits; ACs 35/38 satisfied + 2 unverified-in-review-env (CI —
  verified below; smoke budget — fixed) + 1 post-release by design; **0 false claims**; all six
  logged deviations audited as properly documented.

## Quality gates summary (post-batch)

- `pnpm gates` exit 0; **84/84 tests** green (2× consecutive runs)
- Coverage: **100% stmts/lines/funcs; 99.07% branches** (remaining half-branches: justified,
  scoped pragmas only)
- `/code-quality`: PASS 100 (typescript, 0 findings D1–D4)
- run_validation: PARTIAL exit 0 (only LOW human-evidence WARN)
- Wiring triad: 11/11 pillar (a) deep-verified; pillar (b) closed for every value export incl.
  the composer scene; pillar (c) = two pinned-env baselines (M0 refreshed + M1)
- CI: green on node 20 + 22 (verified on the batch HEAD before this report)

## Spawned agents (audit trail)

`.claude/agents/review-m1-chat-surface-2026-07-06/` (definitions + findings/).

## Handoff decision

**READY_TO_MERGE** — zero BLOCKER; 3 HIGH and 4 MEDIUM fixed in-batch with RED-first tests where
applicable; LOW batch applied; dispositions documented above. Next: `/release` (develop → main PR,
human-approved) flips ROADMAP M1.
