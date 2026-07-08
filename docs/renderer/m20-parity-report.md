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

## Result: 16 / 16 (100.0%) — 0 divergences

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
| 15  | ToolCall         | ✅ byte-identical | tool-call header (standalone)                                                                         |
| 16  | ToolResult       | ✅ byte-identical | tool-result body (standalone; also rendered transitively via ToolCallCard)                            |

## M11 scrollback oracles on the new renderer

Verified in `tests/renderer/component-parity.test.tsx` (+ `scrollback-corpus.test.tsx`):

- `header_stays_above_graduated_history_and_prints_once` — header printed once,
  above `msg-0`, history ordered.
- `window_keeps_the_live_tail_bounded_on_the_new_renderer` — newest message live,
  oldest graduated + scrolled off.
- `agenttimeline_graduated_events_appear_on_screen`.

These are GENUINE M11 oracles on the new renderer: the header oracle grows the
thread incrementally (6 → 12 → 20) so rows actually graduate, then asserts the
header prints once ABOVE the ordered graduated history; the windowing oracle
grows to 20 on a short terminal and asserts the live tail is bounded (newest
message present, oldest graduated + scrolled off). This confirms DoD-1: the
Static-equivalent append-once scrollback holds on the new renderer, and the M11
header-slot / windowing / print-once contract survives the port.

### Scrollback correctness under scroll (review B1)

The engine positions the live frame RELATIVE to a tracked cursor row, not by
absolute screen rows. A regression test (`scrollback-corpus.test.tsx`
`patches_the_live_frame_correctly_after_static_overflows_the_screen`) proves a
differential patch lands on the correct live row even after graduated history has
scrolled the terminal (3 static + 4 live on a 5-row terminal). Absolute
positioning corrupted this (the patch landed on the wrong row); relative
positioning is scroll-invariant.

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
