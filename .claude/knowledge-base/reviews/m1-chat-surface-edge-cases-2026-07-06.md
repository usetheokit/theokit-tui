# Discover Edge Case Review — m1-chat-surface

Date: 2026-07-06
Discovery plan analyzed: .claude/knowledge-base/discoveries/plans/m1-chat-surface-plan.md
Research questions analyzed: 7
Edge cases found: 5 (MUST FIX: 2, SHOULD TEST: 1, DOCUMENT: 2)

## MUST FIX

### EC-1: Q5 Fase A greps `ink/test/` by filename — no `static.tsx` exists; Static tests live inside other files
- **Affected question:** Q5
- **Family:** Method / Reference path
- **Scenario:** `ls`/name-grep for a static test file returns empty ×3 → Q5 goes BLOCKED while
  the evidence exists (verified 2026-07-06: `grep -rln '<Static' ink/test/` →
  `components.tsx`, `render.tsx`, `render-to-string.tsx`).
- **Impact:** Q5 falsely BLOCKED; blueprint loses the Static-testing contract.
- **Suggested fix:** Q5 Fase A becomes `grep -rln '<Static' ink/test/` and Fase B reads the
  Static regions of `ink/test/components.tsx` (primary) + `ink/test/render.tsx`.

### EC-2: Q4 misses ink's own input-testing suite — the canonical stdin escape-sequence evidence
- **Affected question:** Q4
- **Family:** Method
- **Scenario:** Q4 reads only analog tests; ink ships `test/hooks-use-input.tsx` (+`-kitty`,
  `-navigation` variants, verified present) with the authoritative stdin byte sequences for
  special keys — exactly what ChatComposer tests will need.
- **Impact:** Test-idiom table would lack the ground-truth key encodings; M1 tests risk wrong
  escape sequences (flaky/false-green input tests).
- **Suggested fix:** Add `ink/test/hooks-use-input.tsx` to Q4's Fase B read list (method
  refinement of the same question; ink budget already covers it).

## SHOULD TEST

### EC-3: gemini-cli `InputPrompt.test.tsx` may be very large — skim can eat the 2h budget
- **Affected question:** Q4
- **Suggested halt-loop checkpoint:** Before reading, `wc -l` the file; if > 800 lines, read only
  the top-of-file harness setup + 2 representative key-handling tests (grep `describe\|stdin`)
  and record the sampling honestly in the blueprint.

## DOCUMENT

### EC-4: react-ink composer/thread are runtime-context-driven — API translation is judgment
- **Kind:** Interpretation
- **Accepted risk:** Same as M0's EC-6: react-ink primitives read state from `@assistant-ui`
  runtime context; M1's explicit-props API is a translation, not a copy. Blueprint marks such
  conclusions as proposals with evidence on both sides (Rule 3), and the M7 boundary (ADR D3)
  keeps runtime coupling out.

### EC-5: Shallow blob-filter clones — no `git log` archaeology
- **Accepted risk:** Carried from M0 (EC-5): methods are Read/Grep/Glob only; the plan already
  complies.

## Summary

| Question | Edges found | MUST FIX | SHOULD TEST | DOCUMENT |
|----------|-------------|----------|-------------|----------|
| Q1 | 0 | 0 | 0 | 0 |
| Q2 | 0 | 0 | 0 | 0 |
| Q3 | 1 | 0 | 0 | 1 (EC-4 shared) |
| Q4 | 2 | 1 (EC-2) | 1 (EC-3) | 0 |
| Q5 | 1 | 1 (EC-1) | 0 | 0 |
| Q6 | 0 | 0 | 0 | 0 |
| Q7 | 0 | 0 | 0 | 0 |
| (global) | 1 | 0 | 0 | 1 (EC-5) |

**Verdict:** DISCOVERY PLAN NEEDS ADJUSTMENT (2 MUST FIX — both one-line method fixes)
