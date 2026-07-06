# Edge Case Review — m1-chat-surface (implementation plan)

Date: 2026-07-06
Plan analyzed: .claude/knowledge-base/plans/m1-chat-surface-plan.md (v1.0)
Tasks analyzed: 6 (T1.1, T2.1, T2.2, T3.1, T3.2, T4.1, T4.2)
Cases found: 6 (EDGE: 3, NEGATIVE: 3 | MUST FIX: 1, SHOULD TEST: 2, DOCUMENT: 3)

## MUST FIX

### EC-1: T4.1 bench workload (replace-last only) makes the plain-vs-windowed comparison decision-irrelevant
- **Affected task:** T4.1
- **Kind:** EDGE (measurement validity at the design boundary)
- **Family:** State / Format
- **Scenario:** With rows memoized by identity (D2), replace-last re-renders exactly ONE row in
  BOTH modes; without appends, `tailStart` never moves and Static never gains items. The mode
  matrix would measure only dynamic-region size, missing the append-churn phenomenon windowing
  actually optimizes (tail-array rebuild + Static graduation) — the analog's workload appends a
  placeholder per token for exactly this reason
  (`references/assistant-ui/packages/react-ink/benchmarks/long-thread.bench.tsx:244-259`).
- **Impact:** Committed baseline could show windowed ≈ plain, wrongly suggesting windowing is
  pointless; D1 default tuning would rest on invalid data (fabricated-rigor class risk).
- **Suggested fix:** Adopt the analog's per-token pattern: replace-last (+1 char) AND append a
  new short message every token — both phenomena (streaming repaint + append churn/Static
  graduation) measured in one workload; document both in `methodology`.

## SHOULD TEST

### EC-2: Negative/zero `windowSize`/`windowOverscan` inputs
- **Affected task:** T2.1
- **Kind:** NEGATIVE (invalid input past the boundary)
- **Suggested test:** `negative_window_values_clamp_to_zero()` — windowSize=-5, overscan=-1 on a
  6-message thread behaves as windowSize=0/overscan=0 (all but nothing? clamped → everything in
  Static except empty tail is invalid — assert the clamp yields tailStart = length, i.e. all
  static, and render still succeeds). Cheap guard on the `Math.max(0, …)` arithmetic.

### EC-3: Composer input containing multi-char printable bursts (paste-like without bracketed paste)
- **Affected task:** T3.2
- **Kind:** EDGE (extreme of valid input)
- **Suggested test:** `multichar_input_burst_inserts_atomically()` — `stdin.write("hello world")`
  once; expect the full string in the frame and cursor at end (ink may deliver bursts as one
  `input` string; the insert action already takes multi-char text — T3.1 test 10 covers the
  reducer; this covers the component path).

## DOCUMENT

### EC-4: Empty-string message id is legal; only DUPLICATES throw
- **Kind:** NEGATIVE
- **Accepted risk:** id semantics belong to the caller; uniqueness is the only structural
  invariant ChatThread needs (React keys + Static watermark). Documented in JSDoc.

### EC-5: `onSubmit` exceptions propagate (fail-loud, no swallowing)
- **Kind:** NEGATIVE
- **Accepted risk:** The composer does not try/catch caller callbacks —
  `rules/error-handling.md § 2` (never swallow). Documented in JSDoc.

### EC-6: Streaming while the growing message sits INSIDE the graduated prefix is undefined by design
- **Kind:** EDGE
- **Accepted risk:** The D1 contract freezes graduated messages; callers must keep the growing
  message in the live tail (streaming = replace-LAST). The frozen-prefix test (T2.2) pins the
  behavior; M7's adapter will maintain the invariant structurally.

## Summary

| Task | EDGE | NEGATIVE | MUST FIX | SHOULD TEST | DOCUMENT |
|------|------|----------|----------|-------------|----------|
| T1.1 | 0 | 0 | 0 | 0 | 0 |
| T2.1 | 0 | 1 | 0 | 1 (EC-2) | 1 (EC-4) |
| T2.2 | 1 | 0 | 0 | 0 | 1 (EC-6) |
| T3.1 | 0 | 0 | 0 | 0 | 0 |
| T3.2 | 1 | 1 | 0 | 1 (EC-3) | 1 (EC-5) |
| T4.1 | 1 | 0 | 1 (EC-1) | 0 | 0 |
| T4.2 | 0 | 0 | 0 | 0 | 0 |

**Coverage check:** every input-boundary task has both lenses considered (T1.1 inherits the M0
EC-1 negative case, updated in-plan; T4.2's boundary is the TTY check covered by D8).

**Verdict:** PLAN NEEDS ADJUSTMENT (1 MUST FIX — workload fix in T4.1)
