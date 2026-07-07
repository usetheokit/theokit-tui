# Edge-case review: m7-stream-adapter (fresh-eyes agent, 2026-07-07)

**Plan:** `.claude/knowledge-base/plans/m7-stream-adapter-plan.md`
**Verdict:** 8 MUST-FIX + 4 SHOULD — ALL absorbed into the plan on 2026-07-07.

## MUST-FIX (absorbed)

- **EC-1 — live message becomes NON-TAIL on interleaved tool folds** (the plan
  contradicted itself and the M3 only-the-tail-replaceable contract; an open live
  message could even graduate into `<Static>` — verified against installed Ink —
  freezing partial text in scrollback). RESOLUTION: **close-on-effectful-fold** —
  any effectful non-message fold (tool append/upsert, thinking graduation) finalizes
  the open live message at its buffer + clears `liveMessageId`; the next delta opens
  `msg-${++seq}` (gemini split-message parity). TDD row pinned:
  `delta("he") → toolRunning → delta("llo")` ⇒ `[msg-1:"he", tool, msg-2:"llo"]`.
- **EC-2 — `done` (and cancel's terminal action) with non-terminal tools left a
  frozen spinner forever.** RESOLUTION: done marks every non-terminal tool `failed`
  (same rule as error). TDD row pinned.
- **EC-3 — events after `status:"error"` resurrected the stream (only after-done was
  guarded).** RESOLUTION: drop-after-TERMINAL (`done | error`) — one guard, TDD row.
- **EC-4 — `__reset__` routed through the public reducer would NO-OP (the unknown→
  no-op contract) — the flagship StrictMode fix silently dead.** RESOLUTION: the hook
  uses an INTERNAL wrapper reducer handling reset; the public reducer/union never see
  it (absence noted in D8).
- **EC-5 — `liveMessageId` lifecycle unpinned (second delta run could resurrect the
  finalized msg-1).** RESOLUTION: clears on finalize/done/error/close-on-tool; TDD
  row `delta→assistant→delta` ⇒ msg-2 opened, msg-1 untouched.
- **EC-6 — the remount test was toothless (fresh useReducer instance always passes).**
  RESOLUTION: real `<StrictMode>` wrapper test (multi-shot + single-shot instance
  variants); the reset is proven by the factory-restart test; D4 reworded.
- **EC-7 — inline-arrow factory = restart livelock (new identity per render).**
  RESOLUTION: Drawbacks row + source-param hoist/memoize doc (the M6 hoist-note
  precedent).
- **EC-8 — the example's 0ms piped unmount races the real-hook fold (agent.tsx
  precedent renders a PRE-BUILT scene — does not transfer).** RESOLUTION: the demo
  unmounts on `status === "done"` (deterministic effect, no timer).

## SHOULD (absorbed)

- **EC-9** — `tool-anon-${seq}` could collide with a producer `call_id: "anon-N"` →
  anon prefix changed to the non-overlapping `tool-#${seq}` (`#` cannot appear in a
  namespaced literal collision).
- **EC-10** — thinking graduation triggers only on EFFECTFUL non-thinking folds
  (pure no-ops never graduate); `task`/`thinking-completed` added to the no-op row
  (a `task.text` must not fold as thinking).
- **EC-11** — documented drops: assistant `tool_use` blocks (lifecycle comes from
  `tool_call` events) and fine `tool-call-*` updates (camelCase — onDelta-only
  consumers get no tool cards in v0); only-tool_use case added to the mint-empty row.
- **EC-12** — `isShellEnvelope` requires string-when-present stdout/stderr;
  `{stdout: 42}`/`{stderr: {}}` added to the negative row.

## CONSIDERED-OK (verified by the reviewer)

Spawn budget 11+1=12 exact; snapshot budget 1 ≤ 2; tripwire sound under
`exactOptionalPropertyTypes` (casts bypass excess-property checks; tests/ rides
`pnpm typecheck`); seq/namespace wording consistent (EC-9 the only hole);
InteractionUpdate has no field collisions; D5 scenario-2 covered by reset (once
EC-4 lands); same-source rerender un-pinned acceptably; cancel→new-source recovery
structural; the reconnect port is sound.
