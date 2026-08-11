---
type: Concept
title: Differential renderer (CSI-2026 engine)
description: The own rendering engine that rewrites only the changed terminal rows instead of repainting the whole frame, and the measured byte-cost argument that justifies it.
tags: [renderer, performance, architecture, v4]
sources:
  - id: m17-report
    resource: "git:9fd7eb1:docs/renderer/m17-parity-report.md"
    last_modified: 2026-07-08
  - id: m20-bench
    resource: "git:9fd7eb1:docs/renderer/m20-comparative-bench.md"
    last_modified: 2026-07-08
  - id: renderer-src
    resource: "file:src/renderer/"
generated:
  by: claude-code/opus-5
  at: 2026-08-06
status: stable
---

# What it is

`@theokit/tui` renders through its own terminal engine rather than delegating the
paint to Ink's `log-update`. Ink rewrites the entire live-frame region on every
commit; the differential engine computes the changed rows and rewrites only
those, synchronising the update with the terminal's synchronized-output mode
(CSI 2026).[^m17-report]

The engine is the _output_ half of the V4 renderer program; its _input_ half is
the ported key stack described in [M19 input stack](/renderer/m19-input-stack.md).
Layout is real Yoga, ported at M18 — see [M18 layout parity](/renderer/m18-layout-parity.md).

# Why it exists (the byte argument)

The payoff is **bytes written to the terminal**, not milliseconds. Two independent
measurements agree:

| Workload                                                  | Ink bytes | Ours   | Ratio           |
| --------------------------------------------------------- | --------- | ------ | --------------- |
| 200-line script + 60 updates (M17)[^m17-report]           | 584 472   | 20 000 | **29.2× fewer** |
| 30-message thread + 40 streaming frames (M20)[^m20-bench] | 21 840    | 1 063  | **~20× fewer**  |

On wall-clock the two engines are in the same class once the measurement is
symmetric: **2.533 ms vs 2.579 ms** per update frame at M20, within noise.[^m20-bench]
The M17 figure of "~6× faster" came from a harness that charged Ink for its
full-frame model on every commit; the M20 bench mounts both engines _before_
the timer and is the authoritative timing comparison.

$$
\text{bytes}_{\text{differential}} \;\propto\; \sum_{f} |\text{changed rows}(f)|
\qquad
\text{bytes}_{\text{full-frame}} \;\propto\; \sum_{f} |\text{frame}|
$$

On a streaming turn only the growing tail line changes, so the differential cost
collapses to a single-row patch while the full-frame cost stays constant per
frame. That is the difference between a flicker-prone repaint and a one-row
patch.

**Honest scope:** absolute counts are workload- and hardware-specific (the
baseline JSON records a `hardware` field). The _ratio_ is the portable signal.[^m20-bench]

# How the frame is positioned

The engine positions the live frame **relative to a tracked cursor row**, not by
absolute screen rows. Absolute positioning (`\x1b[{n};1H`) was the M17 skeleton's
approach and it corrupts the screen once graduated history has scrolled the
terminal — a patch lands on the wrong row. Relative positioning is
scroll-invariant, and a regression test pins it:
`scrollback-corpus.test.tsx › patches_the_live_frame_correctly_after_static_overflows_the_screen`
(3 static + 4 live rows on a 5-row terminal). See
[M20 component parity](/renderer/m20-component-parity.md).

# Verification

Faithfulness is not assumed from the design — it is gated per scene against Ink
by the [Ink parity gate](/concepts/ink-parity-gate.md). The measured baselines
are pinned as fixtures; see [Benchmark baselines](/benchmarks/baselines.md).

[^m17-report]: M17 renderer byte-parity report, § Byte-cost evidence (EC-5).

[^m20-bench]: M20 comparative benchmark, § Results and § Headline.
