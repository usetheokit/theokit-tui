# Review: m3-agent-surface

**Date:** 2026-07-06
**Reviewers (spawned agents):** 6 — architecture, tests, wiring, cross-validation, domain-frontend (TUI), domain-testing
**Findings:** 41 total pre-batch (BLOCKER: 1, HIGH: 2 dedup, MEDIUM: 8 dedup, LOW: ~13, INFO: ~14)
**Verdict:** **READY_TO_MERGE** (post-batch `eb611f9`)

## BLOCKER (FIXED in the review batch — two root causes)

### B-1 (dom-testing-1 ≡ wire-1 ≡ xval-1): the 500-line tall item never rendered — the bounded|unbounded matrix measured NOTHING
- `i === 42` sat inside the tool branch but slot(42)=2 routes to the MESSAGE branch: the
  D7 workload's tall item was dead code across every run; both modes rendered identical
  2-line outputs, and the committed baseline's methodology described a workload that never
  executed (bounded peak 13.31 > unbounded 12.84 — pure noise presented as risk-1 evidence).
- **Second root cause found while fixing:** moving the index to 45 (a tool slot) STILL
  measured nothing — mount-range items graduate into `<Static>` BEFORE sampling starts, so
  the graduation cost landed in the excluded mount.
- **FIXED:** `TALL_ITEM_INDEX = 345` (tool slot, APPEND range — graduates mid-loop, step
  45), fail-fast workload self-check (`assertTallItemInAppendRange`), methodology rewritten
  to declare <1σ deltas inconclusive, baseline regenerated. **The fixed numbers are
  conclusive: unbounded peak 51.054 ± 9.246 ms vs bounded 9.194 ± 1.833 ms (~5.5×)** — the
  tall-item graduation cost roadmap risk 1 demanded, now with real evidence. Implementation
  log amended (xval-2: the void numbers are called out, not papered over).

## HIGH (FIXED)

- **H-1 (dom-frontend-1 ≡ xval-7): AgentStreaming broke its one-line contract at narrow
  widths** — the cancel-hint suffix had no wrap control and word-wrapped into a 3-line
  staircase at 30 cols. FIXED: `wrap="truncate-end"` on the suffix + a width-30 regression
  test (`streaming_stays_one_line_at_narrow_width`).

## MEDIUM (all FIXED or dispositioned)

- **Thinking glyph confusability** (dom-frontend-2): `·` was IDENTICAL to the system role's
  glyph — under NO_COLOR the only marker vanished. FIXED: distinct `•` (EAW-Narrow, codex
  precedent) + line-anchored probe assert; DV-6 logged.
- **Public-entry divergences** (arch-1 ≡ wire-2, xval-5 ≡ wire-5): `CHAT_ROLES`/
  `TOOL_CALL_STATUSES` + per-variant event types exported beyond D8/plan wording.
  DISPOSITION: exports KEPT — M7 adapters are external consumers and can only import from
  the entry (same argument as AGENT_EVENT_KINDS); divergence logged (DV-1/DV-2) + CHANGELOG
  names them.
- **Tool-tail repaint blind spot** (tests-1): the spy counted only ChatMessage renders.
  FIXED: `tool_tail_identity_replace_repaints_only_that_row` (frame transition + spy 0).
- **Streaming boundary negative missing** (tests-3): FIXED —
  `streaming_invalid_elapsed_throws_even_without_hint` pins hint-independent validation.
- **M3 baseline oracle weaker than M1 parity** (tests-2, dom-testing-4): FIXED — finiteness
  asserts on std_dev/frames_mean, `steps`/`window` fields, event-mix values > 0 + sum ≈ 1.
- **One-timeline-per-screen undocumented** (wire-3): FIXED — JSDoc contract with the D2
  two-Statics rationale.
- **Missing deviation log** (xval-3): FIXED — `m3-agent-surface/deviations.md` backfilled
  (DV-1..DV-6, m2 precedent).
- **Baseline churn policy** (dom-testing-3): DISPOSITION — full refresh per milestone under
  the same pinned environment is the working policy (Final Phase mandates it); the m3 review
  CHANGELOG entry names the refresh. A name filter for `run.ts` is a logged M4 candidate.

## LOW batch (applied)

- `formatElapsed(3599)` hour-cutoff boundary (tests-5); line-anchored glyph oracles with
  stripAnsi (tests-6); probe `agent turn` assert + glyph-vacuity note (tests-8); plan-name
  comment on the folded no_color test (tests-4 ≡ xval-4, DV-4); ChatMessage role union
  derived from `CHAT_ROLES` (arch-2); shared internal `unionMessage` — rule-of-3 closed
  (arch-3); `elapsedSeconds` JSDoc honesty (arch-4); example const hoist (arch-5); smoke
  banner documents 0-warmup (dom-testing-5); bench `runOnce` complexity extraction.

## Dispositioned (documented, not code)

- Spinner timer fan-out N+1 (dom-frontend-3): plan risk register; M6/M7 shared-ticker
  candidate. Mixed-prefix column (dom-frontend-4, SEPA F6): accepted heritage, M6 pass.
  `·`/`✓` EAW-Ambiguous width (dom-frontend-5): gemini-equivalent exposure, M6 note.
  Example TTY branch untested in CI (wire-4): M2 precedent; probe covers AgentStreaming.
  Demo honesty VERIFIED empirically (dom-frontend-6: zero ANSI bytes piped). CI budget
  projection fine (dom-testing-6). Event-mix + baseline self-consistency VERIFIED by
  independent recomputation (dom-testing-7, wire-6).

## Cross-validation summary

- Plan FROZEN verified; 5/5 tasks traceable (T3.2 initially FAIL on D7 fidelity —
  resolved by the batch); Coverage Matrix 11/11 discharged post-fix; ROADMAP § M3 DoD 3/3;
  deviations DV-1..DV-6 logged; implementation-log false claim CORRECTED in place (xval-2).

## Quality gates summary (post-batch)

- `pnpm gates` exit 0; **192/192 tests** green (2× consecutive runs)
- Coverage: **100% stmts/lines/funcs; 98.81% branches**
- `/code-quality`: PASS (typescript, 0 findings D1–D4)
- `run_validation`: exit 0 (0 FAIL; 1 LOW human-evidence WARN)
- Benchmarks: 4 baselines fresh under pinned env; m3 agent-timeline bounded
  **3.668 ± 0.135 ms/frame** (peak 9.194 ± 1.833) vs unbounded **5.768 ± 0.596**
  (peak **51.054 ± 9.246**) — conclusive ~5.5× tall-item graduation cost
- CI: node 20 + 22 — batch HEAD run checked before this verdict (below)

## Spawned agents (audit trail)

`.claude/agents/review-m3-agent-surface-2026-07-06/` (findings/).

## Handoff decision

**READY_TO_MERGE** — 1 BLOCKER (double root cause) + 2 HIGH + 8 MEDIUM fixed in-batch with
regression guards; LOW batch applied; dispositions documented. Next: `/release`
(develop → main PR, human-approved) flips ROADMAP M3.
