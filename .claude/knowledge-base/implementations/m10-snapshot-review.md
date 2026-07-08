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
