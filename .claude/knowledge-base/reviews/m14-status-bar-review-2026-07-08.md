---
slug: m14-status-bar
milestone_id: M14
date: 2026-07-08
reviewers: 2 triple-role subagents (6 roles)
commits_reviewed: 9d8b21b, c46b9b6, fba0c77, f48de8a
fix_batch: single batch commit post-panel (TDD regressions first)
---

# Review: m14-status-bar

**Verdict:** READY_TO_MERGE

## Panel

| Reviewer | Roles | Verdict |
|---|---|---|
| R1 | architecture + wiring + cross-validation (adversarial deviations pass) | FINDINGS (4 LOW, 2 INFO) |
| R2 | tests + frontend/TUI + empirical mutation (6 mutants + 5 probes) | FINDINGS (3 MEDIUM, 5 LOW, 1 INFO) |

Pre-conditions held: validation exit 0, code-quality PASS, 527/527 at
review time (532/532 post-batch).

## Findings & resolutions (all closed in the batch)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| R2-F3 | MEDIUM | Below the width floor: separators shrank BEFORE the cwd, and the tokens slot silently truncated to a WRONG value (`12.3k/128`) | separators wrapped in `flexShrink={0}` boxes; tokens `wrap="truncate-end"` (clipping is VISIBLE); width floor documented |
| R2-F1 | MEDIUM | Conflated token negative let the `limit<=0` mutant survive | 4 per-axis negatives (used<0/NaN, limit 0/-5/NaN) — M6 re-run **KILLED** |
| R2-F2 = R1-F4 | MEDIUM/LOW | Narrow oracle passed vacuously (content-only asserts) — flexShrink mutant survived | one-line + ellipsis + head-cut + WIDTH-FIT (≤ 30) oracles — M5 re-run **KILLED** |
| R2-F4 = R1-F1 | LOW | tildeify prefix trap (`/home/user-backup` → `~-backup`) | boundary check (`=== home || startsWith(home + "/")`) + sibling/exact oracles (TDD RED first) |
| R2-F5 | LOW | `state=""` emitted a dangling separator | empty strings normalized to absent + oracle |
| R2-F6 | LOW | act() advisories polluted the hook suite stderr | act-wrapped mounts (mountProbe) |
| R2-F7 | LOW | boundary TypeError swallowed by ink under live render | documented on the component (framework surfaces via waitUntilExit) |
| R2-F8 | LOW | example elapsed never leaves 0 (scripted stream < 1 s) | honest in-code note; the 1 Hz path is covered end-to-end by the ticking bench |
| R1-F2 | LOW | log wrote 113 LoC (real: 115) | corrected with a note (never silently) |
| R1-F3 | LOW | phase-1 mini-review edited retroactively inside T2.1 | logged as DV-1 with the process rule (artifacts get own commits) |
| R1-F5 | INFO | ticking peak (~1500 ms) is sampler quantization, unannotated | methodology note added; baseline re-recorded (load 0.14, wall 10024 ± 1.7 ms — consistent) |
| R1-F6 | INFO | TRUE-RED evidence ephemeral | tails quoted in the progress notes |
| R2-F9 | INFO | active-branch reset mutant is EQUIVALENT (defensive redundancy) | conscious in-code note kept |

## Evidence highlights

- **Mutation 5/5 genuine post-batch** (M2 judged equivalent; M5/M6
  survivors killed by exactly the oracles written for them, re-verified).
- **Adversarial deviations pass (R1) WORKED:** the "zero deviations"
  claim was refuted twice (LoC number; retro-edited audit artifact) —
  both now logged as DV-1/DV-2.
- **AgentStreaming no-timer contract:** `git diff` of the file across the
  M14 range is EMPTY — verified, not assumed.
- **Honest metrics:** ticking mean ≈ tick interval (not render cost) —
  R1 confirmed the log's framing is mathematically correct.

## Hard gates

- Failing tests: none (532/532 post-batch). Secrets: none. Direct main
  commits: none. CHANGELOG: Added ×4 + Fixed ×1.

**READY_TO_MERGE** — proceed to `/release` (0.15.0).
