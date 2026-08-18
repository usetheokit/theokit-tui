---
type: Parity Report
title: M18 — Yoga layout parity vs Ink
description: Real Yoga layout lands and every M17 deferral closes — 14 of 14 scenes byte-identical to Ink, plus a separate SGR byte-parity check on the coloured cell grid.
tags: [renderer, parity, layout, yoga, milestone, m18]
resource: "file:tests/renderer/parity-corpus.test.tsx"
sources:
  - id: m18-report
    resource: "git:9fd7eb1:docs/renderer/m18-parity-report.md"
    last_modified: 2026-07-08
  - id: baseline
    resource: "file:benchmarks/baselines/renderer-layout-baseline.json"
generated:
  by: claude-code/opus-5
  at: 2026-08-06
status: stable
---

**Milestone:** M18 (Yoga layout + Box/Text parity) · **Plan:** `m18-yoga-layout` ·
**ADR:** D5 (screen-comparison gate) · **Date:** 2026-07-08

Method: each scene rendered through Ink (`ink-testing-library`, baseline) **and**
our renderer (`createRenderer` over `@xterm/headless`); the **plain-text** layouts
(SGR stripped) are compared line by line, plus a separate **SGR byte-parity**
check (`sgr_color_bytes_match_ink`) on the coloured cell grid. Gate executed in
CI by `tests/renderer/parity-corpus.test.tsx`. **DoD: ≥ 90% of scenes byte-identical.**

# On the DoD wording ("existing snapshot corpus")

The DoD said "≥ 90% of the existing component snapshot corpus passes unchanged".
The 40 `.snap` snapshots are **Ink-rendered ANSI frames** — they cannot be diffed
directly against our output (our `@xterm/headless` readback normalizes SGR, and
the snapshots bake in Ink's exact escape ordering). Per ADR D5 the gate was
re-scoped to a **screen-comparison proxy**: 14 representative scenes rendered
through both engines and compared on the emulator screen. This is **stronger per
scene** than a raw snapshot diff, though narrower in count; a vacuity guard
asserts non-empty output on both sides. The rationale is generalised in
[Ink parity gate](/concepts/ink-parity-gate.md).

# Result: 14 / 14 (100%) — PASS + SGR byte-parity verified

11 corpus scenes + 3 breadth scenes (flex-grow distribution, justify-content
space-between, text wrap). `sgr_color_bytes_match_ink` separately confirms our
coloured cell-grid output is byte-identical to Ink for a two-colour `Text` row —
SGR parity by construction, sharing Ink's chalk transform +
`@alcalzone/ansi-tokenize`.

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

**Every scene is byte-identical to Ink**, exceeding the ≥ 90% DoD. The gaps
[M17](/renderer/skeleton-parity.md) listed as deferred — nested-column-in-row,
multi-line rows, padding, width/wrap, borders — are **all correct** under real
Yoga layout. That was the entire point of M18.

An earlier draft of this gate showed a `chat message` divergence (a trailing
space after the `✦` icon). That was a **test-harness bug**: the scene passed
`content=` instead of the component's `children` prop, so the message body never
rendered and the readback compared only the icon row. With the correct props the
scene matches Ink exactly. The renderer itself never diverged; the
ambiguous-width concern is retained as a watch item below.

# Still deferred beyond M18

- **SGR byte-parity** — text colour is **verified** (`sgr_color_bytes_match_ink`).
  The layout gate strips SGR to isolate layout; broader SGR coverage (bold / dim /
  inverse across every component) rides on the same by-construction mechanism and
  is spot-checked, not exhaustively swept, at M18.
- **Ambiguous-width glyphs** (watch item) — `string-width` counts some symbols
  (e.g. `✦`) as width 2 while a terminal renders them at width 1. No corpus scene
  surfaces a visible difference, but a residual wide-char placeholder could leave
  an invisible trailing space in some cases; revisit in M19/M20 by aligning the
  width table with the emulator.
- **`overflow` / clip** — no shipped component uses it (`output-grid.ts` omits
  clips — YAGNI).
- **`sanitizeAnsi`** — pass-through for M18 (corpus text is SGR-only, never raw
  control codes).

The full public component surface was carried onto the engine next, at
[M20](/renderer/component-parity.md).
