# Review — M22 interaction-primitives (2026-07-09)

**Build under test:** develop (4 M22 feature commits atop v0.22.0 + a review-fix commit).
**Method:** 2 independent specialist reviewers in parallel (overlay/focus + SelectList; pager + DoD cross-val), adversarial, with throwaway probes. Gates green (897 tests).

## Per-agent verdicts (initial)

| Reviewer | Verdict | Headline |
|---|---|---|
| Overlay / SelectList | NEEDS_FIXES | The F-HIGH-1 races did NOT materialize — windowFor byte-identical (probe-verified), depth-guard correct, focus capture correct, blur() safe. MEDIUM: nested-overlay state loss. |
| Pager / DoD cross-val | NEEDS_FIXES | HIGH: PgUp/PgDn literal no-ops (DoD says "PgUp/PgDn"); MEDIUM: status-line wrap on narrow terminals. DoD otherwise genuinely delivered. |

## Fixes applied (review-fix commit)

| Finding | Sev | Fix |
|---|---|---|
| PgUp/PgDn no-ops | HIGH | Added pageUp/pageDown to the M19 Key projection (the parser already framed the names); the Pager binds them; real-CSI test. |
| status-line wrap steals a content row | MEDIUM | Status clipped to one row via `columns` from useStdout; narrow-terminal test. |
| nested-overlay state loss | MEDIUM | Documented (JSDoc + CHANGELOG): only the top overlay is mounted; a covered overlay re-mounts on reveal (refocuses, resets state); single-level unaffected; lift state to preserve. |

## Findings accepted as-is
- LOW: overlay focus-restore no-ops if the background focusable unmounted mid-overlay (rare; documented behavior). INFO: multi-select commits the whole set (intended). Standalone Pager has no Esc (the overlay owns it — by design).

## Verified correct (not overclaimed)
windowFor byte-identical to the old M15 math (30×count probe); the DRY delegation is real (both slash + mention consume it; 59 tests unchanged); depth-counted overlay guard (F-HIGH-1) correct + no push/pop desync; autoFocus-capture has no race (blur queued before the mount); Esc arbiter gated off while an overlay is open; bubbles percent-at-fit port faithful; pure models at 100% lines; 0 snapshots (≤3 honored); scope-clean (no app pickers); wiring genuine.

**Verdict: READY_TO_MERGE** — HIGH (PgUp/PgDn) + MEDIUM (status clip) fixed with tests; the nested-overlay MEDIUM documented. No open BLOCKER, 0 open HIGH.
