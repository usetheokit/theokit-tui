---
slug: m13-markdown-renderer
milestone_id: M13
date: 2026-07-08
reviewers: 2 triple-role subagents (6 roles)
commits_reviewed: 3c2fbc0, 49933ac, 0691171, d3c4266 (+ plan amendment a63e962)
fix_batch: single batch commit post-panel
---

# Review: m13-markdown-renderer

**Verdict:** READY_TO_MERGE

## Panel

| Reviewer | Roles | Verdict |
|---|---|---|
| R1 | architecture + wiring + cross-validation | FINDINGS (5 LOW, 2 INFO) |
| R2 | tests + frontend/TUI + empirical mutation (5 mutants + 6 render probes) | FINDINGS (3 MEDIUM, 2 LOW, 2 INFO) |

Pre-conditions held: validation exit 0, code-quality PASS, 510/510 at
review time (512/512 post-batch).

## Findings & resolutions (all closed in the batch)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| R2-F1 | MEDIUM | Fence close-length rule had NO oracle — mutant dropping `>= marker.length` survived 37/37 | `longer_open_fence_is_not_closed_by_shorter_close` added; mutant re-run → **KILLED** |
| R2-F2 | MEDIUM | `markdown !== undefined` mutant survived the component's own suite (only killed by the thread's accidental normalization) | default-off oracle now byte-compares absent vs `markdown={false}` LIVE; mutant re-run → **KILLED** |
| R2-F3 = R1-F4 | MEDIUM/LOW | byte-identity test name promised more than its asserts | same oracle: `expect(absent).toBe(explicitFalse)` — the name now tells the truth |
| R1-F5 | LOW | gemini path guards promised by the blueprint, not implemented (`ls src/*x*/y` italicized) | both path guards added + `path_like_asterisk_runs_stay_literal` oracle |
| R1-F3 | LOW | dispatch 95.45% vs AC 100% lines — gap = exhaustiveness guard (unreachable via public surface) | `v8 ignore` with an explicit decision note (reviewer-offered alternative; a crafted test would be theatre) |
| R1-F1 | LOW | bench comment overclaimed "only the flag differs" (markdown tail also carries MD_PREFIX) | comment + log rewritten: the delta measures parse + richer content TOGETHER (plain workload untouched — cross-milestone comparability preserved) |
| R1-F2 | LOW | load 0.82 in log/CHANGELOG vs 0.83 in the JSON | log corrected to 0.83 (JSON is the source) |
| R2-F4 | LOW | styled link text leaks markers (`[**b**](u)` → `**b** (u)`) | recorded subset limit in the component docblock (no recursive link parse — segment model carries one style set per run); revisit on dogfood demand |
| R2-F5 | LOW | 1-column jitter on wrapped list lines at width 40 | upstream ink wrap artifact — no action (cosmetic, documented here) |
| R2-F6 | INFO | code span inside h1/h2 fuses with heading accent; unstyled under monochrome | recorded in the docblock as a subset limit (design decision deferred) |
| R1-F6 | INFO | DV-1 red-gate commit is an M12 repeat | discipline switched to `gates && commit` (this batch used it); hook mechanization noted for backlog |
| R1-F7 | INFO | DV-4 T2.1 RED not executed | recorded; target 3/3 true REDs from M14 on |

## Evidence highlights

- **Mutation: 7/7 post-batch** (R2 ran 5; 2 survivors killed by batch
  oracles, re-verified empirically; M2/M3/M5 died at review).
- **Render probes (R2):** `***` alone → hr (CommonMark precedence);
  lone fence → empty frame, no crash; h4 under no-color keeps
  italic+dim attributes with zero color SGR.
- **Cross-validation (R1):** gemini citations verified one-by-one in the
  clone; bench table ≡ JSON digit-by-digit; deviations DV-1..DV-4 all
  match the git log (DV-2 re-scope judged "exemplar"); DoD 5/5; Coverage
  Matrix 8/8.

## Hard gates

- Failing tests: none (512/512 post-batch). Secrets: none. Direct main
  commits: none. CHANGELOG: Added ×3 + Fixed ×1.

**READY_TO_MERGE** — proceed to `/release` (0.14.0).
