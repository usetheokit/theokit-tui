---
type: Test Fixture Set
title: Benchmark baselines
description: The 13 pinned baseline JSON files under benchmarks/baselines/ — which bench writes each, which contract test guards it, and the stack-provenance rule that keeps a number from outliving the stack that produced it.
tags: [benchmark, fixtures, tests, provenance]
resource: "file:packages/tui/benchmarks/baselines/"
sources:
  - id: provenance-test
    resource: "file:packages/tui/tests/benchmarks/stack-provenance.test.ts"
  - id: baseline-test
    resource: "file:packages/tui/tests/benchmarks/baseline.test.ts"
  - id: banner-test
    resource: "file:packages/tui/tests/benchmarks/banner-baseline.test.ts"
generated:
  by: claude-code/opus-5
  at: 2026-08-06
status: stable
---

# What they are

Each `*-baseline.json` under `benchmarks/baselines/` is a recorded benchmark run:
timings, byte counts, the machine's `hardware` field and the `stack` versions it
ran on. They are **test fixtures, not documentation** — three test files read
them, so moving or editing one is a test-visible act.

> **Location note.** These files lived under `docs/benchmarks/` until 2026-08-06,
> when `docs/` was converted into this bundle. They moved to
> `benchmarks/baselines/` — next to the benches that write them — rather than into
> the wiki, because a wiki is knowledge an agent reads and these are inputs a test
> asserts on. The bundle's `log.md` records the move.

# Who writes what, who guards what

| Baseline                | Written by                               | Guarded by                                                          |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `m0-chat-message`       | `benchmarks/chat-message.bench.tsx`      | `bench-baseline`, `bench-banner-baseline`, `bench-stack-provenance` |
| `m1-chat-thread`        | `benchmarks/chat-thread.bench.tsx`       | `bench-baseline`, `bench-stack-provenance`                          |
| `m2-tool-cards`         | `benchmarks/tool-cards.bench.tsx`        | `bench-baseline`, `bench-stack-provenance`                          |
| `m3-agent-timeline`     | `benchmarks/agent-timeline.bench.tsx`    | `bench-baseline`, `bench-stack-provenance`                          |
| `m4-diff-viewer`        | `benchmarks/diff-viewer.bench.tsx`       | `bench-baseline`, `bench-stack-provenance`                          |
| `m5-metrics`            | `benchmarks/metrics-footer.bench.tsx`    | `bench-baseline`, `bench-stack-provenance`                          |
| `m12-welcome-banner`    | `benchmarks/welcome-banner.bench.tsx`    | `bench-banner-baseline`                                             |
| `m14-status-bar`        | `benchmarks/app-status-bar.bench.tsx`    | `bench-banner-baseline`                                             |
| `m15-composer`          | `benchmarks/chat-composer.bench.tsx`     | `bench-banner-baseline`                                             |
| `m17-renderer-skeleton` | `benchmarks/renderer-skeleton.bench.tsx` | `bench-banner-baseline`                                             |
| `m18-renderer-layout`   | `benchmarks/renderer-layout.bench.tsx`   | `bench-banner-baseline`                                             |
| `m20-comparative`       | `benchmarks/comparative.bench.tsx`       | `bench-banner-baseline`                                             |
| `m21-editor`            | `benchmarks/editor.bench.tsx`            | `bench-banner-baseline`                                             |

# Stack provenance (M10 D3)

`tests/bench-stack-provenance.test.ts › baseline_records_stack_versions` asserts
that the six M0–M5 component baselines carry a `stack` block naming the versions
they were measured on:

```
stack.ink                  matches /^7./
stack.react                matches /^19./
stack.ink_testing_library  matches /^4./
```

The rule it enforces: **provenance is never implicit again.** A number measured on
ink 5 / react 18 must not silently keep vouching for behaviour on ink 7 / react 19
— the stack upgrade that motivated the
[0.11.0 TTFATT re-measure](/benchmarks/ttfatt.md) is exactly the event that would
otherwise invalidate them unnoticed.

# Regenerate

```sh
pnpm bench                                     # the full run.ts sweep
FORCE_COLOR=1 pnpm tsx benchmarks/<name>.bench.tsx   # one bench
```

Each bench `mkdir -p`s its output directory and writes the JSON with a trailing
newline. The files are excluded from lint (`eslint.config.js`) and from Prettier
(`.prettierignore`) so a regenerated fixture is never reformatted into a diff.

Two of these baselines carry the byte-cost evidence for the own renderer:
`m17-renderer-skeleton` ([M17](/renderer/skeleton-parity.md)) and
`m20-comparative` ([M20 comparative bench](/benchmarks/comparative-bench.md)).
