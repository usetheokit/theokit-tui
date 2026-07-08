---
slug: m17-renderer-skeleton
milestone_id: M17
created_at: 2026-07-08
question: How do we build a custom react-reconciler host + differential CSI-2026 output engine (the pi lessons) whose walking skeleton renders a React <Text> tree byte-parity with Ink — testable against a REAL terminal emulator (@xterm/headless)?
---

# Discovery Plan: m17-renderer-skeleton

## Context

V4 program (ADR 0003): own renderer keeping React. M17 is the walking
skeleton + deep discover. Fase A findings: ink's engine splits into
`reconciler.ts` (419 lines — the react-reconciler host config, pinned
`react-reconciler ^0.33.0` + `yoga-layout ~3.2.1`), `dom.ts` (295 — the
node tree), `renderer.ts` (77) + `render-node-to-output.ts`; pi's engine
is ONE class (`tui.ts` 1714 lines) with request-coalesced rendering
(`renderRequested`/`renderTimer`), a `fullRender(clear)` path with logged
reasons and differential line updates, everything wrapped in CSI-2026
(`\x1b[?2026h/l`); pi TESTS against `@xterm/headless` via a 218-line
`virtual-terminal.ts` harness — a REAL emulator as the oracle, not a fake
stdout. Our M12-M16 cycles established the bench/oracle discipline the
skeleton must ship with.

## Objective

Blueprint locking: the react-reconciler host-config subset for a
Text-only skeleton, the output engine design (line diff + full-render
fallbacks + CSI-2026), the @xterm/headless harness shape, the byte-parity
gate vs Ink, and the bench design (frames + bytes-written).

## In-Scope / Out-of-Scope

**In:** reconciler host for Text-only trees; line-diff output engine +
CSI-2026; @xterm/headless harness; parity gate; opt-in entry
`src/renderer/` (zero impact on the shipped Ink path).
**Out:** Yoga/flexbox (M18); Box/borders/wrapping (M18); input (M19);
Static/scrollback (M20); images (M21); ANY change to the public Ink-based
components.

## ADRs

### D1 — react-reconciler host, minimal mutation-mode config (preliminary)

**Decision shape:** pin `react-reconciler ^0.33.0` (Ink 7's version — the
API churn risk collapses to a known-good surface); mutation mode;
Text-only host types (`tui-text`, raw text nodes); commit → layout-free
line assembly → output engine.
**Alternatives:** newer reconciler (API churn risk the M17 risk register
names); react-dom/server re-render (no incremental commits).
**Consequences:** Q1 must extract Ink's host-config essentials (which of
the ~40 hooks matter for mutation mode) and pi's commit→render bridge
equivalent.

### D2 — Output engine: line diff + reasoned full-render fallbacks + CSI-2026 (preliminary)

**Decision shape:** keep `previousLines[]`; per-frame compute newLines;
strategies: (a) diff-in-place when height stable, (b) append-only fast
path, (c) `fullRender(clear)` on width change/overflow with a LOGGED
reason (pi's observability idiom); every write wrapped in
`\x1b[?2026h … \x1b[?2026l`.
**Alternatives:** always-full-render (flicker, bytes); cell-grid diff
(xterm-level complexity — YAGNI at skeleton).
**Consequences:** Q2 extracts pi's exact strategy selection + edge cases
(resize, scrollback overflow, cursor restore).

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad) | Fase B (deep) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | Ink's reconciler host config: which HostConfig hooks are load-bearing for mutation mode (createInstance/appendChild/commitUpdate/resetAfterCommit…), how the commit phase triggers render, and what a TEXT-ONLY subset needs | techniques | `.claude/knowledge-base/references/ink/src/reconciler.ts` (419), `dom.ts` (295) | done (files mapped) | Read both end-to-end; list the minimal hook set | Host-config recipe — citations |
| Q2 | pi's output engine: render coalescing (renderRequested/renderTimer), the diff strategy selection, fullRender(clear) triggers + reason logging, CSI-2026 buffer assembly, cursor show/hide, resize handling | techniques | `.claude/knowledge-base/references/pi/packages/tui/src/tui.ts:293-1500` | done (hotspots located) | Read the render region end-to-end | Engine recipe — citations |
| Q3 | Oracle set: @xterm/headless harness (pi's virtual-terminal.ts — write stream into a real emulator, read screen state), parity gate design (same React tree → Ink vs ours → same FINAL SCREEN), diff-strategy unit oracles, teardown/restore oracles; snapshot budget | tests | `.claude/knowledge-base/references/pi/packages/tui/test/virtual-terminal.ts` (218), our test idioms | done | Read the harness end-to-end; design ours | Harness + oracle set — citations |
| Q4 | Deps verdict: react-reconciler (^0.33.0, Ink-pinned) + @xterm/headless (devDep, pi-proven) — CVE/maintenance check via the deps-audit discipline; NO chalk/yoga at M17 | deps | our `package.json`, ink's + pi's manifests | done | Confirm versions + audit | Rule 9 verdict — citations |
| Q5 | Evidence: bench design — frames/sec AND bytes-written-per-frame vs Ink on the same skeleton scene (the CSI-2026 + diff win must be MEASURED, not claimed); example shape (`examples/renderer-skeleton.tsx`); parity report artifact | tools | our `benchmarks/` harness conventions, pi's test/chat-simple.ts | done | Design bench modes + parity artifact | Evidence plan — citations |

## Edge-case annotations (MUST-FIX absorbed)

- **MUST-FIX EC-1 (→ Q2/Q3):** terminal RESIZE mid-render — pi falls back
  to fullRender with a reason; the skeleton must restore a sane screen
  (oracle: resize the headless emulator mid-scene).
- **MUST-FIX EC-2 (→ Q2):** unmount/teardown MUST restore cursor
  visibility + leave the screen consumable (pi's stop() contract) — a
  crashed TUI that eats the cursor is the classic renderer bug.
- **MUST-FIX EC-3 (→ Q3):** CSI-2026 on terminals WITHOUT support — the
  sequences are ignored gracefully (they are private-mode toggles), but
  the harness must verify content parity with and without the wrap.
- **MUST-FIX EC-4 (→ Q1):** React 19 concurrent-mode commits (the M10
  StrictMode lesson: verify empirically, never assume from docs).
- **MUST-FIX EC-5 (→ Q5):** the bytes-written bench must count RAW stream
  bytes (the diff win IS fewer bytes) — frames alone hide it.

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q3 | Covered |
| Dependencies | Q4 | Covered |
| Tools | Q5 | Covered |
| Techniques | Q1, Q2 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

- Q1/Q2 done: host-config + engine recipes with citations.
- Q3/Q4/Q5 done: harness design + deps verdict + evidence plan.
- Blueprint: 4 corners, ADRs final.

## Acceptance Criteria

- Every question `done`; citations resolve; blueprint ≥ SHIPPABLE_WITH_CAVEATS.

## Global Definition of Done

- Blueprint at `discoveries/blueprints/m17-renderer-skeleton-blueprint.md`
  consumable task-by-task by the M17 plan.
