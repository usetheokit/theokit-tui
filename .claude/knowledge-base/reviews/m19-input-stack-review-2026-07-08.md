# Review — M19 input-stack (2026-07-08)

**Build under test:** `develop` (3 M19 feature commits atop v0.19.0) + review-fix commit.
**Method:** 2 independent specialist reviewers (port-fidelity/input-domain, test-quality/cross-validation). Code-quality gate: PASS.

## Per-agent verdicts (initial)

| Reviewer | Verdict | Key finding |
|---|---|---|
| Port-fidelity / input-domain | READY_TO_MERGE | Port faithful; Ctrl+J contract exact; PTY e2e real; MEDIUM: kitty enable bytes never written; paste-fallback key not re-projected |
| Test-quality / cross-validation | **NEEDS_FIXES** | **BLOCKER:** `pnpm gates` flaky-RED (M15 `chat-composer.test.tsx:50` fails ~1-in-2 under load); MEDIUM: kitty emission unwired vs DoD; compat probe hand-copies the composer mapping |

**Consolidated verdict (initial): NEEDS_FIXES** — 1 BLOCKER, 3 MEDIUM.

## Fixes applied (this review-fix commit)

| Finding | Severity | Fix |
|---|---|---|
| `pnpm gates` flaky — M15 composer frame test fails under load | **BLOCKER** | Root cause: `settle = 50ms` fixed sleep vs Ink's time-throttled render (testing.md §6 real-timer dependence). Replaced the 5 flush-timing frame assertions with a poll-based `waitForFrame` (waits until the frame settles, up to a deadline). **5/5 green under load 9.37** (was ~1-in-2). |
| kitty enable bytes exported but never written (DoD-1 "handshake where available") | MEDIUM | `createInputSource(stdin, writeToTerminal?)` now emits `KITTY_ENABLE` on `start` and `KITTY_DISABLE` on `stop` when an output writer is provided — the query the terminal replies to (so `isKittyActive()` can become true). New test asserts the exact bytes; the constants now have a caller. |
| compat probe hand-copies the composer's key→action mapping (drift risk) | MEDIUM | Exported the composer's real `actionForKey` and the compat test now imports + drives it (not a hand-copy) — the proof exercises the composer's EXACT `??` chain + `input !== "\n"` insert guard. |

## Findings accepted as-is (documented)

- **DoD-3 proven by probe, not by rewiring the shipped composer** — the composer still imports Ink's `useInput`; the swap is M20's cutover (disclosed in the plan Unresolved Questions + report). The compat proof now uses the composer's REAL `actionForKey` + REAL `textBufferReducer` through OUR `useInput`/`projectKey`, so it proves the input plumbing end-to-end; the full component swap is intentionally M20.
- **Paste-fallback key = `projectKey("")`** (all-false) rather than re-projecting the paste content — a dead path for the composer (it registers `usePaste`, so the fallback never fires). The `input` string is byte-identical to Ink; only the (unused) `key` object differs. Left as-is with the reviewer's note; a fast-follow can re-project if a no-paste-listener consumer ever needs semantic keys from a paste.
- **Dead-guard removals** (codePointAt/type undefined) — verified provably unreachable by both reviewers (loop bound + length checks); safe.

## Final state

`pnpm gates` green and **deterministic under load** (the M15 flake is fixed). All 7 input modules at 100% lines. The kitty handshake is now emitted (DoD-1 functional). The composer-compat proof drives the composer's real `actionForKey`. The node-pty e2e drives the REAL raw-mode path and closes M15 EC-5 on both the fake-stdin and real-pty tiers.

**Verdict:** READY_TO_MERGE — BLOCKER fixed (flake deterministic), both actionable MEDIUMs fixed (kitty emission wired, compat uses the real mapping), remaining items disclosed and scoped to M20. No BLOCKER, 0 open HIGH.
