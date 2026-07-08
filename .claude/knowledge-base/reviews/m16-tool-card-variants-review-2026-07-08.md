---
slug: m16-tool-card-variants
milestone_id: M16
date: 2026-07-08
reviewers: 2 triple-role subagents (6 roles)
commits_reviewed: 7455097 (T1.1), b8a8e14 (T2.1 via chore — DV-1)
fix_batch: single batch commit post-panel
---

# Review: m16-tool-card-variants

**Verdict:** READY_TO_MERGE

## Panel

| Reviewer | Roles | Verdict |
|---|---|---|
| R1 | architecture + wiring + cross-validation (adversarial DV pass) | FINDINGS (1 HIGH [NEEDS-REPRO], 3 MEDIUM, 3 LOW, 2 INFO) |
| R2 | tests + frontend/TUI + empirical mutation (5 mutants + 5 probes) | FINDINGS (1 HIGH, 2 MEDIUM, 4 LOW) |

Pre-conditions held: validation exit 0, code-quality PASS, 573/573 at
review time (574/574 post-batch).

## Findings & resolutions

| # | Sev | Finding | Resolution |
|---|---|---|---|
| R1-F1 | HIGH [NEEDS-REPRO] | Negative kind oracles failed ONCE on the reviewer's cold-cache first invocation (both "didn't throw"), then 7+ greens; R2 saw one spurious co-failure too | CHARACTERIZED post-review: caches + 10× `--sequence.shuffle` + 2× full suite = **12/12 green** on a settled machine; correlates with vitest cold-cache under the same external load that contaminated the bench window. Watch item (file an issue with both signatures if CI reproduces); one settle-based composer test also timed out under a saturated gates run — same profile, passed on re-run |
| R2-F1 + R2-F2 + R1-F3 + R1-F5 | HIGH/MEDIUM ×2/LOW | `fileName` shipped without ANY oracle (mutant M3 survived), was visually redundant in BOTH scenarios (duplicated DiffViewer's own header / dangled over "(unnamed)"), left dispatch line 156 uncovered, and pushed LoC to 231 > 230 | **Prop REMOVED** (never released — rung-1 parsimony: DiffViewer already owns the header row); resolves all four findings at once; LoC 230 ≤ 230; dispatch 100% |
| R1-F2 | MEDIUM | ADR D2 deviation never DECLARED (card-boundary patch parse vs "no card-level payload validation") — judged a technically correct evolution (the ink-swallow probe refuted the plan's premise; DRY preserved via the same parseUnifiedDiff) but a process failure | DV-3 declared retroactively in the log with the amendment rationale |
| R2-F3 | MEDIUM | EC-1 comment over-claimed "loud" — probed: the boundary check is ALSO absorbed by ink under a mounted render; the real gain is plain-call testability + boundary stack | comment rewritten to the PROVED contract (apps observe via waitUntilExit) |
| R1-F4 | MEDIUM | audit trail: T2.1 checkpoint pointed at the WRONG sha; log over-claimed an export-surface runtime pin | sha corrected (b8a8e14); type-only note added; log sentence fixed |
| R2-F4 | LOW | preview cap semantics differ by branch (HEAD+more vs TAIL+hidden) — undocumented | documented on the union |
| R2-F5 | LOW | no-language branch oracle was mutation-blind (M4 passed it) | anchored on ToolResult's distinctive `hidden` trailer + `not.toMatch(more)` |
| R2-F6 | LOW | output/diff passthroughs had no oracle | `output_and_diff_passthroughs_reach_the_primitives` added |
| R1-F6 | LOW | boundary fail-fast asymmetry (only diff) unrecorded | decision recorded in the boundary comment (patch = runtime DATA; other payloads = type-covered programmer errors) |
| R1-F7 | LOW | DV-2 (bench load gate unmet) — the panel JUDGED preserving the prior baseline CORRECT (workload unchanged; round 2 within 1σ = no-regression evidence; a contaminated baseline would pollute the reference) | accepted under the owner's standing merge authority, recorded here: Global-DoD checkbox "re-recorded with load field" is intentionally unmet — the load field ships in the SCRIPT for future records; verification evidence lives in the log's bench table |
| R1-F8 | INFO | mojibake 环境 in the log | corrected |
| R1-F9 | INFO | minor plan→test divergences (oracle h channel; smoke labels matched to REAL primitive contracts) | recorded; judged benign |

## Evidence highlights

- **Mutation 5/5 genuine post-batch** (M1 killed in TWO independent layers;
  M2/M5 killed by their designed oracles; M3 resolved by prop removal; M4
  now killed on both branches).
- **Baseline m2 byte-identical to pre-M16** (md5-verified by R1) — the
  no-new-bench rationale (D3) held; render-once bodies are not a per-frame
  path.
- **DV-1 adversarially validated:** b8a8e14 contains 100% of the T2.1
  scope, nothing extra — the damage was traceability (fixed), not content.
- **Probes:** empty shell → graceful `(no output)`; running+diff coexist;
  empty preview text collapses cleanly — no crash anywhere.

## Hard gates

- Failing tests: none (574/574 post-batch; 12/12 characterization runs).
- Secrets: none. Direct main commits: none. CHANGELOG: Added ×2 + Fixed ×1.

**READY_TO_MERGE** — proceed to `/release` (0.17.0, the FINAL roadmap milestone).
