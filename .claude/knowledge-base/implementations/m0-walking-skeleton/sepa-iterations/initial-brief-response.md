# SEPA Initial Brief Response — m0-walking-skeleton (2026-07-05)

Agent: general-purpose adopting .claude/agents/implement-m0-walking-skeleton-2026-07-05/sepa.md
(SEPA agent-registry hot-reload unavailable mid-session — adaptation logged, role contract identical)
SEPA session id: a77309973a185e007

## Findings (7 MAJOR, 0 CRITICAL) + main-session resolutions

1. [MAJOR] Ink ErrorBoundary swallows sync throws (ink/src/components/App.tsx:801) — EC-1 oracle
   `expect(renderIt).toThrow` unreachable through render().
   RESOLUTION: role guard is the FIRST statement of ChatMessage → direct function invocation
   `expect(() => ChatMessage({role:"system" as any, children:""})).toThrow(TypeError)` fires the
   guard before any hook call. Typed error + exact message still asserted.
2. [MAJOR] chalk^5 fixes color level at module import — vi.stubEnv can't strip ANSI for NO_COLOR test.
   RESOLUTION: NO_COLOR smoke becomes a SUBPROCESS integration test: execFileSync(tsx examples/basic.tsx,
   env {NO_COLOR:"1", FORCE_COLOR deleted}) asserting zero ESC bytes. Real-boundary test (better).
   Moves the smoke from src/chat-message.test.tsx to tests/no-color.integration.test.ts, exercised
   after T3.2 lands the example. Logged as plan deviation (test relocation, same behavior covered).
3. [MAJOR] T0.1 RED paradox (vitest needs package.json).
   RESOLUTION: bootstrap order — minimal manifest {name,version,type} + pnpm install devDeps first
   (toolchain bootstrap), THEN RED against missing invariant fields, GREEN completes manifest.
4. [MAJOR] TheoTheme text non-optional vs undefined-color-safe contradiction under exactOptionalPropertyTypes.
   RESOLUTION: lock `text: string | undefined` (explicit union, required key) — Ink Text color={undefined}
   renders terminal default. Documented in theme.tsx.
5. [MAJOR] helpers.tsx only lands T2.1 but T1.1 asserts frames.
   RESOLUTION: T1.1 uses a local 3-line one-tick await (documented temporary duplication);
   T2.1 REFACTOR extracts tests/helpers.tsx and migrates theme tests. Plan file declarations respected.
6. [MAJOR] eslint complexity<=10 oracle vacuous without the rule.
   RESOLUTION: eslint.config.js sets `complexity: ["error", 10]` explicitly (T0.2).
7. [MAJOR] Final Phase `pnpm bench` dirties committed baseline before /review.
   RESOLUTION: Final Phase runs full bench; if baseline JSON diff → commit `chore(bench): refresh baseline`.
   Clean tree guaranteed at /review.

Verdict: proceed to T0.1 — no loop-back to cycle-plan required.
