# M25 Blueprint — Renderer V4 parity polish + matrix re-audit (exit gate)

**Slug:** `m25-parity-polish-audit` · **Type:** DISCOVER blueprint · **Date:** 2026-07-09 · **Milestone:** M25 (`ROADMAP.md § M25`, deps: M21/M23/M24) · Version 0.25.0.

The V4 program (M17–M24) is functionally complete. M25 closes the last four universal parity rows in `docs/v4-parity-matrix.md` and re-audits the matrix as the exit gate. Two ROADMAP risks are the design spine: **narrow-width table layout** (Risk 1, width-matrix oracles) and **lenient self-grading** on the re-audit (Risk 2, adversarial panel).

---

## Coverage Corner 1 — Prior art per deliverable (citations)

### A. Markdown tables in `MarkdownText`

The current model (`src/markdown-model.ts`) is a hand-rolled line-classifier (gemini grammar port). Tables were **out of the M13 subset** (`markdown-model.ts:34-35`). A GFM table is header `| a | b |` + delimiter `|---|:--:|` + body rows — none match a block regex today (fall through as paragraphs). M25 adds a `table` node kind.

**Column-width algorithms (all grapheme/EAW-aware):**
- **gemini-cli** `packages/cli/src/ui/utils/TableRenderer.tsx:100-214`: two-phase per-column `minWidth=maxWordWidth` / `maxWidth=maxContentWidth`; overhead = `(numCols+1) borders + numCols*2 padding + 2 margin`; scale proportionally when over budget, **preserving short cols (≤5) at full width**. Borders `┌─┬─┐ ├─┼─┤ └─┴─┘`. Degrade = wrap cells (keeps grid).
- **codex** `codex-rs/tui/src/markdown_render.rs:1185-1359` + `table_detect.rs`: classifies cols TokenHeavy/Narrative/Compact, shrinks in priority; alignment from delimiter as padding (`:1445-1449`). **Degrade = when even 3 chars/col don't fit → pipe-delimited raw fallback (`:1500-1513`).** Width via `unicode_width`.
- **pi** `packages/tui/src/components/markdown.ts:685-800`: overhead `3n+1`; `maxUnbrokenWordWidth=30`; fallback to raw markdown when `availableForCells < numCols`.

**Rec (A):** gemini two-phase min/max + short-col preservation, **codex plain-text (aligned, no borders) degrade** (house rule: data-carrying degrade over forced wrap). Our `string-width@7.2.0` (already a dep, `output-grid.ts:7`) is the width oracle.

### B. DiffViewer intra-line word highlight (opt-in)

Current `src/diff-viewer.tsx:138-144` colors whole lines by kind; `src/diff-model.ts` gives typed `DiffLine{kind,oldLine,newLine,text}`. No word-level segmentation.

**Recipes (both jsdiff):**
- **assistant-ui** `packages/react-ink/src/primitives/diff/intra-line-utils.ts`: `buildLinePairMap()` pairs **equal-length adjacent del/add runs** (`:21-45`); `buildIntraLineSegments()` runs `diffWordsWithSpace(delText,addText)` marking changed (`:47-77`); renders changed **bold**, unchanged **dimColor**.
- **pi** `packages/coding-agent/src/modes/interactive/components/diff.ts:26-125`: stricter **1:1 pairing** only; `Diff.diffWords`; changed spans via `theme.inverse`; **strips leading whitespace from first changed part**.
- **codex**: no intra-line (line-level only) — confirms opt-in territory.

**Rec (B):** assistant-ui **equal-length-run pairing** (catches multi-line refactors) + pi's **leading-ws strip**; changed spans via `<Text inverse>` (our `chat-composer.tsx:201,226` proves inverse survives/strips under NO_COLOR).

### C. Interactive expand/collapse on capped outputs (ctrl+o)

`src/tool-result.tsx` caps by lines (`maxLines=10`, tail-retention, `:23-42`) + a 20k char guard (`MAX_RESULT_CHARS`); **already has a static `expanded` prop** (`:66,245-247`). `src/code-block.tsx` caps HEAD-retained. Neither interactive. `src/collapsible-block.tsx` (M24) is the toggle primitive (uncontrolled-or-controlled, `useFocus`+`useInput`, `▶/▼` glyph, no global registry).

**ctrl+o idiom:**
- **gemini** `keyBindings.ts:396-397` binds `SHOW_MORE_LINES` to ctrl+o; `MaxSizedBox.tsx:140-141` `"… N lines hidden (ctrl+o to show) …"`; global overflow Set.
- **pi** `tool-execution.ts:25,129,201` **per-component `expanded` state** (matches our house rule).

**Key-projection finding (critical):** ctrl+o projects as `key.ctrl===true && input==="o"` (`src/renderer/input/key.ts:47`).

