# M20 Comparative Benchmark — Ink vs V4 renderer

**Milestone:** M20 (scrollback + cutover gate)
**Gate:** DoD-3 — full comparative bench, both engines, regressions with citable causes.
**Harness:** `benchmarks/comparative.bench.tsx` → `docs/benchmarks/m20-comparative-baseline.json`
**Contract test:** `tests/bench-banner-baseline.test.ts` (`m20_comparative_baseline_contract`).

## Workload

The same **30-message `ChatThread`** rendered through an initial paint + **40
streaming-update frames** (the last message grows one char per frame — the M1
streaming contract) on BOTH engines, `FORCE_COLOR=1`, 1 warmup + **5 measured
runs**, mean ± std_dev. Load at start recorded and gated (`< 4`).

## Results (load 1.22, 5 runs)

| Engine                                                     | ms / frame        | bytes written (whole run) |
| ---------------------------------------------------------- | ----------------- | ------------------------- |
| **V4** (our layout + differential CSI-2026 engine)         | **2.374 ± 0.486** | **1 026 ± 0**             |
| **Ink** (real `render` → byte-counting stdout, log-update) | 2.732 ± 0.408     | 21 840 ± 0                |

### Headline

- **Bytes written: 21× fewer** (1 026 vs 21 840). This is the differential
  engine's core advantage — Ink's `log-update` rewrites the entire live-frame
  region on every streaming frame, while our CSI-2026 engine rewrites only the
  changed rows (here, just the growing tail line). On a real streaming turn this
  is the difference between a flicker-prone full repaint and a single-row patch.
- **ms/frame: ~13% faster** (2.374 vs 2.732), within one std_dev — the two engines
  are in the same performance class on wall-clock; the decisive axis is bytes.

### Two axes, both paths

The differential win is a **bytes** win, not primarily a **ms** win — measuring
only ms/frame would have hidden the actual advantage (EC precedent from M17). The
bench therefore records both. The `bytes_written` std_dev is 0 because the byte
count is deterministic for a fixed workload (the engine is not time-dependent);
the ms std_dev reflects normal scheduler jitter.

## Regressions

None. On both axes V4 meets or beats Ink on this workload. No citable regression
cause to record.

## Methodology / reproduce

```
FORCE_COLOR=1 pnpm tsx benchmarks/comparative.bench.tsx        # full (5 runs)
FORCE_COLOR=1 pnpm tsx benchmarks/comparative.bench.tsx --smoke  # 1 run (CI)
```

- V4 bytes are counted by a `ByteTerminal` (the engine's `write` sink).
- Ink bytes are counted by a `ByteStdout` passed to Ink's real `render` — this is
  the actual ANSI Ink emits (log-update erase + redraw), not an approximation.
- Both engines render the identical React element each frame; only the host
  differs. Numbers are hardware-specific (see the JSON `hardware` field) — treat
  the RATIO (21×) as the portable signal, not the absolute counts.
