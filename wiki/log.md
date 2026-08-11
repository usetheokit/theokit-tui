# Log

## 2026-08-06

**Creation.** Bundle created by converting the repository's `docs/` folder into OKF v0.2
concepts. `docs/` was removed afterwards; this bundle is its successor.

**Conversion map** — nine source documents became twelve concepts:

| Source (at `9fd7eb1`)                    | Concept                                |
| ---------------------------------------- | -------------------------------------- |
| `docs/ttfatt.md`                         | `/benchmarks/ttfatt.md`                |
| `docs/v4-parity-matrix.md`               | `/parity/v4-parity-matrix.md`          |
| `docs/component-parity.md`               | `/parity/m26-component-ux-parity.md`   |
| `docs/renderer/m17-parity-report.md`     | `/renderer/m17-skeleton-parity.md`     |
| `docs/renderer/m18-parity-report.md`     | `/renderer/m18-layout-parity.md`       |
| `docs/renderer/m19-input-report.md`      | `/renderer/m19-input-stack.md`         |
| `docs/renderer/m20-parity-report.md`     | `/renderer/m20-component-parity.md`    |
| `docs/renderer/m20-comparative-bench.md` | `/benchmarks/m20-comparative-bench.md` |
| `docs/renderer/m25-parity-report.md`     | `/parity/m25-exit-gate-re-audit.md`    |
| (extracted, cross-cutting)               | `/concepts/differential-renderer.md`   |
| (extracted, cross-cutting)               | `/concepts/ink-parity-gate.md`         |
| (extracted, cross-cutting)               | `/concepts/exit-gate-triple.md`        |
| (extracted, previously undocumented)     | `/benchmarks/baselines.md`             |

**Non-document content moved, not converted.** `docs/benchmarks/*.json` (13 files)
are test fixtures read by `tests/bench-baseline.test.ts`,
`tests/bench-banner-baseline.test.ts` and `tests/bench-stack-provenance.test.ts`.
They moved to `benchmarks/baselines/` — beside the benches that write them — and
every reader and writer was repointed: the 13 `benchmarks/*.bench.tsx` output
paths, the three test files, `eslint.config.js` and `.prettierignore`.
`tests/package-contract.test.ts` now reads `/benchmarks/ttfatt.md` from this
bundle, and `README.md` links to it.

**Boundary — what was NOT crawled.** Only the `docs/` tree was converted. The
milestone reports reference artifacts that live outside it and were left where
they are, cited but not absorbed: the ADRs `D1`–`D6` and `0003`/`0004`, the plan
documents (`m17-renderer-skeleton`, `m18-yoga-layout`, `m19-input-stack`), the
house process docs (`cycle-review.md`), the ROADMAP, and `src/`/`tests/`
themselves. None of these were present under `docs/` in this repository.

**Provenance caveat.** `sources` entries pin each original at commit `9fd7eb1`
and carry the date the document itself declares. No `author` is claimed — the
repository does not record who wrote the originals, and guessing would forge a
trust signal. Nothing here carries a `verified` event: the facts were transcribed
from the reports, not re-measured.
