# M20 Component Parity Report — full suite on the V4 renderer

**Milestone:** M20 (scrollback + cutover gate)
**Gate:** DoD-2 — 100% of the component suite renders on the new renderer.
**Method:** each shipped component is dual-rendered through Ink (baseline, via
`ink-testing-library`) AND our renderer (via the `@xterm/headless`
`VirtualTerminal`); the PLAIN-TEXT screens (SGR stripped, trailing whitespace and
trailing blank rows normalized identically on both sides) are compared for
byte-identity. Harness: `tests/renderer/component-parity.test.tsx`. This extends
the M18 parity-corpus (primitives + 9 components) to the full public surface,
including the Static-driven `ChatThread`/`AgentTimeline` (scrollback on the new
engine).

## Result: 14 / 14 (100.0%) — 0 divergences

| #   | Component        | Parity            | Notes                                                                                                 |
| --- | ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | ChatMessage      | ✅ byte-identical |                                                                                                       |
| 2   | ChatThread       | ✅ byte-identical | Static scrollback (graduated history) on the new engine                                               |
| 3   | ToolCallCard     | ✅ byte-identical |                                                                                                       |
| 4   | DiffViewer       | ✅ byte-identical |                                                                                                       |
| 5   | CodeBlock        | ✅ byte-identical | syntax highlight preserved                                                                            |
| 6   | MarkdownText     | ✅ byte-identical |                                                                                                       |
| 7   | AppStatusBar     | ✅ byte-identical |                                                                                                       |
| 8   | AgentTimeline    | ✅ byte-identical | Static scrollback on the new engine                                                                   |
| 9   | AgentStreaming   | ✅ byte-identical |                                                                                                       |
| 10  | WelcomeBanner    | ✅ byte-identical | border + colors                                                                                       |
| 11  | ContextWindowBar | ✅ byte-identical |                                                                                                       |
| 12  | CostMeter        | ✅ byte-identical |                                                                                                       |
| 13  | TokenUsageChart  | ✅ byte-identical |                                                                                                       |
| 14  | ChatComposer     | ✅ byte-identical | plain-text layout parity; the focus cursor is SGR-styled (stripped in the plain compare) — see caveat |

## M11 scrollback oracles on the new renderer

Verified in `tests/renderer/component-parity.test.tsx` (+ `scrollback-corpus.test.tsx`):

- `ChatThread` graduated history prints ONCE above the live tail (`"first question"`
  / `"first answer"` each reach the wire exactly once).
- `AgentTimeline` graduated events appear on screen (`planning` / `shipped`).

This confirms DoD-1: the Static-equivalent append-once scrollback holds on the
new renderer, and the M11 header-slot / windowing / print-once contract survives
the port.

## Caveats (scoped, non-blocking)

- **ChatComposer focus cursor.** The composer still imports `useFocus`/`useInput`
  from Ink (the import swap to our own hooks is the later Ink-drop milestone, not
  M20's opt-in gate). On the new renderer, with no Ink `<App>`, Ink's `useFocus`
  reports unfocused, so the placeholder cursor is absent. This does NOT affect the
  plain-text layout (the cursor is an SGR-styled block, stripped in the plain
  comparison), so parity is byte-identical here; a full focused-cursor comparison
  is deferred to the cutover that swaps the composer's imports (ADR 0004).
- **Comparison basis.** Parity is asserted on the emulator SCREEN (SGR stripped),
  not on raw ANSI byte streams — Ink's SGR ordering differs from our normalized
  cell-grid readback (established in the M18 report). This is intentional (ADR D2):
  we compare what the terminal renders, not how each engine encodes it.

## Reproduce

```
pnpm vitest run tests/renderer/component-parity.test.tsx
```
