---
slug: m11-chatthread-header-slot
milestone_id: M11
date: 2026-07-08
reviewers: 2 triple-role subagents (6 roles)
commits_reviewed: 5687150, 9199f99, 9eb78ef
fix_batch: 7effd17
---

# Review: m11-chatthread-header-slot

**Verdict:** READY_TO_MERGE

## Panel

| Reviewer | Roles | Verdict |
|---|---|---|
| R1 | architecture + wiring + cross-validation | FINDINGS (1 MEDIUM, 2 LOW, 1 INFO) |
| R2 | tests + frontend/domain (incl. empirical mutation testing) | FINDINGS (1 LOW, 2 INFO) |

Pre-conditions held: validation exit 0, code-quality PASS
(`audits/m11-chatthread-header-slot-code-quality-2026-07-08.md`), 471/471
tests green, clean tree at review time.

## Findings & resolutions (all closed in batch `7effd17`)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| R1-F1 | MEDIUM | Bench re-run table existed only in commit narrative — no implementation log on disk (m7 precedent requires it before release) | `implementations/m11-chatthread-header-slot-implementation.md` written: task ledger, wiring triad, 2-round bench table (round 1 DISCARDED load 3.41; round 2 clean load 1.58 — plain mean 112.951 ≈ M10 113.098; plain-peak −33% explained as FAVORABLE, M10 run carried σ=62.7), deviations |
| R1-F2 | LOW | AgentTimeline header had no production caller | `examples/stream.tsx` mounts the banner in the timeline slot + 2 smoke asserts. NOTE: first attempt put a second header in the degrade fixture — REVERTED (would create a 2nd `<Static>`, violating the single-consumer invariant; 3 degrade scenes failed, proving the invariant is live) |
| R1-F3 | LOW | Chat smoke order anchor was a multi-line target | anchored to the 1-line row `"What ships in M1?"` |
| R1-F4 | INFO | Keep `HEADER_SENTINEL_KEY` off the entry surface (YAGNI) | accepted — not exported from `src/index.ts` |
| R2-F1 | LOW | Drop-sentinel-key mutant survives with only a React key warning | `console.error` spy added to `timeline_header_scene_matches_snapshot` — mutant B now killed |
| R2-F2 | INFO | Percentage widths may not resolve inside content-sized Static | prop-doc note added on both components' `header` docs |
| R2-F3 | INFO | Mutant C (drop `useMemo`) survives — memo is perf-only | accepted by design (correctness doesn't depend on it) |

## Evidence highlights

- **Mutation testing (R2, empirical):** mutant A (`useRef(header).current` →
  raw `header`) KILLED by `header_removal_is_ignored_and_loses_no_rows` +
  `late_header_is_ignored` — the mount-freeze design is load-bearing, not
  decorative. Numeric trace of `Static.tsx` `slice(index)` confirmed
  sentinel-first ordering is robust across graduation batches.
- **Oracle fidelity (R1):** blueprint Corner 1 oracles (a)–(g) map 1:1 to
  shipped tests; 49/49 in the two component suites; snapshot budget held
  (exactly 1 new file, +7/−0).
- **Bench honesty (R1):** re-run data internally consistent; discarded
  round documented with load evidence rather than silently dropped.
- **Guards:** it-count never-weaken guard green (471 ≥ M10 base);
  re-record guard (deletions-only) correctly ignores the new snapshot while
  still arming against M10-file rewrites.

## Hard gates

- Failing tests: none (471/471 + batch-touched suites re-run 37/37).
- Secrets: none introduced.
- Direct main commits: none (all on develop).
- CHANGELOG: `[Unreleased] § Added` carries the three m11 entries.

**READY_TO_MERGE** — proceed to `/release` (0.12.0).
