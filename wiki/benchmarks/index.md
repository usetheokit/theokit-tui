# Benchmarks

Measured records, and the baselines the test suite pins so a regression cannot
land silently.

- [TTFATT](/benchmarks/ttfatt.md) — time-to-first-agent-turn-in-terminal, the
  project's north-star adoption metric, measured against the published package.
- [M20 comparative bench](/benchmarks/comparative-bench.md) — Ink vs the V4
  renderer on one streaming workload, both axes, symmetric timing.
- [Benchmark baselines](/benchmarks/baselines.md) — the 13 pinned JSON fixtures,
  which bench writes each, and which contract test guards it.
