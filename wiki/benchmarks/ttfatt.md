---
type: Benchmark
title: TTFATT — time-to-first-agent-turn-in-terminal
description: The north-star adoption measurement — wall-clock from npm install to a rendered agent turn in a fresh project, measured against the published registry artifact, not a local build.
tags: [benchmark, adoption, ttfatt, packaging, north-star]
resource: "file:wiki/benchmarks/ttfatt.md"
sources:
  - id: ttfatt-doc
    resource: "git:9fd7eb1:docs/ttfatt.md"
    last_modified: 2026-07-07
  - id: contract-test
    resource: "file:tests/package-contract.test.ts"
generated:
  by: claude-code/opus-5
  at: 2026-08-06
status: stable
---

**Package:** `@theokit/tui@0.10.0` — the REGISTRY artifact, not a local build.
**Date:** 2026-07-07 · Node v22.22.2 · npm 10.x · Linux 6.8 · warm npm cache.
**Target (roadmap north-star):** < 10 min.
**Measured: 16.3 s total** — install 13.7 s + first rendered agent turn 2.6 s.

> This document is pinned by `tests/package-contract.test.ts ›
ttfatt_record_exists_with_measurement`, which asserts both version records and a
> measurement are present. Editing it is a test-visible act.

# Method (reproduce)

Fresh empty directory; wall-clock from install start to a rendered turn:

```sh
mkdir ttfatt && cd ttfatt
npm init -y && npm pkg set type=module
time npm i @theokit/tui@0.10.0 react@18 tsx       # 13.7 s
# consumer.tsx: 25 lines — TheoTUIProvider + WelcomeBanner + AgentTimeline
# fed by useAgentStream over a 3-event scripted turn (tool running →
# completed(shell) → text-delta), the README quickstart shape.
time npx tsx consumer.tsx                          # 2.6 s
```

Rendered output (piped, exit 0):

```
╭──────────────────────────────────────────────────────────╮
│ Rehearsal v0.10.0                                        │
╰──────────────────────────────────────────────────────────╯
✓  vitest
   ok
✦ All green.
```

# Notes

- The consumer script IS the dogfood-path verification: a fresh project consuming
  the published package end to end (ROADMAP M8 DoD-1 consumer leg).
- The same run **pre-publish** (local tarball rehearsal) caught a REAL packaging
  bug before it reached the registry: the former `react "^18 || ^19"` peer range
  broke fresh installs (ink 5's reconciler × React 19) — fixed to `^18.2.0` in
  0.10.0.
- Human typing time (creating `consumer.tsx` from the README quickstart) is
  excluded; even at a leisurely 5 minutes it stays an order of magnitude under the
  10-minute target.

# 0.11.0 re-measure (ink 7 / react 19 stack — 2026-07-07)

`@theokit/tui@0.11.0` from the registry, same method (fresh dir,
`npm i @theokit/tui@0.11.0 react@19 tsx`, 25-line consumer): **5.4 s total**
(install 4.4 s + first rendered turn 1.0 s; warm cache). The 0.10.0 section above
documents the ink5/react18 line.

The ink 7 / react 19 stack this re-measure runs on is the same stack the component
baselines assert provenance against — see [Benchmark baselines](/benchmarks/baselines.md).
