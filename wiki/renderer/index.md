# Renderer

The V4 program that replaced Ink's paint path with an own engine, milestone by
milestone. Each report is the release artifact of its gate.

- [M17 — skeleton parity](/renderer/m17-skeleton-parity.md) — first walking
  skeleton; parity on plain text, every wider gap deferred with a verdict.
- [M18 — layout parity](/renderer/m18-layout-parity.md) — real Yoga layout;
  14/14 scenes byte-identical, closing every M17 deferral.
- [M19 — input stack](/renderer/m19-input-stack.md) — raw stdin → ported parser
  → the 12-field `Key`, proven on a real PTY.
- [M20 — component parity](/renderer/m20-component-parity.md) — the full 16
  component suite on the new engine, 0 divergences.

Background: [Differential renderer](/concepts/differential-renderer.md) ·
[Ink parity gate](/concepts/ink-parity-gate.md).
