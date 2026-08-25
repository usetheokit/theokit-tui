---
type: Benchmark
title: M20 comparative benchmark — Ink vs the V4 renderer
description: One streaming workload through both engines with symmetric timing — ~20× fewer bytes written for the differential engine, and ms/frame at parity. The bytes ratio is the portable signal.
tags: [benchmark, renderer, performance, ink, m20]
resource: "file:packages/tui/benchmarks/comparative.bench.tsx"
sources:
  - id: m20-bench
    resource: "git:9fd7eb1:docs/renderer/comparative-bench.md"
    last_modified: 2026-07-08
  - id: baseline
    resource: "file:packages/tui/benchmarks/baselines/comparative-baseline.json"
generated:
  by: claude-code/opus-5
  at: 2026-08-06
status: stable
---

**Milestone:** M20 (scrollback + cutover gate) · **Gate:** DoD-3 — full
comparative bench, both engines, regressions with citable causes.
**Harness:** `benchmarks/comparative.bench.tsx` → `benchmarks/baselines/comparative-baseline.json`.
**Contract test:** `tests/bench-banner-baseline.test.ts › m20_comparative_baseline_contract`.

# Workload

The same **30-message `ChatThread`** rendered through an initial paint plus **40
streaming-update frames** (the last message grows one char per frame — the M1
streaming contract) on BOTH engines. `FORCE_COLOR=1`, 1 warmup + **5 measured
runs**, mean ± std_dev. Load at start recorded and gated (`< 4`).

# Results (load 2.80, 5 runs, symmetric timing)

| Engine                                                     | ms / update-frame | bytes written (whole run) |
| ---------------------------------------------------------- | ----------------- | ------------------------- |
| **V4** (our layout + differential CSI-2026 engine)         | **2.533 ± …**     | **1 063 ± 0**             |
| **Ink** (real `render` → byte-counting stdout, log-update) | 2.579 ± …         | 21 840 ± 0                |

Exact ms std_dev lives in the baseline JSON. Both engines mount BEFORE the timer,
so ms measures only the 40 update frames — symmetric.

## Headline

- **Bytes written: ~20× fewer** (1 063 vs 21 840) on this streaming workload. This
  is the [differential engine](/concepts/differential-renderer.md)'s core
  advantage — Ink's `log-update` rewrites the entire live-frame region on every
  streaming frame, while our CSI-2026 engine rewrites only the changed rows (here,
  just the growing tail line). On a real streaming turn this is the difference
  between a flicker-prone full repaint and a single-row patch. **This ratio is the
  portable signal; the absolute counts are workload- and hardware-specific.**
- **ms/frame: at parity** (2.533 vs 2.579, within noise) once timing is symmetric.
  The two engines are in the same wall-clock class; the decisive, honest axis is
  **bytes**, not ms. An earlier asymmetric measurement over-credited V4 on ms by
  charging it for its mount — corrected here per review L1. (The "~6× faster"
  figure in the [M17 report](/renderer/skeleton-parity.md) predates that
  correction.)

## Two axes, both paths

The win is a **bytes** win, not a **ms** win. Measuring only ms/frame would have
hidden the actual advantage AND, when measured asymmetrically, could overstate it.
The bench records both and times them symmetrically. The `bytes_written` std_dev
is 0 because the byte count is deterministic for a fixed workload (the engine is
not time-dependent); the ms std_dev reflects normal scheduler jitter.

# Regressions

None. On both axes V4 meets or beats Ink on this workload. No citable regression
cause to record.

# Methodology / reproduce

```sh
FORCE_COLOR=1 pnpm tsx benchmarks/comparative.bench.tsx          # full (5 runs)
FORCE_COLOR=1 pnpm tsx benchmarks/comparative.bench.tsx --smoke  # 1 run (CI)
```

- V4 bytes are counted by a `ByteTerminal` (the engine's `write` sink).
- Ink bytes are counted by a `ByteStdout` passed to Ink's real `render` — this is
  the actual ANSI Ink emits (log-update erase + redraw), not an approximation.
- Both engines render the identical React element each frame; only the host
  differs. Numbers are hardware-specific (see the JSON `hardware` field) — treat
  the RATIO as the portable signal, not the absolute counts.

The baseline this writes is guarded like every other; see
[Benchmark baselines](/benchmarks/baselines.md).