**Rec (C):** a new `ExpandableOutput` wrapper composing M24 `CollapsibleBlock` in **uncontrolled** mode; collapsed = capped view + `"… N more lines (ctrl+o)"`; expanded = full. Per-component state (NOT gemini's global Set). Add ctrl+o alongside Space/Enter.

### D. `setTerminalTitle()` + OSC-8 hyperlink

`src/notify.ts` (M24) is the exact precedent: `detectNotifyProtocol(env)` gate, `notify()` no-ops when `out.isTTY !== true` (`:49`), injectable `out`/`env`.

**Escape sequences + gates:**
- **Terminal title (OSC 0):** gemini `interactiveCli.tsx:269` `\x1b]0;${title}\x07`, clears on exit; pi `terminal.ts:505` same (no TTY gate — we improve); opencode `app.tsx:447-474` flag-gated.
- **OSC-8 hyperlink:** pi `login-dialog.ts:100-104` `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`, gated by `getCapabilities().hyperlinks`, **degrades to plain styled text**; mastra `ansi.ts:7,35` knows terminator `\x1b]8;;\x07`.

**Rec (D):** two pure helpers mirroring `notify.ts`. `setTerminalTitle(title, out=process.stdout)` → no-op when `!out.isTTY`, else `\x1b]0;${title}\x07`. `osc8Link(text, url)` → plain `text` when capability absent, else wrapped. `supportsHyperlinks(env, out)` gate (multiplexer-aware; broad support → degrade = text). Sanitize note (embedded `\x07`/`\x1b` corrupts — document).

### E. Matrix re-audit (exit gate / release artifact)

**File:** `docs/v4-parity-matrix.md`. **Exit gate (`:66-70`):** "every 'universal' row (≥4/7 peers) at ✓ for the lib-scope column — verified per-row by a component + oracle set + example." Prior scoring: `docs/renderer/m20-parity-report.md` (16/16 byte-identical dual-render).

**M25-targeted rows (matrix `:52-55`), lib-vs-app scope:**

| Row | Peers | Universal? | Scope | Satisfied by |
|---|---|---|---|---|
| Markdown tables | ~6.5/7 | YES | **lib** | M25-A |
| Intra-line diff highlight | ~3.5/7 | borderline | **lib** (opt-in) | M25-B |
| Interactive expand/collapse on caps | 5/7 | YES | **lib** | M25-C |
| Terminal title + OSC-8 | ~3.5/7 | borderline | **lib** (helpers) | M25-D |

**Lib-vs-app flagging:** the matrix § "Explicitly OUT" (`:57-64`) declares app-territory rows (session UI, sidebars, voice, quota, login/OAuth, settings) — app-scope, NOT lib failures. All four M25 rows are **lib-scope**. Two (B, D) are **borderline-universal (~3.5/7)** — the audit must justify ✓ with an honesty note ("shipped for completeness, not strict universality").

**Adversarial method (Risk 2):** an independent refutation panel (model on `cycle-review.md`). Each specialist tries to REFUTE a ✓ (see Corner 3).

---

## Coverage Corner 2 — Integration seams (READ, exact contract)

| Seam | What it provides | M25 contract note |
|---|---|---|
| `src/markdown-model.ts` | `parseMarkdown()`→`MarkdownNode[]` | ADD a `table` node kind + `TABLE_DELIM_RE`; 3-line lookahead consumes header+delim+body; fail-soft (header w/o delimiter stays paragraph). |
| `src/markdown-text.tsx:78,120` | `BlockNode` switch + exhaustiveness guard | ADD `case "table"` → `<Table>`; needs `useStdout().columns` for the width budget. |
| `src/diff-model.ts` | `parseUnifiedDiff`→typed `DiffLine[]` | REUSE unchanged; the del/add pairing reads `file.lines` (typed `kind` is what the run-classifier needs). |
| `src/diff-viewer.tsx:131,227` | `lineRow` renderer | ADD opt-in `intraLineHighlight?:boolean` (default false → byte-identical); pre-pass pairs → per-line `<Text inverse>` spans; boundary guards stay above hooks (F10). |
| `src/tool-result.tsx` | caps + static `expanded` | WRAP in `CollapsibleBlock` for interactivity; keep static `expanded`; 20k char guard NOT bypassed even when expanded. |
| `src/code-block.tsx` | HEAD-cap | Same interactive-wrap contract. |
| `src/collapsible-block.tsx` (M24) | `CollapsibleBlock` toggle | REUSE; add ctrl+o to its `useInput`; `▶/▼` monochrome-safe. |
| `src/notify.ts` (M24) | capability-gate + non-TTY no-op | MIRROR for deliverable D. |
| `src/theme.tsx` | `status.*`, `accent`, monochrome | Table borders (glyph, monochrome-safe) + intra-line (`inverse`, stripped under NO_COLOR). |
| `src/renderer/input/key.ts` | ctrl+o = `key.ctrl && input==="o"` | Deliverable-C toggle predicate. |
| `src/renderer/hooks/use-stdout.ts` | `{stdout:{columns}}` | Table width oracle (`pager.tsx:97` pattern). |
| `string-width@7.2.0` | grapheme/EAW width | Column measurement (already a dep). |
| `tests/renderer/itl-adapter.tsx:41` | `render(el,{columns,rows})` | The width-matrix oracle harness (Risk 1). |
| `src/index.ts` | exports | ADD `setTerminalTitle`, `osc8Link`, `ExpandableOutput`, new prop types. |
| `benchmarks/diff-viewer.bench.tsx` | perf baseline | ADD a table bench if the width algo is per-frame (markdown re-parses per render). |

**New dep:** deliverable B needs `diff@^7` (jsdiff `diffWordsWithSpace`) — must clear `/deps-audit`. Only imported on the highlight path (opt-in).

---

## Coverage Corner 3 — Tools / Techniques

### Width-matrix oracles (Risk 1 — precedent exists)
`src/diff-viewer.test.tsx:265-296` `width_matrix_lines_fit` already renders across `w ∈ [60,30,20]` asserting rows `≤ width` (EAW counts 2). Deliverable A adds a table width-matrix over `columns ∈ [80,60,40,20,10]`: (a) no row exceeds `columns`, (b) wide → grid with borders, (c) narrow threshold → **degrades to aligned plain text (no data loss)**, (d) CJK/emoji cell width respected. **The gating test cluster for M25.**

### Adversarial re-audit method (Risk 2)
Model on `cycle-review.md` parallel specialists; each tries to REFUTE a ✓:
- **renderer:** table survives dual-render parity (m20 harness)? Breaks scrollback/windowing? Per-frame width-recompute regression (bench)?
- **markdown/diff:** table degrade loses data at narrow width (data-loss = REFUTE)? Intra-line OFF = byte-identical to today (any diff = REFUTE)? Malformed GFM fail-soft (never throws mid-turn)?
- **input:** ctrl+o toggles (`key.ctrl && input==="o"`)? Expand focus conflicts with composer/overlay arbiter? Multiple ExpandableOutputs toggle independently (no global registry)?
- **capability-gate:** `setTerminalTitle`/`osc8Link` no-op off-TTY (injected non-TTY sink)? No raw escape under tmux/screen? Degrade to plain text when unsupported?
- **theming/degrade:** monochrome + NO_COLOR — borders (glyph) + intra-line (inverse) still carry meaning?
- **cross-validation:** each ✓ has component ∧ oracle-set ∧ example? Any app-scope row wrongly graded a lib gap?

**Exit-gate criterion:** PASSES only when every universal lib-scope row has (component ∧ oracle ∧ example) AND no refutation stands. Report = updated `docs/v4-parity-matrix.md` + `docs/renderer/m25-parity-report.md` (the release artifact). Borderline rows (B, D) get an explicit honesty note.

---

## Coverage Corner 4 — ADRs (with alternatives)

- **ADR-A — Table degrade:** gemini two-phase width + **codex plain-text (aligned, no borders) degrade** at narrow threshold. Alt: gemini cell-wrap (rejected — multi-row cells break the line-oriented parity harness / windowing); pi raw-markdown fallback (rejected — ugly, un-aligned). Rationale: degrade-as-data.
- **ADR-B — Intra-line pairing:** assistant-ui **equal-length adjacent-run pairing** + pi leading-ws strip. Alt: pi strict 1:1 (rejected — misses multi-line refactors); char-level Myers (rejected — noisy). 
- **ADR-dep — add `diff@^7`:** for `diffWordsWithSpace` (both recipes use it). Alt: hand-roll word-LCS (rejected — Rule 9). Gate: `/deps-audit`. Only imported on the opt-in highlight path.
- **ADR-C — Interactive expand: per-component state, compose M24 CollapsibleBlock.** Alt: gemini global overflow Set (rejected — violates house declarative rule); bespoke toggle (rejected — DRY, M24 ships it).
- **ADR-D — OSC helpers mirror `notify.ts`, no-op off-TTY.** Alt: `terminal-link`/`supports-hyperlinks` npm (rejected — notify precedent is <60 LoC, anti-KISS to add deps for a 3-line escape).
- **ADR-E — Re-audit as adversarial panel, report is the release artifact.** Alt: single-pass self-grade (rejected by ROADMAP Risk 2). Exit-gate = component∧oracle∧example per universal lib-scope row.

---

## Recommended approach per deliverable

- **A:** `table` node (3-line lookahead, fail-soft) → `<Table>` using `useStdout().columns` + `string-width`; gemini min/max; codex plain-text degrade; box-drawing borders (monochrome-safe); alignment from delimiter.
- **B:** opt-in `intraLineHighlight` (default off = byte-identical); reuse typed `DiffLine.kind`; assistant-ui run-pairing + `diffWordsWithSpace`; changed spans `<Text inverse>`; leading-ws strip.
- **C:** `ExpandableOutput` over M24 `CollapsibleBlock`, per-component state, ctrl+o + Space/Enter; collapsed summary `"… N more lines (ctrl+o)"`; wraps ToolResult/CodeBlock; 20k char guard never bypassed.
- **D:** `setTerminalTitle`/`osc8Link`/`supportsHyperlinks` mirroring `notify.ts`; no-op off-TTY; multiplexer-safe; degrade to plain text.
- **E:** adversarial panel; update `docs/v4-parity-matrix.md` + write `docs/renderer/m25-parity-report.md`.

---

## Edge cases (feed `/edge-case-plan`)

**A/tables:** ragged rows · missing delimiter (→ paragraph) · empty cells · escaped pipe `\|` · single-column · CJK/emoji/zero-width cells · table wider than terminal at every col-min (→ plain-text degrade) · streaming partial table (header only) · optional leading/trailing pipe · alignment colons `:--`/`--:`/`:-:`.
**B/intra-line:** del run ≠ add run length (→ no pairing) · non-adjacent del/add · identical lines · whole-line replacement · trailing-ws-only diff · NO_COLOR (inverse stripped — documented) · opt-in OFF byte-identical (regression oracle).
**C/expand:** empty output · exactly-at-cap boundary · char-cap fired but not line-cap · focus conflict with composer/overlay · unmount while expanded · ctrl+o when unfocused (no-op) · controlled vs uncontrolled · multiple blocks independent.
**D/OSC:** non-TTY (no-op) · tmux/screen/zellij (suppress) · title/url with `\x07`/`\x1b` (corruption — sanitize/document) · empty title (clear) · long title · unsupported OSC-8 (plain text).
**E/audit:** app-scope row mis-graded a lib gap · borderline row (B,D) ✓ without honesty note · a ✓ missing oracle/example · dual-render parity regression from A/B/C.

---

## Constraint-risk flags

1. **Narrow-width tables (Risk 1):** precedent oracle `diff-viewer.test.tsx:265` → replicate as a table width-matrix over `columns ∈ [80,60,40,20,10]`, asserting no-overflow + data-preserving plain-text degrade. Gating test cluster for A.
2. **Lenient self-grade (Risk 2):** re-audit runs as an adversarial refutation panel (Corner 3), not a checkbox; exit-gate = component∧oracle∧example per universal lib-scope row; borderline rows get honesty notes. The report is the release artifact.

---

## Proposed phase decomposition (6 phases)

- **Phase 1 — Markdown tables (A):** model `table` node (RED: parse GFM + fail-soft) → `<Table>` + width algo + degrade → width-matrix oracle → bench if per-frame. *Highest risk; first.*
- **Phase 2 — Intra-line diff (B):** add `diff` dep (deps-audit) → pairing + segments (pure) → opt-in prop + `<Text inverse>` → byte-identical-when-off regression oracle.
- **Phase 3 — Interactive expand (C):** `ExpandableOutput` over M24 CollapsibleBlock → ctrl+o toggle → wrap ToolResult/CodeBlock → focus + independence tests.
- **Phase 4 — OSC helpers (D):** `setTerminalTitle` + `osc8Link` + `supportsHyperlinks` mirroring notify.ts → non-TTY/multiplexer/degrade tests → export.
- **Phase 5 — Wiring + exports:** `src/index.ts` exports, prop types, dual-render parity for A/B/C, CHANGELOG.
- **Phase 6 — Adversarial re-audit (E):** run the refutation panel, per-row component∧oracle∧example evidence, update `docs/v4-parity-matrix.md`, write `docs/renderer/m25-parity-report.md` (release artifact).

Wiring triad per feature: caller (MarkdownText/DiffViewer/tool-call/exports) + integration test (dual-render parity + width-matrix) + runtime metric (bench where per-frame).

**Honest caveats:** (1) two M25 rows (B, D) are borderline-universal (~3.5/7) — shipped for completeness with an explicit honesty note, not silent ✓. (2) The table degrade fork (plain-text vs cell-wrap, ADR-A) and the intra-line pairing fork (run vs 1:1, ADR-B) are worth confirming in `/to-plan`. (3) `diff@^7` is a new dep gated by `/deps-audit`.
