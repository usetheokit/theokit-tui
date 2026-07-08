---
slug: m15-composer-autocomplete
milestone_id: M15
date: 2026-07-08
reviewers: 2 triple-role subagents (6 roles)
commits_reviewed: 3e581c6, cf89bfe, e452bf5
fix_batch: single batch commit post-panel (TDD REDs first on product fixes)
---

# Review: m15-composer-autocomplete

**Verdict:** READY_TO_MERGE

## Panel

| Reviewer | Roles | Verdict |
|---|---|---|
| R1 | architecture + wiring + cross-validation | FINDINGS (1 HIGH, 2 LOW, 2 INFO) |
| R2 | tests + frontend/TUI + empirical mutation (6 mutants + 5 probes) | FINDINGS (2 HIGH, 3 MEDIUM, 3 LOW, 2 INFO) |

Pre-conditions held: validation exit 0, code-quality PASS, 557/557 at
review time (561/561 post-batch).

## Findings & resolutions (all closed in the batch)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| R1-F1 = R2-F2 | HIGH | Bench workload MISLABELED: the filter drifted to "cc" (zero matches) — menu OPEN in only 3–5/120 keystrokes; the published +0.30 ms delta measured a mostly-CLOSED menu (understated ~7×) | script now STRICTLY alternates type/erase (both reviewers' fix converged; R2 validated 120/120 open frames empirically); baseline re-recorded: menu 8.03 ± 0.63 vs plain 5.99 ± 0.03 — honest delta **+2.04 ms (+34%)**; methodology/CHANGELOG/log corrected |
| R2-F1 | HIGH | `startsWith`→`includes` mutant SURVIVED (no substring negative) | `prefix_match_rejects_mid_name_substrings` (`/el` → zero) — mutant re-run **KILLED** |
| R2-F3 | MEDIUM | Ctrl+J leaked with the menu open: multiline draft kept the menu stuck and Enter COMPLETED instead of submitting | model closes on `\n` (RED first); composer oracle `newline_chord_with_open_menu_closes_it_and_enter_submits` |
| R2-F4 | MEDIUM | Long description at width 40 interleaved with the name column (4 lines per row) | gemini row shape: name Box flexShrink 0 + description truncate-end; width-fit oracle |
| R2-F5 | MEDIUM | Bench: cold-start 10 ms settle silently dropped the "/" — no guard | 100 ms settle + fail-fast open-menu guard (throws if the menu mode ends without rows) |
| R1-F2 | LOW | prose numbers diverged from artifacts (load 1.30 vs JSON; LoC 415 vs 417) | log corrected; prose now cites the JSON field |
| R1-F3 | LOW | plan oracle d second half omitted silently (post-ESC arrows) | post-ESC LEFT_ARROW+insert assert added; DV-3 records the unimplementable-as-written original |
| R2-F6 | LOW | tab oracle masked by the cursor cell (no-space mutant passed composer-level) | type-after-Tab assert proves the real space |
| R2-F7 | LOW | hint "dim" never asserted (plain() stripped it) | raw SGR `[2m` assert |
| R2-F8 | LOW | negatives without positive anchors | anchors added (input landed) |
| R1-F4 | INFO | dead `dismissed` param in production | accepted (tests exercise it; simplification candidate — YAGNI now) |
| R1-F5 | INFO | DoD-2 multi-line half satisfied by the PRE-EXISTING M1 chord | judged NOT silent re-scope (Coverage Matrix declared it; plan scored with it visible); recorded in the roadmap-run note |
| R2-F9/F10 | INFO | case-sensitivity + latch comment imprecision | prop docs corrected |

## Evidence highlights

- **Mutation 6/6 post-batch** (M1/M2/M4/M5 killed at review; M3 killed by
  the batch oracle, re-verified; M6 killed by text-buffer units +
  composer oracle now unmasked).
- **The two panels CONVERGED independently on the bench workload defect**
  — and R2 empirically validated R1's fix before it was committed.
- **ink ESC-blur finding** verified by both panels against the ink build
  (App handler runs before subscribers; refocus scoped to menu-dismiss
  only).

## Hard gates

- Failing tests: none (561/561 post-batch). Secrets: none. Direct main
  commits: none. CHANGELOG: Added ×3 + Fixed ×1.

**READY_TO_MERGE** — proceed to `/release` (0.16.0).
