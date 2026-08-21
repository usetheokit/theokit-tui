---
type: Parity Report
title: M17 — renderer walking skeleton, byte-parity vs Ink
description: The first renderer milestone — parity is exact on plain column/row text, every wider layout behaviour is deferred to M18 with a per-row verdict, and the byte-cost case for the own engine is measured.
tags: [renderer, parity, milestone, m17]
resource: "file:packages/tui/tests/renderer/renderer.test.tsx"
sources:
  - id: m17-report
    resource: "git:9fd7eb1:docs/renderer/m17-parity-report.md"
    last_modified: 2026-07-08
  - id: baseline
    resource: "file:packages/tui/benchmarks/baselines/renderer-skeleton-baseline.json"
generated:
  by: claude-code/opus-5
  at: 2026-08-06
status: stable
---

**Milestone:** M17 (renderer walking skeleton) · **Plan:** `m17-renderer-skeleton` ·
**ADR:** D4 (parity artifact), 0003 (own renderer) · **Date:** 2026-07-08

Method: the same React tree rendered through Ink (`ink-testing-library`) and
through our renderer (`createRenderer` over `@xterm/headless` `VirtualTerminal`);
the emulator's rendered screen lines are compared, not the byte stream — see
[Ink parity gate](/concepts/ink-parity-gate.md).

The gate runs in CI as `src/renderer/renderer.test.tsx › parity_with_ink_on_text_scene`.
A divergence is acceptable only if it appears below **with a verdict**; a silent
divergence fails the gate.

# Scene 1 — column of `<Text>` rows (the M17 scope)

```tsx
<Box flexDirection="column">
  <Text>alpha</Text>
  <Text>beta</Text>
  <Text>gamma</Text>
</Box>
```

| Row | Ink     | Ours    | Verdict      |
| --- | ------- | ------- | ------------ |
| 0   | `alpha` | `alpha` | ✅ identical |
| 1   | `beta`  | `beta`  | ✅ identical |
| 2   | `gamma` | `gamma` | ✅ identical |

**Result: PASS — line-by-line identical.** This is the M17 DoD-4 gate, asserted
by `expect(ourLines).toEqual(inkLines)`.

# Known divergences — deferred, not silent

The skeleton assembles lines with a depth-first walk honouring Ink's
`props.style.flexDirection` (Box default `row`; root stacks as a column). It does
**not** run Yoga. Each row below is a known gap tracked to its milestone.

| Divergence                                                 | Ink behavior                                                        | Ours (M17)                                                             | Verdict                                                                             | Owner |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----- |
| Multi-line children in a `row` box                         | Yoga lays each child in its own column, wrapping/aligning per width | We concatenate children's inline text on one line                      | ⚠️ **DEFERRED → M18** (Yoga layout)                                                 | M18   |
| Nested column-in-row `<Box row><Box column>…</Box>…</Box>` | Yoga stacks the inner column, then lays it beside the sibling       | We flatten to one inline line (e.g. `["x1x2y"]` vs Ink `["x1y","x2"]`) | ⚠️ **DEFERRED → M18** — reachable today; renders inline, no error                   | M18   |
| Newline `\n` inside a `<Text>` within a `row`              | Yoga splits the run into stacked rows                               | We keep it inline (e.g. `["a"," bc"]` vs Ink `["ac","b"]`)             | ⚠️ **DEFERRED → M18** — reachable today; renders inline, no error                   | M18   |
| Content taller than the viewport `rows` (with scrollback)  | Yoga windows + pi tracks a relative cursor                          | Absolute `\x1b[{n};1H` positioning assumes content starts at row 1     | ⚠️ **DEFERRED → M18** (windowing) — single-column ≤ viewport is exact               | M18   |
| `padding` / `margin` / `gap`                               | Yoga inserts blank cells/rows                                       | Ignored (no spacing)                                                   | ⚠️ **DEFERRED → M18**                                                               | M18   |
| `width` / truncation / `wrap`                              | Yoga wraps or truncates to the measured box width                   | No wrapping — full string emitted                                      | ⚠️ **DEFERRED → M18**                                                               | M18   |
| SGR color / `bold` / `dimColor` on `<Text>`                | Emits the styled runs                                               | Text content only (color is not asserted in the skeleton gate)         | ⚠️ **DEFERRED → M18/M19**                                                           | M18   |
| `<Static>` / `<Transform>` / `<Spacer>`                    | Ink-specific components                                             | Not supported                                                          | ⛔ **OUT** (Ink-runtime only; app-composition uses Ink directly until parity lands) | —     |

The M17 gate deliberately restricts its asserted scene to plain column/row text
where parity is exact; the wider surface is M18's Yoga port. Every deferral above
was closed at [M18](/renderer/layout-parity.md), and the absolute-positioning
row was closed at [M20](/renderer/component-parity.md) by relative cursor
tracking.

# Byte-cost evidence (EC-5) — why the own renderer exists

From `benchmarks/baselines/renderer-skeleton-baseline.json` (load 3.78 < 4,
`FORCE_COLOR=1`), on an identical 200-line + 60-update script:

| Engine                      | Bytes written         | ms/frame (mean ± σ) |
| --------------------------- | --------------------- | ------------------- |
| Ink (full-frame log-update) | 584 472               | 47.97 ± 5.67        |
| Ours (differential)         | 20 000                | 7.87 ± 1.01         |
| **Delta**                   | **29.2× fewer bytes** | **~6× faster**      |

Ink rewrites the whole frame each commit; the differential engine rewrites only
the changed rows. Methodology, stated honestly: Ink bytes = sum of committed
frame byte-lengths; ours = real Terminal writes.

> **Read this alongside [M20's comparative bench](/benchmarks/comparative-bench.md).**
> The bytes ratio holds and is reproduced there. The "~6× faster" figure is _not_
> the project's timing claim: M20 mounts both engines before the timer and finds
> ms/frame **at parity** (2.533 vs 2.579). The decisive axis is bytes.
> See [Differential renderer](/concepts/differential-renderer.md).

The baseline JSON is pinned by a contract test — see
[Benchmark baselines](/benchmarks/baselines.md).
