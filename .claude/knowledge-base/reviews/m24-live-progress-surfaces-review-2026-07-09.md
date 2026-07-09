# Review — m24-live-progress-surfaces (2026-07-09)

**Verdict:** READY_TO_MERGE

## Method

Adversarial Staff-Engineer review of the M24 diff (`57092c9..HEAD`): timer
correctness (RISK-1), `isMotionEnabled` byte-identity, `notify`/`detectNotifyProtocol`
(RISK-2), TodoList keying, MultiStepProgress counter math, CollapsibleBlock
controlled/uncontrolled, AgentStreaming byte-identity, wiring triad + complexity +
purity. Plus `pnpm gates` (prettier, lint, typecheck, 1000 tests, build) run twice
consecutively.

## Findings (all resolved before merge)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| HIGH-1 | HIGH | `notify()` was an orphan public export — no caller (wiring-triad pillar a unmet); RISK-2 proven only against a mock sink. | `examples/live-turn.tsx` now calls `notify("build finished ✓")` on mount; the smoke test asserts the piped (non-TTY) run leaks NO OSC-9 sequence (`]9;`) — the RISK-2 guard proven end-to-end in a real subprocess. |
| HIGH-2 | HIGH | `shimmer` prop + `useShimmerPulse` shipped with zero behavioral test. | Added fake-timer shimmer oracles (dimColor `\x1b[2m` presence): pulses on/off across the 600ms tick under a TTY, never dims under reduced-motion or on a non-TTY. |
| LOW-1 | LOW | `notify()` writes `message` verbatim — an embedded BEL/ESC would corrupt the OSC-9 sequence. | Documented (matches the codex `osc9.rs` plain path; message is app-controlled). Doc note added; sanitize-upstream guidance. |

## Confirmed clean (verified by the reviewer)

- **isMotionEnabled byte-identity:** the WelcomeBanner delegation preserves the env/TTY/monochrome + rows/columns conjuncts and the mount-freeze; same `process.env` object.
- **AgentStreaming byte-identity:** no-opt-in callers render identically (18 existing tests unchanged); `dimPulse` spreads `{}` when off; `thought` wins over `phrases[0]`.
- **Toast timer:** one-shot keyed on `[durationMs]` — cleared on unmount + rescheduled only on `durationMs` change; `onDismiss` via ref never restarts the countdown. All three tested.
- **usePhraseCycler teardown:** clears on unmount and when `active` flips false; zero timers when motion off or ≤1 phrase.
- **MultiStepProgress counter:** empty → `0 of 0` (no NaN); `current` clamped; correct 1-indexed display.
- **TodoList replace-item:** memo-by-identity requires a new object (documented, tested); duplicate-id throw is caller-facing.
- **CollapsibleBlock:** controlled path does not mutate internal state; `onToggle` fires the correct next value.
- **detectNotifyProtocol:** multiplexer-check-first, non-TTY no-op, exact OSC-9/BEL bytes; module-internal.

## Evidence

- `pnpm gates` green twice consecutively (1000 tests). One transient subprocess-timeout flake under parallel load (an example smoke-test spawn) was re-run clean and is not a determinism defect.
- New pure modules (`motion.ts`, `notify.ts`) 100% branch-covered; complexity ≤10 (AgentStreaming refactored 18→≤10 via `usePhraseLine`/`resolvePrimaryLine` extraction).
- Every timer path fake-timer tested incl. the unmount-clears negative; reduced-motion → no cycle/pulse proven; `notify()` non-TTY no-op + multiplexer suppression proven end-to-end.
