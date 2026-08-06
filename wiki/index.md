---
okf_version: "0.2"
---

# @theokit/tui knowledge bundle

Agent-readable knowledge for `@theokit/tui` — the AI-agent terminal UI primitive
set built on React. This bundle records what was **measured, audited and decided**
about the V4 renderer program and the component-parity mandate: the parity gates
against Ink, the byte-cost evidence behind the own renderer, the peer-parity
matrix and its exit audit, and the benchmark baselines the test suite pins.

It is the successor to the former `docs/` folder, converted concept-by-concept.

## Start here

- **"Is our renderer faithful to Ink?"** → [Ink parity gate](/concepts/ink-parity-gate.md),
  then the per-milestone reports under [Renderer](/renderer/index.md).
- **"Why did we build our own renderer at all?"** → [Differential renderer](/concepts/differential-renderer.md).
- **"Do we have component parity with the peer CLIs?"** → [V4 parity matrix](/parity/v4-parity-matrix.md).
- **"How does a parity row earn a ✓?"** → [Exit-gate triple](/concepts/exit-gate-triple.md).
- **"How fast is a consumer's first agent turn?"** → [TTFATT](/benchmarks/ttfatt.md).

## Sections

- [Concepts](/concepts/index.md) — the load-bearing ideas the reports assume.
- [Renderer](/renderer/index.md) — M17–M20 renderer milestone reports.
- [Parity](/parity/index.md) — the peer-parity matrix, its exit audit, and the UX-look sweep.
- [Benchmarks](/benchmarks/index.md) — measured records and the pinned baselines.

## Conventions

- Every concept carries OKF frontmatter with a non-empty `type`.
- `sources` cite the git-pinned original document and the code or tests that
  hold the fact today; a claim traced to one source is footnoted with its id.
- Verdicts, deferrals and honesty notes are reproduced as written. Where a
  report deferred a gap, the deferral is preserved rather than smoothed over.
- Change history lives in [log.md](/log.md).
