# M10 snapshot re-record review (D2/T1.4)

Base: `035ae09` (pre-bump). Changed files: 2 of 12 (.snap). Every diff
reviewed line-by-line; zero unexplained rows; border glyphs zero-diff.

| File | Snapshots | What changed | Justifying blueprint delta |
|---|---|---|---|
| tool-call.test.tsx.snap | tool-call-pending/running/success/failed + tool-call-card | `[1mNAME[2m summary[22m` → `[1mNAME[22m[2m summary[22m` — bold now closed explicitly BEFORE dim opens; visible text byte-identical | SGR sequencing via ansi-tokenize 0.1→0.3 + chalk chain (blueprint Corner 4 / F3 class (a)) |
| public-api.integration.test.tsx.snap | light-theme-scene | same SGR close-before-open resequencing in the bold+dim composer line | same |

Verified NOT changed: welcome-banner snapshots (border glyphs — cli-boxes 4
deep-equal proof held), diff-viewer/code/metrics/stream scenes, all
truncate-end content (string-width 8 shifts affect only emoji/CJK clusters —
our fixtures are ASCII).

## M26 re-record — tool-card Claude Code parity (2026-07-10)

The `●` status bullet (default `theme.toolStatus` glyph across dark/light/no-color),
the `name(args)` header format, and the `⎿` result-tree connector re-recorded three
snapshot files. Visible-text change is intentional and reviewed line-by-line.

| File | Snapshots | What changed | Justifying delta |
|---|---|---|---|
| tool-call.test.tsx.snap | tool-call-pending/running/success/failed + tool-call-card | status glyph `o`/`✓`/`x` → `●` (colored by status); `NAME summary` → `NAME(summary)`; card body now under a `⎿` corner connector | M26 plan ADR A/B/C; blueprint §T1/T2 (codex `exec_cell/render.rs:372`,`:706`; mastra `tool-execution-enhanced.ts:1482`) |
| agent-timeline.test.tsx.snap | representative-turn + header-scene | tool rows adopt the `●` bullet + `⎿` body (composed ToolCallCard) | same — downstream of ToolCallCard |
| public-api.integration.test.tsx.snap | tool/agent/stream scenes | same `●` + `name(args)` + `⎿` in the composed public-API scenes | same |

Verified NOT changed by M26: welcome-banner, diff-viewer intra-line, metrics,
code-block, markdown-table — none render tool-status glyphs.
