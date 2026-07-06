# Discover Edge Case Review — m0-walking-skeleton

Date: 2026-07-05
Discovery plan analyzed: .claude/knowledge-base/discoveries/plans/m0-walking-skeleton-plan.md
Research questions analyzed: 7
Edge cases found: 6 (MUST FIX: 2, SHOULD TEST: 2, DOCUMENT: 2)

## MUST FIX

### EC-1: Q6 gemini-cli hotspot method too broad — grep `role|user|assistant` over all of `ui/components/`
- **Affected question:** Q6
- **Family:** Method
- **Scenario:** `ui/components/` is a large tree; grepping `role|user|assistant` returns dozens of
  false positives (auth, config, tests), burning Fase A retries and gemini-cli's 1h budget.
- **Impact:** Q6 risks BLOCKED "budget exhausted" or a hotspot map polluted with non-message files.
- **Suggested fix:** Point Q6's gemini-cli Fase A directly at the pre-verified subdir
  `gemini-cli/packages/cli/src/ui/components/messages/` (exists; confirmed 2026-07-05) — Glob it and
  pick the 1-2 core message renderers.

### EC-2: Q6 react-ink ast-grep pattern `export function $NAME` misses `export const` / `forwardRef` components
- **Affected question:** Q6
- **Family:** Method
- **Scenario:** react-ink message primitives mix `export const`, `export function` and `forwardRef`
  styles (verified in `MessageParts.tsx`, `MessageIf.tsx`, `MessageError.tsx`); a single
  function-declaration pattern returns a partial hotspot map.
- **Impact:** Fase B reads a subset and the ChatMessage API proposal is built on incomplete evidence.
- **Suggested fix:** Replace Q6's react-ink Fase A with `Glob src/primitives/message/*.tsx` and read
  ALL matches (dir has only 6 files — read-all is cheaper than pattern-matching).

## SHOULD TEST

### EC-3: react-ink `package.json` contains `workspace:*` version specifiers (pnpm monorepo)
- **Affected question:** Q3
- **Suggested halt-loop checkpoint:** When a dep version reads `workspace:*` or `catalog:`, resolve
  the real version from the assistant-ui repo root (`package.json` / `pnpm-workspace.yaml`) before
  recording it in the version matrix; never record `workspace:*` as an answer. (Verified: only
  `@assistant-ui/x-buildutils` devDep is `workspace:*` — runtime deps appear pinned.)

### EC-4: `ink/benchmark/` may be a manual script, not a metrics-emitting harness
- **Affected question:** Q5
- **Suggested halt-loop checkpoint:** If `ink/benchmark/simple/index.ts` emits no numeric metric
  (ops/s, ms), mark the ink half of Q5 as low-yield in one sentence and rest the harness design on
  `assistant-ui/packages/react-ink/benchmarks/run.ts` — do NOT burn retries making ink's benchmark
  something it isn't.

## DOCUMENT

### EC-5: Shallow blob-filter clones — no `git log` archaeology available
- **Accepted risk:** All clones are `--depth 1 --filter=blob:none`; any method relying on history
  (blame, log) is unavailable. The plan already uses only Read/Grep/Glob on the working tree, so
  this constrains nothing in v1.x — documented so `/discover-execute` never reaches for `git log`.

### EC-6: Q6/Q7 answers require interpretation (API "shape" judgment), not deterministic extraction
- **Accepted risk:** Choosing what the ChatMessage v0 API keeps vs drops is a judgment call. The
  blueprint mitigates by requiring an explicit ADR ("what we deliberately DON'T copy for M0") with
  citations on both sides — subjective conclusions are marked as proposals, not facts (Rule 3).

## Summary

| Question | Edges found | MUST FIX | SHOULD TEST | DOCUMENT |
|----------|-------------|----------|-------------|----------|
| Q1 | 0 | 0 | 0 | 0 |
| Q2 | 0 | 0 | 0 | 0 |
| Q3 | 1 | 0 | 1 | 0 |
| Q4 | 0 | 0 | 0 | 0 |
| Q5 | 1 | 0 | 1 | 0 |
| Q6 | 3 | 2 | 0 | 1 (EC-6 shared with Q7) |
| Q7 | 1 | 0 | 0 | 1 |
| (global) | 1 | 0 | 0 | 1 (EC-5) |

**Verdict:** DISCOVERY PLAN NEEDS ADJUSTMENT (2 MUST FIX — both are one-line method fixes in Q6)
