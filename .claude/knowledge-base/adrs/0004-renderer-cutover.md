# ADR 0004 — V4 renderer cutover policy

- **Status:** Proposed (awaiting owner sign-off — the drop-Ink call is the human's)
- **Date:** 2026-07-08
- **Milestone:** M20 (scrollback + cutover gate)
- **Supersedes:** none (extends ADR 0003 — "V4 own renderer")
- **Deciders:** project owner (sign-off pending)

## Context

M17–M20 built a custom terminal renderer as an incremental, opt-in replacement
for Ink: a react-reconciler host (M17), Yoga layout + differential CSI-2026 engine
(M18), an input stack (M19), and Static scrollback + the focus manager (M20). As
of M20 the evidence is in:

- **Parity (DoD-2):** 16 / 16 shipped components render **byte-identical** to Ink
  on the new renderer (`docs/renderer/m20-parity-report.md`).
- **Scrollback (DoD-1):** the M11 header-slot / windowing / print-once oracles pass
  on the new engine; graduated history is written once above the live frame. The
  live frame is positioned relative to a tracked cursor row, so scrollback stays
  correct even after the terminal scrolls (M20 review B1 fix).
- **Performance (DoD-3):** on a streaming `ChatThread`, V4 writes **~20× fewer
  bytes** (1 063 vs 21 840); ms/frame at parity with Ink
  (`docs/renderer/m20-comparative-bench.md`). The bytes ratio is the portable
  signal.

The renderer is currently reachable ONLY via the `./renderer` subpath export; the
package root still ships the Ink-backed components. Nothing forces a cutover — the
question is what the DEFAULT should be and when (if ever) Ink is removed.

## Decision drivers

- **Reversibility.** Dropping Ink is irreversible within a major version; the
  evidence that justifies it only just landed (M20). Insufficient soak.
- **Consumer safety.** External consumers depend on the Ink-backed root today;
  flipping the default silently changes their runtime.
- **Residual gaps.** The components still import Ink's `useFocus`/`useInput`/`Box`/
  `Text`/`Static`; the import swap to our own hooks/primitives is not done (it is
  the "Ink-drop" work, distinct from "V4 renders everything"). The composer's
  focus cursor parity (M20 caveat) is only closed by that swap.
- **95%-confidence rule.** We are not yet 95% confident that no consumer scenario
  regresses under a default flip — so we do not flip.

## Considered options

### Option A — Conservative (CHOSEN)

Ink stays the **default and the fallback**. V4 remains **opt-in** via the
`./renderer` subpath (and, when wired, a `THEO_TUI_ENGINE=v4` switch). The
irreversible "remove Ink" step is **deferred to a future major** and gated on a
SECOND owner-signed ADR after a real soak period. No consumer is affected today.

- **Pros:** zero risk to consumers; reversible; the drop decision waits for soak
  evidence, not just parity evidence; honors the 95% rule.
- **Cons:** two rendering paths coexist longer (maintenance surface); the byte-win
  is opt-in until the flip.

### Option B — Flip the default to V4 now, keep Ink as fallback

Root components render through V4 by default; `THEO_TUI_ENGINE=ink` restores Ink.

- **Pros:** consumers get the byte-win immediately.
- **Cons:** silently changes every consumer's runtime on upgrade; the Ink-drop
  import swap (focus/cursor) is not done, so a real behavior gap ships as default;
  insufficient soak. **Rejected.**

### Option C — Drop Ink at M20

Remove the Ink dependency; ship V4 only.

- **Pros:** single path; smallest dependency tree.
- **Cons:** irreversible in the milestone that only just produced the parity
  evidence; the components still import Ink primitives (would require the full
  import swap first); no soak. **Rejected.**

## Decision

Adopt **Option A**. Concretely:

1. Ink remains the default renderer and the guaranteed fallback.
2. V4 stays opt-in via the `./renderer` subpath; a `THEO_TUI_ENGINE=v4` opt-in may
   be wired in a follow-up without changing the default.
3. The Ink-drop (swap component imports to our `Box`/`Text`/`Static`/`useFocus`/
   `useInput`/`useStdout`, then remove the Ink dependency) is a SEPARATE future
   milestone, gated on:
   - a soak period of real opt-in usage with no parity regression, and
   - a second ADR signed by the project owner explicitly approving the removal.
4. Until then, both paths are maintained; every new component ships parity on both.

## Consequences

- **Positive:** no consumer regression; the cutover remains reversible; the drop
  decision is made on soak evidence, not just parity; the 21× byte-win is available
  today to anyone who opts into `./renderer`.
- **Negative:** two rendering paths coexist (dual maintenance); the byte-win is not
  the default yet; the composer focus-cursor parity gap persists until the import
  swap.
- **Follow-ups:** wire the `THEO_TUI_ENGINE` switch; do the import swap behind the
  opt-in; schedule the soak; write the drop-Ink ADR for owner sign-off.

## Owner sign-off

> The decision to REMOVE Ink (Option C, a future major) is explicitly reserved for
> the project owner and is NOT taken here. This ADR only fixes the conservative
> opt-in policy for M20.

- [ ] Owner approves Option A as the M20 cutover policy — _signature / date:_ ______
