---
slug: m12-animated-banner
milestone_id: M12
date: 2026-07-08
reviewers: 2 triple-role subagents (6 roles)
commits_reviewed: 7b7a950, 58edec6, 49b8815 (+ validation fixes 95a624c/08c6a05/5c6a949)
fix_batch: see "Resolutions" (single batch commit + scratch cleanup)
---

# Review: m12-animated-banner

**Verdict:** READY_TO_MERGE

## Panel

| Reviewer | Roles | Verdict |
|---|---|---|
| R1 | architecture + wiring + cross-validation | FINDINGS (2 HIGH, 2 MEDIUM, 2 LOW, 2 INFO) |
| R2 | tests + frontend/TUI + adversarial mutation (empirical) | FINDINGS (3 MEDIUM, 1 LOW, 1 INFO) |

Pre-conditions held: validation exit 0, code-quality PASS 100, 480/480 at
review time (483/483 post-batch).

## Findings & resolutions (all closed in the batch)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| R1-F1 | HIGH | Fabricated SHA `7d3730a` in the implementation-log ledger | Ledger corrected to the real SHAs (`95a624c`, `08c6a05`, `5c6a949`) |
| R1-F2 | HIGH | Flakiness observed once, `[NEEDS-REPRO]` — two failure signatures on the reviewer's first (cold-cache) run, then 20+ consecutive greens incl. full suite + CPU stress; not re-reproducible | WATCH status: harness hardened — the gated remount is now act-wrapped AND asserts a painted bordered box immediately (a blank mount now fails loudly at the harness, not confusingly at an oracle); 5× consecutive green post-batch. NOT closed as fixed — recorded as a watch item; if it ever reproduces, file an issue with the two signatures quoted |
| R1-F3 | MEDIUM | T1.1 AC breached silently: `welcome-banner.tsx` 226 LoC > 220 | Trimmed to 220 (comment compression, no contract text lost); logged as DV-3 with the gate-gap note (validation surfaced it only as human-evidence) |
| R1-F4 = R2-F2/F3 | MEDIUM | Gate legs `columns >= 44` and `!monochrome` had NO oracle — both mutants **empirically survived** | Two new tests (`below_min_columns_renders_static_immediately`, `monochrome_theme_forces_static_path`); both mutants re-run and **KILLED** (verified in-batch) |
| R2-F1 | MEDIUM | Phase-0 frame collapses to a 2-line box (empty `<Text>` = height 0) — layout shift on tick 1, untested window | Space placeholder at phase 0 (`shown === "" ? " " : shown`) + `mount_frame_has_full_box_height_at_phase_zero` oracle (3 lines pinned) |
| R2-F4 | LOW | Negatives (reduced-motion, min-rows) asserted content, not FULL static byte-identity | Both now compare against a live static render (`toBe(staticRender.lastFrame())`) |
| R1-F5 | LOW | AC "load < 4 recorded in the JSON" unmet literally (house baselines never recorded load) | Bench now writes `load_1min_at_start`; baseline re-recorded at load 1.47 (wall 969.5 ± 1.7 ms — consistent with both prior rounds) |
| R1-F6 | LOW | `THEOKIT_TUI_NO_MOTION` invisible in README | One line added to the Shell row of the primitives table |
| R2-F5 | INFO | act() advisories polluted stderr | mountGated rerender act-wrapped (same batch as the paint guard) |
| R1-F7 | INFO | `clearInterval` inside the setState updater (impure updater) | Accepted: idempotent, single-invoke pinned by the M10 canary; canonical-form refactor not worth the churn (KISS) |
| R1-F8 | INFO | `isRevealEligible` re-evaluated per render as a `useRef` arg | Accepted trade-off (lazy init costs readability; only the first result is used) |

## Evidence highlights

- **Mutation score 8/8 post-batch** (A/B from implement + reviewer's 6): the
  two review-survivors were killed by exactly the tests written for them,
  re-run empirically — not assumed.
- **Byte-identity honest** (R1): pre-M12 static JSX vs `staticBannerTree`
  diffed — same element tree; oracles compare LIVE renders only.
- **Bench honest** (R1): all 5 table numbers matched the committed JSON
  exactly (before AND after the re-record); wall 969.5 ms < 2000 DoD with
  in-bench assert + contract test.
- **Rules-of-hooks** verified: every hook above the FLOOR early-return.
- **Snapshot budget**: 1 new snapshot, +7/−0, anchored.
- **DoD ROADMAP § M12 (5 bullets)**: all covered — gate legs now each have
  an oracle (closing the R1 caveat on bullets 1–2).

## Hard gates

- Failing tests: none (483/483 post-batch; animated suite 5× green).
- Secrets: none. Direct main commits: none. CHANGELOG: updated (Added ×3 + Fixed ×1).

**READY_TO_MERGE** — proceed to `/release` (0.13.0).
