---
slug: m14-status-bar
milestone_id: M14
created_at: 2026-07-08
question: How do production agent CLIs compose a persistent status bar (model · cwd · tokens · state) responsively, and how does turn-elapsed integrate with a spinner component whose contract forbids internal timers?
---

# Discovery Plan: m14-status-bar

## Context

M14 adds `AppStatusBar` (model · cwd · tokens · state) + turn elapsed on
the streaming indicator (ROADMAP § M14). Fase A findings: gemini
`Footer.tsx` (543 lines — `FooterRow` slot model: items with
flexGrow/flexShrink + dim `·` separators + label mode; `CwdIndicator` with
`shortenPath`/`tildeifyPath` width-aware truncation); mastracode
`status-line.ts` (556 lines, model/mode/memory/path) +
`status-duration.ts` (22-line duration formatter); codex
`status_indicator_widget.rs` + `chatwidget/status_*`. House facts:
`AgentStreaming` ALREADY has `elapsedSeconds?` + human formatting, and its
M3 ADR D4 contract is "DUMB — holds NO timer; ticking is the caller's
concern"; `ContextWindowBar`/`CostMeter` own the token/cost math; M12
established the bounded-interval driver + fake-timer test idiom.

## Objective

Blueprint locking: the slot row model (which slots, separator, overflow
behavior), the cwd truncation approach, the elapsed DRIVER design (hook vs
component prop — without breaking AgentStreaming's no-timer ADR), the
degrade ladder, oracle set and bench mode shape.

## In-Scope / Out-of-Scope

**In:** `AppStatusBar` (model/cwd/tokens/state slots + free extras?),
width-responsive truncation, a turn-elapsed driver reusable by
AgentStreaming consumers, degrade (NO_COLOR/narrow/pipe), OWN bench
(elapsed ticks = per-frame path).
**Out:** gemini's configurable footer-items system (settings machinery —
YAGNI); memory/quota/sandbox indicators (app concerns); vim-mode/debug
displays; background tinting (mastracode badge styling).

## ADRs

### D1 — Slot row with dim `·` separators (preliminary)

**Decision shape:** fixed AI-native slots (model, cwd, tokens, state) laid
out as one row with dim `·` separators (gemini FooterRow shape without the
config system); each slot shrinks per priority.
**Alternatives:** fully generic `items[]` API (gemini full shape — closer
to the out-of-scope "generic layout widget" risk); bordered box (footer is
a LINE, peers keep it borderless).
**Consequences:** Q1 must extract the FooterRow layout mechanics + cwd
truncation; Q3 the overflow/priority behavior at narrow widths.

### D2 — Elapsed driver as a separate hook; AgentStreaming stays dumb (preliminary)

**Decision shape:** `useTurnElapsed(active: boolean): number` — a bounded
1 s interval (M12 driver idiom) the consumer plugs into the EXISTING
`elapsedSeconds` prop; AgentStreaming's no-timer ADR (M3 D4) is untouched.
**Alternatives:** `autoElapsed` prop on AgentStreaming (breaks the ADR);
leaving it caller-only as today (fails DoD-2 "integrated").
**Consequences:** Q2 verifies peer tick cadence + our fake-timer idiom
covers the hook; Q5 the bench mode (1 Hz repaint path).

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | gemini FooterRow mechanics: item flexGrow/flexShrink defaults, the `·` separator boxes (minWidth/justify), label mode, and CwdIndicator's shortenPath/tildeify width budget — what is the minimal subset for 4 fixed slots? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Footer.tsx` | Grep `FooterRow\|COLUMN_GAP\|shortenPath` (done) | Read :103-543 layout + width plumbing | Slot layout recipe — citations |
| Q2 | Elapsed cadence + formatting: mastracode `formatStatusDuration` buckets vs our AgentStreaming formatter; peer tick rates (1 s?); teardown discipline for the hook (M12 precedent) | techniques | `.claude/knowledge-base/references/mastra/mastracode/src/tui/status-duration.ts`, our `src/agent-streaming.tsx` | Read both formatters (done) | Trace mastracode's tick source in status-line.ts | Driver contract — citations |
| Q3 | Oracle set: slot presence/order, separator count, narrow-width priority (which slot truncates first — cwd), missing-slot omission (no dangling `·`), elapsed hook determinism (fake timers, unmount teardown), degrade scenes; snapshot budget | tests | our `src/welcome-banner.animated.test.tsx` (fake-timer idiom), `tests/degrade-matrix.integration.test.tsx`, gemini Footer tests | Grep gemini Footer test oracles | Design ours | Oracle set + budget — citations |
| Q4 | Deps: zero new (ink Box/Text + our theme + node:path for cwd tildeify? or plain string ops); confirm no ink-ui footer import | deps | our `package.json`, gemini's imports | Grep manifests | Confirm zero-dep verdict | Rule 9 verdict — citations |
| Q5 | Evidence: OWN bench (elapsed ticking at 1 Hz repaints the bar — per-frame path per the M9 flip condition); example shape (chat example gains the bar + streaming elapsed); smoke asserts under the pipe contract | tools | our `benchmarks/welcome-banner.bench.tsx` (M12 shape), `examples/chat.tsx` | Map bench harness reuse | Decide bench modes + example | Evidence plan — citations |

## Edge-case annotations (MUST-FIX absorbed)

- **MUST-FIX EC-1 (→ Q1/Q3):** missing slots must not leave dangling
  separators (`model · · state`) — separator emission is between PRESENT
  slots only.
- **MUST-FIX EC-2 (→ Q2/Q3):** the elapsed hook must stop cold on
  `active=false` AND reset on re-activation (turn 2 starts at 0s, not
  where turn 1 stopped).
- **MUST-FIX EC-3 (→ Q3):** narrow width — cwd truncates FIRST (gemini
  priority), the state slot never truncates (it is the smallest and most
  critical); below a floor the bar renders a minimal single slot.
- **MUST-FIX EC-4 (→ Q5):** the bench must measure the TICKING bar (1 Hz
  repaint), not a static render.

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q3 | Covered |
| Dependencies | Q4 | Covered |
| Tools | Q5 | Covered |
| Techniques | Q1, Q2 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

- Q1/Q2 done: layout + driver verdicts with citations.
- Q3/Q4/Q5 done: oracle set + deps verdict + evidence plan.
- Blueprint: 4 corners, ADRs final.

## Acceptance Criteria

- Every question `done`; citations resolve; blueprint ≥ SHIPPABLE_WITH_CAVEATS.

## Global Definition of Done

- Blueprint at `discoveries/blueprints/m14-status-bar-blueprint.md`
  consumable task-by-task by the M14 plan.
