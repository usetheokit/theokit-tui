# M25 Parity Re-Audit Report — V4 Exit Gate

**Date:** 2026-07-09 · **Verdict:** PASSED · **Version:** v0.26.0 · **Milestone:** M25 (parity polish + matrix re-audit)

This report is the release artifact for the V4 exit gate (`docs/v4-parity-matrix.md`
§ Exit gate). The re-audit was run as an **adversarial 2-specialist refutation
panel** (modelled on `cycle-review.md`, not a self-grade — ROADMAP M25 Risk 2): each
specialist tried to REFUTE a `✓` for the M25 rows. A row flips to `✓` only when it
has the exit-gate triple — a **component**, an **oracle set** (passing tests), and an
**example** — AND no refutation stands.

## Rows audited (the four M25 universal/candidate rows)

| Row                                  | Peers                  | Verdict            | Component                                                                                                          | Oracle set (passing)                                                                                                        | Example                                                                                       |
| ------------------------------------ | ---------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Markdown tables                      | 6.5/7 (universal)      | **✓ NOT-REFUTED**  | `markdown-table.ts` + `markdown-model.ts` (table node) + `<Table>` in `markdown-text.tsx`                          | `markdown-table.test.ts` (5), `markdown-model.test.ts` tables (6), `markdown-table-render.test.tsx` (4, incl. width-matrix) | `examples/parity-polish.tsx` + `component-parity` MarkdownTable scene (byte-identical Ink/V4) |
| Intra-line diff highlight            | ~3.5/7 (borderline)    | **✓† NOT-REFUTED** | `diff-word.ts` + opt-in `intraLineHighlight` in `diff-viewer.tsx`                                                  | `diff-word.test.ts` (7), `diff-viewer.test.tsx` intra-line (3, incl. off-byte-identical)                                    | `examples/parity-polish.tsx` + `component-parity` DiffViewerIntraLine scene                   |
| Interactive expand/collapse (ctrl+o) | 5/7 (universal)        | **✓ NOT-REFUTED**  | `expandable-output.tsx` (composes M24 CollapsibleBlock) + `interactive` prop on `tool-result.tsx`/`code-block.tsx` | `expandable-output.test.tsx` (5), `tool-result-interactive.test.tsx` (3)                                                    | `examples/parity-polish.tsx`                                                                  |
| Terminal title + OSC-8 helpers       | ~3.5/7 (non-universal) | **✓† NOT-REFUTED** | `terminal-osc.ts` (`setTerminalTitle`/`osc8Link`/`supportsHyperlinks`)                                             | `terminal-osc.test.ts` (8)                                                                                                  | `examples/parity-polish.tsx` + smoke test (no `]0;`/`]8;;` leak piped)                        |

`†` = borderline/non-universal; shipped ✓ with the matrix honesty note (below the
strict ≥ 4/7 bar, but fully satisfies the triple with no refutation).

## Refutation attempts (all failed to stand)

**Markdown tables.** Probed: narrow-width data loss (none — binary fit-or-degrade;
the grid renders only when full content fits, else wraps as plain text, never
truncates a cell); malformed GFM (missing delimiter → paragraph, ragged rows padded,
escaped `\|` handled — no mid-turn throw, `markdown-model.ts` fail-soft); CJK/emoji
overflow (none — `string-width` EAW-aware; the `respects_cjk_cell_width` +
width-matrix oracles pin no-overflow across `columns ∈ [80,60,40,20,10]`).

**Intra-line diff.** Probed: the hard opt-in-OFF byte-identity contract (holds —
`intraMap` is `undefined` off-path, `lineBody` returns the pre-M25 text, no jsdiff
import; `off_is_byte_identical_to_the_default` asserts strict `===`); false
highlights (none — only equal-length adjacent del/add runs pair); pure-indentation
highlight (stripped — the residual empty changed-segment renders no SGR wrapper);
NO_COLOR disappearance (no — `inverse` is SGR-7, an attribute that survives NO_COLOR).

**Interactive expand.** Probed: ctrl+o toggle (fires — `key.ctrl && input==="o"`,
harness byte `\x0f` traced through the parser); the 20k char guard bypassed when
expanded (NOT bypassed — the expanded body is the already-char-capped `content.rows`;
`the_char_guard_is_not_bypassed_when_expanded` asserts it); global shared state (none
— per-component `useState`; instances toggle independently); unfocused toggle (no —
`useInput` gated on `isFocused`).

**OSC helpers.** Probed: raw-escape leak to a non-TTY pipe (none — `setTerminalTitle`
no-ops off-TTY, `osc8Link` returns plain text; the piped smoke test asserts no
`]0;`/`]8;;`); multiplexer suppression (yes — `TMUX`/`STY`/`ZELLIJ` gate); byte
correctness (OSC-0 `\x1b]0;…\x07`, OSC-8 `\x1b]8;;url\x07text\x1b]8;;\x07` — spec-correct).

## Non-blocking honesty notes (follow-up polish, not refutations)

1. The table degrade path is space-separated plain text, not column-aligned (comment
   corrected in `markdown-table.ts`). No data loss; ink wraps.
2. When a ToolResult is BOTH line-capped and char-capped, interactive mode surfaces
   the line `hiddenCount` but suppresses the static char-cap notice. The cap is still
   enforced on the bytes; only the surfaced notice is thinner. Follow-up polish.

## Cross-validation

- All four M25 rows have real implementations (no phantom ✓).
- The two "Already covered" gap-notes (matrix lines 18-19) were refreshed to reflect
  the shipped M25 work (tables + intra-line + interactive expand).
- No app-scope row (session UI / sidebars / voice / settings / auth — matrix
  "Explicitly OUT") was mis-graded as a lib gap.
- Oracle sets confirmed green by both auditors running `pnpm vitest run` over the
  M25 test files.

## Conclusion

**The V4 parity program is closed.** Every universal lib-scope row is `✓` with a
component + oracle set + example; the two borderline rows ship `✓` with an explicit
honesty note. No refutation stands. M22–M25 are all released (v0.23.0–v0.26.0).
