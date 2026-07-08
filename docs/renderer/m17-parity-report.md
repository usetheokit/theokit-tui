# M17 Renderer — Byte-Parity Report vs Ink

**Milestone:** M17 (renderer walking skeleton) · **Plan:** `m17-renderer-skeleton` · **ADR:** D4 (parity artifact), 0003 (own renderer)
**Date:** 2026-07-08 · **Method:** the SAME React tree rendered through Ink (`ink-testing-library`) and through our renderer (`createRenderer` over `@xterm/headless` `VirtualTerminal`); the emulator's rendered screen lines are compared, not the byte stream.

The parity gate is **executed in CI** by `src/renderer/renderer.test.tsx › parity_with_ink_on_text_scene`. A divergence is only acceptable if it appears in this report **with a verdict**; a silent divergence fails the gate.

## Scene 1 — column of `<Text>` rows (the M17 skeleton scope)

```tsx
<Box flexDirection="column">
  <Text>alpha</Text>
  <Text>beta</Text>
  <Text>gamma</Text>
</Box>
```

| Row | Ink | Ours | Verdict |
|---|---|---|---|
| 0 | `alpha` | `alpha` | ✅ identical |
| 1 | `beta` | `beta` | ✅ identical |
| 2 | `gamma` | `gamma` | ✅ identical |

**Result: PASS — line-by-line identical.** This is the M17 DoD-4 gate (byte-parity vs Ink on the skeleton's supported scene). Asserted by `expect(ourLines).toEqual(inkLines)`.

## Known divergences (scoped OUT of M17 — deferred, not silent)

The skeleton assembles lines with a depth-first walk, honoring Ink's `props.style.flexDirection` (Box default `row`; root stacks as a column). It does **not** run Yoga. The following diverge from Ink and are documented per the gate contract:

| Divergence | Ink behavior | Ours (M17) | Verdict | Owner |
|---|---|---|---|---|
| Multi-line children in a `row` box | Yoga lays each child in its own column, wrapping/aligning per width | We concatenate children's inline text on one line | ⚠️ **DEFERRED → M18** (Yoga layout) | M18 |
| `padding` / `margin` / `gap` | Yoga inserts blank cells/rows | Ignored (no spacing) | ⚠️ **DEFERRED → M18** | M18 |
| `width` / truncation / `wrap` | Yoga wraps or truncates to the measured box width | No wrapping — full string emitted | ⚠️ **DEFERRED → M18** | M18 |
| SGR color / `bold` / `dimColor` on `<Text>` | Emits the styled runs | Text content only (color is not asserted in the skeleton gate) | ⚠️ **DEFERRED → M18/M19** | M18 |
| `<Static>` / `<Transform>` / `<Spacer>` | Ink-specific components | Not supported | ⛔ **OUT** (Ink-runtime only; app-composition uses Ink directly until parity lands) | — |

Each deferred row is a **known gap**, tracked to its milestone. The M17 gate deliberately restricts its asserted scene to plain column/row text where parity is exact; the wider surface is M18's Yoga port.

## Byte-cost evidence (EC-5 — why the own renderer exists)

From `docs/benchmarks/m17-renderer-skeleton-baseline.json` (load 3.78 < 4, `FORCE_COLOR=1`), the identical 200-line + 60-update script:

| Engine | Bytes written | ms/frame (mean ± σ) |
|---|---|---|
| Ink (full-frame log-update) | 584 472 | 47.97 ± 5.67 |
| Ours (differential) | 20 000 | 7.87 ± 1.01 |
| **Delta** | **29.2× fewer bytes** | **~6× faster** |

Ink rewrites the whole frame each commit; the differential engine rewrites only the changed rows. The bytes gap is the concrete payoff of the strategy ladder (pi/tui, ADR D2). Methodology (honest): Ink bytes = sum of committed frame byte-lengths; ours = real Terminal writes — the terminal-write cost of each model on the same script.
