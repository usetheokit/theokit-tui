# Discover Edge Case Review — m2-tool-surface

Date: 2026-07-06
Discovery plan analyzed: .claude/knowledge-base/discoveries/plans/m2-tool-surface-plan.md
Research questions analyzed: 6
Edge cases found: 3 (MUST FIX: 1, SHOULD TEST: 1, DOCUMENT: 1)

## MUST FIX

### EC-1: Q5 premise stale — BOTH analogs already declare ink-spinner in their manifests
- **Affected question:** Q5
- **Family:** Method / Reference path
- **Scenario:** Q5's Fase B treats production adoption as open; verified 2026-07-06:
  `assistant-ui/packages/react-ink/package.json:46` (`"ink-spinner": "^5.0.0"`) and
  `gemini-cli/packages/cli/package.json:54` (`"ink-spinner": "5.0.0"`).
- **Impact:** Budget wasted re-deriving a 2-line read; D2's adoption ingredient already resolvable.
- **Suggested fix:** Q5 Fase B reads those manifest lines as adoption evidence + greps each
  analog's ink-spinner USAGE site; peer ranges defer to `/deps-audit` registry.

## SHOULD TEST

### EC-2: codex `exec_cell/render.rs` may be large — sampling discipline applies
- **Affected question:** Q2
- **Suggested halt-loop checkpoint:** `wc -l` first; > 800 lines → read only the
  truncation/layout region (grep `truncat|head|tail|lines`) and record the sampling.

## DOCUMENT

### EC-3: ink-spinner SOURCE is not in the clones — internals evidence comes from ink-ui
- **Accepted risk:** Internals answered from `ink-ui/source/components/spinner/` (equivalent
  mechanism); exact peer ranges from the npm registry at `/deps-audit`. No fabrication.

## Summary

| Question | Edges | MUST FIX | SHOULD TEST | DOCUMENT |
|----------|-------|----------|-------------|----------|
| Q2 | 1 | 0 | 1 (EC-2) | 0 |
| Q5 | 2 | 1 (EC-1) | 0 | 1 (EC-3) |
| others | 0 | 0 | 0 | 0 |

**Verdict:** DISCOVERY PLAN NEEDS ADJUSTMENT (1 MUST FIX — one-line method fix)
