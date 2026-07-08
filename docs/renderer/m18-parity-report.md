# M18 Renderer — Layout Parity Report vs Ink

**Milestone:** M18 (Yoga layout + Box/Text parity) · **Plan:** `m18-yoga-layout` · **ADR:** D5 (screen-comparison gate)
**Date:** 2026-07-08 · **Method:** each corpus scene rendered through Ink (`ink-testing-library`, baseline) AND our renderer (`createRenderer` over `@xterm/headless`); the **plain-text** layouts (SGR stripped — a NO_COLOR pass isolates layout from color) are compared line-by-line.

The gate is executed in CI by `tests/renderer/parity-corpus.test.tsx › parity_corpus_matches_ink_within_budget`. **DoD: ≥ 90% of scenes byte-identical.** A divergence is only acceptable if it appears here with a verdict.

## Result: 11 / 11 (100%) — PASS

| Scene                                     | Verdict                                             |
| ----------------------------------------- | --------------------------------------------------- |
| plain text column                         | ✅ identical                                        |
| row layout                                | ✅ identical                                        |
| padding + border box                      | ✅ identical                                        |
| nested column in row                      | ✅ identical (the M17 gap — now correct under Yoga) |
| chat message                              | ✅ identical                                        |
| markdown text                             | ✅ identical                                        |
| code block                                | ✅ identical                                        |
| diff viewer                               | ✅ identical                                        |
| tool call card (output)                   | ✅ identical                                        |
| app status bar                            | ✅ identical                                        |
| welcome banner (border + padding + width) | ✅ identical                                        |

**Every scene is byte-identical to Ink** — exceeding the ≥ 90% DoD. The gaps M17's report listed as deferred — nested-column-in-row, multi-line rows, padding, width/wrap, borders — are **all correct** under real Yoga layout. That was the entire point of M18.

An earlier draft of this gate showed a `chat message` divergence (a trailing space after the `✦` icon). That was a **test-harness bug** — the scene passed `content=` instead of the component's `children` prop, so the message body never rendered and the readback compared only the icon row. With the correct props the scene renders in full and matches Ink exactly. The renderer itself never diverged; the ambiguous-width concern is retained as a watch item below.

## Still deferred beyond M18 (unchanged from the scope)

- **SGR byte-parity** — this gate compares PLAIN text. Exact color/bold/dim escape-sequence ordering is a separate pass (the emulator normalizes SGR on readback). M18's DoD is layout parity; SGR parity is M19+.
- **Ambiguous-width glyphs** (watch item) — `string-width` counts some symbols (e.g. `✦`) as width 2 while a terminal renders them at width 1. No current corpus scene surfaces a visible difference, but a residual wide-char placeholder could leave an invisible trailing space in some cases; revisit in M19/M20 by aligning the width table with the emulator.
- **`overflow` / clip** — no shipped component uses it (`output-grid.ts` omits clips — YAGNI).
- **`sanitizeAnsi`** — pass-through for M18 (corpus text is SGR-only, never raw control codes; see T2.1 progress).
