---
slug: m25-parity-polish-audit
milestone_id: M25
created_at: 2026-07-09
goal: Close the last four universal V4 parity rows — Markdown tables in MarkdownText (aligned plain-text degrade), DiffViewer intra-line word highlight (opt-in), interactive expand/collapse on ToolResult/CodeBlock caps (ctrl+o over M24 CollapsibleBlock), and setTerminalTitle()/osc8Link() helpers (no-op off-TTY) — then re-audit docs/v4-parity-matrix.md as an adversarial exit gate with a written release-artifact report.
---

# Plan: m25-parity-polish-audit

## Goal

Deliver the final V4 parity-polish surfaces and gate the release on an adversarial
matrix re-audit: (1) **Markdown tables** — a `table` node in the markdown model +
a `<Table>` renderer (gemini two-phase column widths, codex aligned plain-text
degrade under narrow width, box-drawing borders that survive monochrome); (2)
**DiffViewer intra-line word highlight** — an OPT-IN prop (`intraLineHighlight`,
default off = byte-identical) that pairs equal-length del/add runs and marks the
changed words with `<Text inverse>`; (3) **Interactive expand/collapse** — an
`ExpandableOutput` wrapper composing the M24 `CollapsibleBlock` so a capped
ToolResult/CodeBlock expands on ctrl+o (per-component state, no global registry);
(4) **`setTerminalTitle()` + `osc8Link()`** — pure OSC-0/OSC-8 helpers mirroring
the M24 `notify.ts` capability-gate (no-op off-TTY, multiplexer-safe, degrade to
plain text); (5) **Matrix re-audit** — re-score `docs/v4-parity-matrix.md` via an
independent refutation panel (not a self-grade) and write
`docs/renderer/m25-parity-report.md` as the release artifact. House rules hold:
declarative/callback-only, degrade-as-data, width-matrix oracles for tables.

## Baseline Context

### Files that will be touched

| File | Role | Change |
|---|---|---|
| `src/markdown-model.ts` | EDIT | add a `table` node kind + `TABLE_DELIM_RE` + a 3-line lookahead in `parseMarkdown` (fail-soft: header without a delimiter stays a paragraph) |
| `src/markdown-table.ts` | NEW | pure column-width + degrade computation (gemini two-phase min/max; codex plain-text degrade; alignment from the delimiter) |
| `src/markdown-text.tsx` | EDIT | add `case "table"` → a `<Table>` sub-component using `useStdout().columns` + `string-width` |
| `src/diff-word.ts` | NEW | pure intra-line pairing + `diffWordsWithSpace` segmentation (equal-length run pairing, leading-ws strip) |
| `src/diff-viewer.tsx` | EDIT | add opt-in `intraLineHighlight?: boolean` (default false → byte-identical); render changed spans as `<Text inverse>` |
| `src/expandable-output.tsx` | NEW | `ExpandableOutput` composing M24 `CollapsibleBlock` (ctrl+o + Space/Enter, collapsed summary "… N more lines (ctrl+o)") |
| `src/tool-result.tsx` | EDIT | add an `interactive?` mode that wraps the capped body in `ExpandableOutput` (static `expanded` prop kept for controlled callers) |
| `src/code-block.tsx` | EDIT | same `interactive?` wrap contract |
| `src/terminal-osc.ts` | NEW | `setTerminalTitle(title, out?)` + `osc8Link(text, url, env?)` + `supportsHyperlinks(env, out)` (mirrors `notify.ts`) |
| `examples/parity-polish.tsx` | NEW | demo composing a table + intra-line diff + an expandable output + a title/hyperlink |
| `src/index.ts` | exports | `setTerminalTitle`, `osc8Link`, `ExpandableOutput` + new prop types |
| `docs/v4-parity-matrix.md` | EDIT | flip the four M25 universal lib-scope rows ✓ with per-row evidence |
| `docs/renderer/m25-parity-report.md` | NEW | the adversarial re-audit report (release artifact) |

### Current callers / dependents (READ — the integration seams)

- `src/markdown-model.ts:20-32` — the `MarkdownNode` union + `classifyLine`/`parseMarkdown`; tables were out of the M13 subset (`:34-35`). The exhaustiveness guard in `markdown-text.tsx:120-125` forces the new `case "table"`.
- `src/markdown-text.tsx:78` — the `BlockNode` switch; needs `useStdout().columns` for the width budget (the `pager.tsx:97` `stdout?.columns ?? 80` pattern).
- `src/diff-model.ts` — `parseUnifiedDiff` → typed `DiffLine{kind,oldLine,newLine,text}`; REUSED unchanged (the typed `kind` is what the del/add run-pairing reads — no re-parse).
- `src/diff-viewer.tsx:131,227` — `lineRow` + the boundary guards above hooks (F10); the opt-in pre-pass pairs `file.lines` into segments.
- `src/tool-result.tsx:11,23-42,66,245-247` — `MAX_RESULT_CHARS` (20k) char guard + `maxLines` tail-retention + the existing static `expanded` prop; the char guard is NOT bypassed even when expanded.
- `src/code-block.tsx:243-244` — HEAD-retained `maxLines` cap.
- `src/collapsible-block.tsx` (M24) — the toggle primitive (`useFocus`+`useInput`, `▶/▼` glyph, no global registry); `ExpandableOutput` composes it uncontrolled.
- `src/notify.ts` (M24) — `detectNotifyProtocol(env)` + `notify()` no-op-off-TTY + injectable `out`/`env`: the exact precedent `terminal-osc.ts` mirrors.
- `src/renderer/input/key.ts:47` — ctrl+o projects as `key.ctrl && input === "o"` (the toggle predicate).
- `src/theme.tsx` — `status.{error,success}`/`accent`; monochrome zeros colors → table borders use box-drawing glyphs (survive), intra-line uses `inverse` (SGR, stripped under NO_COLOR — the `chat-composer.tsx:201,226` precedent).
- `string-width@7.2.0` (`output-grid.ts:7`) — grapheme/EAW width oracle for column measurement.
- `src/diff-viewer.test.tsx:265-296` — the `width_matrix_lines_fit` oracle precedent (renders across widths, asserts row ≤ width); the table width-matrix mirrors it.

### Domain glossary

- **table node** — `{kind:"table", header:string[], align:("left"|"center"|"right")[], rows:string[][]}` parsed from a GFM header+delimiter+body triple.
- **two-phase column width** — per-column `minWidth = longest unbroken word`, `maxWidth = longest cell`; allocate within `columns − overhead`, preserving short columns.
- **plain-text degrade** — when the grid can't fit even min widths, render aligned columns WITHOUT box borders (data preserved, no truncation-loss — ADR A).
- **equal-length run pairing** — adjacent del-run and add-run of equal length are paired for word-diff (assistant-ui recipe); unequal runs fall back to whole-line color.
- **intra-line highlight** — changed words within a paired del/add line, rendered `<Text inverse>` (opt-in; default off = byte-identical).
- **ExpandableOutput** — a `CollapsibleBlock` wrapper: collapsed shows the cap + "… N more lines (ctrl+o)", expanded shows the full body (per-component state).
- **capability-gate** — `supportsHyperlinks(env,out)` / the `out.isTTY` guard: emit an escape only where safe; degrade to plain text / no-op otherwise.

### Architecture boundaries affected

- `src/markdown-table.ts`, `src/diff-word.ts`, `src/terminal-osc.ts` (the detect/emit halves) are pure + ink-free (columns/env/out injected) — same posture as `notify.ts`/`select-list-model.ts`.
- Components consume OUR M22/M24 hooks + ink; NO `output-engine`/`renderer` change.
- `setTerminalTitle`/`osc8Link` write escape bytes only when `out.isTTY` (never into a pipe), suppressed under multiplexers.
- One new dependency: `diff` (jsdiff) for `diffWordsWithSpace` (deliverable B only, opt-in path) — see `## Dependencies`.

## Prior Art

- **Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m25-parity-polish-audit-blueprint.md` (this cycle) — the peer synthesis, ADRs A-E, the lib-vs-app scope table, and the two constraint risks.
- **Tables:** gemini-cli `packages/cli/src/ui/utils/TableRenderer.tsx:100-214` (two-phase width), codex `codex-rs/tui/src/markdown_render.rs:1185-1359` (plain-text degrade), pi `packages/tui/src/components/markdown.ts:685-800`.
- **Intra-line diff:** assistant-ui `packages/react-ink/src/primitives/diff/intra-line-utils.ts` (run pairing + `diffWordsWithSpace`), pi `packages/coding-agent/src/modes/interactive/components/diff.ts:26-125` (leading-ws strip).
- **Expand/collapse:** gemini `keyBindings.ts:396-397` (ctrl+o), pi `tool-execution.ts:25,129,201` (per-component state).
- **OSC helpers:** gemini `interactiveCli.tsx:269` (OSC-0 title), pi `login-dialog.ts:100-104` (OSC-8), mastra `ansi.ts:7,35` (OSC-8 terminator).
- **Ours:** `markdown-model.ts`/`markdown-text.tsx`, `diff-model.ts`/`diff-viewer.tsx`, `tool-result.tsx`/`code-block.tsx`, `collapsible-block.tsx` (M24), `notify.ts` (M24 capability-gate), `diff-viewer.test.tsx:265` (width-matrix), `docs/v4-parity-matrix.md`.

## ADRs

### A — Table degrade is aligned plain text (no borders), not cell-wrapping
**Alternative rejected:** gemini's wrap-inside-column degrade — multi-row cells break our line-oriented parity harness + scrollback windowing; OR pi's raw-markdown (`| a | b |`) fallback — ugly and un-aligned. Chosen: gemini two-phase min/max column widths (short columns ≤5 preserved) with box-drawing borders when it fits; at the narrow threshold, degrade to codex-style **aligned plain-text columns without borders** (data-preserving — the house degrade-as-data rule). Width via the shipped `string-width`.

### B — Intra-line highlight pairs equal-length del/add runs; opt-in, default off
**Alternative rejected:** pi's strict 1:1 pairing — misses multi-line refactors (weaker parity with codex/opencode); OR char-level Myers — over-granular, noisy. Chosen: assistant-ui **equal-length adjacent-run pairing** + pi's leading-whitespace strip (indentation changes don't highlight); changed words render `<Text inverse>`. The `intraLineHighlight` prop defaults `false` → the DiffViewer render is byte-identical for every existing caller (a regression oracle proves it).

### C — Interactive expand is per-component state composing M24 CollapsibleBlock
**Alternative rejected:** gemini's global overflow `Set` — a global registry violates the house declarative / no-app-state-machine rule; OR a bespoke new toggle — DRY violation (M24 `CollapsibleBlock` exists precisely for this). Chosen: `ExpandableOutput` composes `CollapsibleBlock` uncontrolled, adds ctrl+o (`key.ctrl && input==="o"`) alongside Space/Enter; collapsed shows the cap + "… N more lines (ctrl+o)". Multiple instances toggle independently (no shared state).

### D — OSC title/hyperlink helpers mirror `notify.ts`; no-op off-TTY
**Alternative rejected:** the `terminal-link` / `supports-hyperlinks` npm packages — the `notify.ts` precedent is < 60 LoC and adding dependencies for a 3-line escape is anti-KISS. Chosen: pure `setTerminalTitle(title, out=process.stdout)` (no-op when `!out.isTTY`, else `\x1b]0;${title}\x07`), `osc8Link(text, url, env)` (plain `text` when unsupported/off-TTY, else the wrapped sequence), `supportsHyperlinks(env, out)` (multiplexer-aware gate; broad terminal support → degrade = text). Injectable env/out; embedded `\x07`/`\x1b` in title/url is documented as corrupting (sanitize upstream — the `notify.ts` note).

### E — The re-audit is an adversarial refutation panel; its report is the release artifact
**Alternative rejected:** a single-pass self-grade of the matrix — explicitly rejected by ROADMAP Risk 2 (self-grading is lenient). Chosen: an independent panel (modelled on `cycle-review.md` specialists) where each specialist tries to REFUTE a ✓ (renderer / markdown-diff / input / capability-gate / theming / cross-validation). The exit gate PASSES only when every **universal lib-scope** row has (component ∧ oracle-set ∧ example) AND no refutation stands; borderline-universal rows (intra-line diff, OSC helpers — ~3.5/7 peers) ship ✓ with an explicit honesty note. The written `docs/renderer/m25-parity-report.md` is the release artifact.

## Dependencies

One new runtime dependency for deliverable B (intra-line word diff):

| Package | Version | Rule 9 (why not hand-roll) | License |
|---|---|---|---|
| `diff` (jsdiff) | `^7.0.0` | Battle-tested word/line diff (`diffWordsWithSpace`); both peer recipes (assistant-ui, pi) use it. Hand-rolling word-LCS is a Rule-9 violation. | BSD-3-Clause |

`diff` is imported ONLY on the opt-in `intraLineHighlight` path. `/deps-audit` MUST
clear it (no critical/high CVE) before implementation. All other seams (`string-width`,
`parse-diff`, `ink`, `react`, M24 `CollapsibleBlock`/`notify`) are already shipped.

## Critical paths

- `src/markdown-table.ts` — the column-width + degrade algorithm (a wrong budget overflows the terminal — RISK-1).
- `src/diff-word.ts` — the run-pairing + segmentation (a mis-pair corrupts the highlight or, worse, the opt-in-off byte-identity).
- `src/terminal-osc.ts` — `supportsHyperlinks` / the `out.isTTY` guard (a wrong branch leaks raw escape bytes — the RISK-2 capability concern).
- `docs/renderer/m25-parity-report.md` — the exit-gate evidence (a lenient grade defeats the whole milestone — RISK-2).

## Phase 1: Markdown tables (A) — highest risk, first

### T1.1 — `markdown-table.ts` (pure width + degrade) + `table` model node + `<Table>` render

#### Objective
Add a `table` node to `markdown-model.ts` (GFM header+delimiter+body via a 3-line
lookahead; fail-soft when the delimiter is absent). Build a pure `markdown-table.ts`:
`computeColumnWidths(header, rows, budget)` (gemini two-phase min/max, short-col
preservation) returning either fitted widths OR a `degrade` signal; alignment parsed
from the delimiter (`:--`/`--:`/`:-:`). Render a `<Table>` in `markdown-text.tsx`
using `useStdout().columns`: box-drawing grid when it fits, **aligned plain-text
columns (no borders)** when it degrades. Width via `string-width` (EAW/grapheme).

#### Why this step
Tables carry both ROADMAP risks' headline (narrow-width degrade, RISK-1); building
the pure width/degrade core first with the width-matrix oracle de-risks the render.

#### Evidence
Blueprint ADR A + Coverage Corner 1.A/3; gemini `TableRenderer.tsx:100-214`; codex `markdown_render.rs:1500-1513` (degrade); `markdown-model.ts:20-35`; `diff-viewer.test.tsx:265` (width-matrix precedent); `string-width` (`output-grid.ts:7`).

#### TDD
- RED `markdown-table.test.ts` (pure): `test_two_phase_widths_fit_within_budget`, `test_short_columns_preserved_at_full_width`, `test_degrades_when_min_widths_exceed_budget`, `test_alignment_parsed_from_delimiter`, `test_cjk_cell_width_counts_double` (`string-width`), `test_ragged_row_padded_to_header_width`.
- RED `markdown-model.test.ts` additions: `test_parses_a_gfm_table_node`, `test_header_without_delimiter_stays_a_paragraph` (fail-soft), `test_escaped_pipe_in_cell`.
- RED `markdown-text.test.tsx` (itl-adapter): `test_renders_a_bordered_table_when_wide`, `test_degrades_to_aligned_plain_text_when_narrow`, plus a **width-matrix** `test_table_rows_never_exceed_columns` over `columns ∈ [80,60,40,20,10]`.
- GREEN: the pure module + the node + the `<Table>` (table-driven, complexity ≤10 via helpers).

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — terminal dims)
- A table wider than the terminal at every column-min MUST degrade to aligned plain text (no truncated cells losing data), not overflow; the width-matrix oracle at `columns=10` proves it. A streaming partial table (header only, no body) fails soft (stays a paragraph until the delimiter arrives).

#### Acceptance Criteria
- [ ] `computeColumnWidths` is pure, 100% branch-covered; complexity ≤10.
- [ ] A GFM table `parses` to a `table` node; a header without a delimiter stays a paragraph (fail-soft `assert`).
- [ ] The width-matrix oracle `asserts` no rendered row `exceeds` `columns` for `columns ∈ [80,60,40,20,10]`; narrow → aligned plain-text degrade (no data loss).
- [ ] `pnpm gates` green.

#### DoD
- [ ] `markdown-table.ts` + the `table` node + `<Table>` land; CHANGELOG `[Unreleased]` updated; the pure width module 100% branch-covered.

## Phase 2: DiffViewer intra-line word highlight (B) — opt-in

### T2.1 — add `diff` dep + `diff-word.ts` (pure) + `intraLineHighlight` prop

#### Objective
After `/deps-audit` clears `diff@^7`, build a pure `diff-word.ts`:
`pairIntraLines(lines)` (equal-length adjacent del/add run pairing) +
`segmentWords(delText, addText)` (`diffWordsWithSpace`, leading-ws strip) →
per-line changed-segment spans. Add `intraLineHighlight?: boolean` (default `false`)
to `DiffViewer`; when on, the `lineRow` renders changed words as `<Text inverse>`.
Default off → the render is byte-identical to today.

#### Why this step
The opt-in-off byte-identity is a hard contract (the parity harness would fail on
any drift); the pure pairing/segmentation is unit-testable independent of render.

#### Evidence
Blueprint ADR B/ADR-dep + Coverage Corner 1.B; assistant-ui `intra-line-utils.ts`; pi `diff.ts:26-125`; `diff-model.ts` (typed `DiffLine.kind`); `chat-composer.tsx:201,226` (inverse under NO_COLOR).

#### TDD
- RED `diff-word.test.ts` (pure): `test_pairs_equal_length_del_add_runs`, `test_unequal_runs_are_not_paired`, `test_segments_mark_changed_words`, `test_leading_whitespace_is_stripped_from_first_change`, `test_identical_lines_have_no_changed_segments`.
- RED `diff-viewer.test.tsx`: `test_intra_line_highlight_marks_changed_words_when_on` (asserts an `inverse` span), `test_off_is_byte_identical_to_current` (render with + without the prop unset → same frame — the regression oracle), `test_no_color_theme_still_renders_the_words` (inverse stripped, words present).
- GREEN: the pure module + the prop wiring.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pairIntraLines`/`segmentWords` pure, 100% branch-covered; equal-length pairing only.
- [ ] `intraLineHighlight` OFF `renders` byte-identical to the current DiffViewer (regression `assert`).
- [ ] ON marks changed words with an `inverse` span; under `themes["no-color"]` the words still `render`.
- [ ] `diff@^7` cleared by `/deps-audit`; `pnpm gates` green.

#### DoD
- [ ] `diff-word.ts` + the `intraLineHighlight` prop land; CHANGELOG updated; new dep documented; pure module 100% branch-covered.

## Phase 3: Interactive expand/collapse on caps (C)

### T3.1 — `ExpandableOutput` (M24 CollapsibleBlock + ctrl+o) + ToolResult/CodeBlock interactive mode

#### Objective
Build `ExpandableOutput({ collapsed, expanded, hiddenCount })` composing the M24
`CollapsibleBlock` uncontrolled: collapsed shows `collapsed` + a summary
`"… {hiddenCount} more lines (ctrl+o)"`; a ctrl+o (`key.ctrl && input==="o"`) or
Space/Enter toggle reveals `expanded`. Add an `interactive?` mode to `ToolResult`
and `CodeBlock` that wraps the capped body in `ExpandableOutput` (the static
`expanded` prop stays for controlled callers; the 20k char guard is never bypassed).

#### Why this step
Reuses the M24 primitive (DRY); proving the ctrl+o toggle + per-component
independence + focus-arbiter coexistence closes the interactive-caps parity row.

#### Evidence
Blueprint ADR C + Coverage Corner 1.C; `collapsible-block.tsx` (M24); `tool-result.tsx:11,66,245`; `code-block.tsx:243`; `renderer/input/key.ts:47` (ctrl+o).

#### TDD
- RED `expandable-output.test.tsx` (itl-adapter): `test_collapsed_shows_the_cap_and_a_ctrl_o_affordance`, `test_ctrl_o_expands_the_full_body`, `test_space_also_toggles`, `test_two_instances_toggle_independently`, `test_ctrl_o_when_unfocused_is_a_noop`.
- RED `tool-result.test.tsx` / `code-block.test.tsx` additions: `test_interactive_mode_wraps_the_cap_in_an_expandable`, `test_char_guard_not_bypassed_when_expanded`.
- GREEN: the wrapper + the interactive modes.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] ctrl+o (`key.ctrl && input==="o"`) `expands`; Space/Enter also `toggles`; unfocused ctrl+o is a no-op.
- [ ] Two `ExpandableOutput`s `toggle` independently (no global registry).
- [ ] The 20k char guard is NOT bypassed when `expanded` (`assert`).
- [ ] `pnpm gates` green.

#### DoD
- [ ] `expandable-output.tsx` + the interactive modes land, exported; CHANGELOG updated; toggle/independence branches covered.

## Phase 4: setTerminalTitle + OSC-8 hyperlink helpers (D)

### T4.1 — `terminal-osc.ts` (`setTerminalTitle` + `osc8Link` + `supportsHyperlinks`)

#### Objective
Build `terminal-osc.ts` mirroring `notify.ts`: `setTerminalTitle(title, out=process.stdout)`
(no-op when `!out.isTTY`, else writes `\x1b]0;${title}\x07`); `supportsHyperlinks(env, out)`
(false off-TTY or under a multiplexer, true otherwise); `osc8Link(text, url, env=process.env, out=process.stdout)`
returns plain `text` when unsupported, else `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`.
Injectable env/out; exact-byte tested.

#### Why this step
This carries the RISK-2 capability concern (a wrong gate leaks raw escape bytes);
building it against the tested `notify.ts` shape with injectable-env branch tests
mitigates it.

#### Evidence
Blueprint ADR D + Coverage Corner 1.D; `notify.ts` (M24 gate); gemini `interactiveCli.tsx:269`; pi `login-dialog.ts:100-104`.

#### TDD
- RED `terminal-osc.test.ts` (pure): `test_set_title_writes_osc0_bytes_on_a_tty`, `test_set_title_is_a_noop_off_tty`, `test_supports_hyperlinks_false_off_tty_and_under_multiplexer`, `test_osc8_link_wraps_when_supported`, `test_osc8_link_returns_plain_text_when_unsupported`, `test_osc8_link_plain_under_tmux`.
- GREEN: the three helpers.

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — terminal / stdout)
- `setTerminalTitle`/`osc8Link` MUST NOT write escape bytes to a non-TTY (piped) `out` (gated on `out.isTTY`) and MUST be suppressed under tmux/screen/zellij (no raw OSC leaking through the multiplexer — the `notify.ts` precedent). Tested by an injected fake `out`/`env`.

#### Acceptance Criteria
- [ ] `setTerminalTitle` `writes` the exact `\x1b]0;…\x07` bytes on a TTY; a no-op off-TTY.
- [ ] `supportsHyperlinks` `returns` false off-TTY and under a multiplexer; `osc8Link` `returns` plain `text` then, else the wrapped sequence.
- [ ] 100% branch-covered; `pnpm gates` green.

#### DoD
- [ ] `terminal-osc.ts` exported (`setTerminalTitle`, `osc8Link`); CHANGELOG updated; capability branches covered.

## Phase 5: Wiring + exports + example + dual-render parity

### T5.1 — exports + parity-polish example + dual-render checks

#### Objective
Wire `src/index.ts` (`setTerminalTitle`, `osc8Link`, `ExpandableOutput` + prop
types). Add `examples/parity-polish.tsx` composing a markdown table + an intra-line
diff + an ExpandableOutput + a title/hyperlink; clean non-TTY exit + a smoke test.
Add a dual-render parity check (the M20 harness) for the table + intra-line render.

#### Why this step / Evidence
Closes the wiring triad: the example is the caller, the smoke + dual-render tests
are the integration, the width-matrix/bench are the runtime metric. Evidence:
ROADMAP M25 DoD; blueprint Corner 3; `docs/renderer/m20-parity-report.md` (dual-render
harness); `examples/live-turn.tsx` (non-TTY-exit precedent).

#### TDD
- RED: `tests/example-parity-polish.integration.test.ts` (pipes the example, asserts the table + diff + expand affordance render + clean exit). RED = the example/exports don't exist yet.
- GREEN: the exports + example; smoke goes green.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] All new symbols exported from `src/index.ts`; the example `renders` a table + intra-line diff + expandable output + a title; smoke-clean.
- [ ] `pnpm gates` green twice.

#### DoD
- [ ] Exports + example + smoke land; CHANGELOG complete.

## Phase 6: Adversarial matrix re-audit (E) — the exit gate

### T6.1 — refutation-panel re-audit + `docs/renderer/m25-parity-report.md` + matrix flip

#### Objective
Run an adversarial refutation panel (renderer / markdown-diff / input / capability-gate
/ theming / cross-validation specialists) against the four M25 universal lib-scope
rows: each specialist tries to REFUTE a ✓. Only when every universal lib-scope row
has (component ∧ oracle-set ∧ example) AND no refutation stands, flip the rows ✓ in
`docs/v4-parity-matrix.md` (borderline rows B/D get an explicit honesty note). Write
`docs/renderer/m25-parity-report.md` as the release artifact.

#### Why this step / Evidence
The whole milestone is a gate; a lenient self-grade defeats it (RISK-2). Evidence:
blueprint ADR E + Coverage Corner 3; `docs/v4-parity-matrix.md:52-70` (exit-gate
criterion); `cycle-review.md` (specialist-panel pattern).

#### TDD
- This phase's "test" is the adversarial audit itself: each row's ✓ MUST cite its component + a passing oracle-test name + an example. A row without all three, or with a standing refutation, MUST NOT flip to ✓ (it stays ◐/✗ with a documented reason).

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] Every universal lib-scope M25 row that flips to ✓ `cites` a component + a passing oracle test + an example (the exit-gate triple).
- [ ] Borderline rows (intra-line diff, OSC helpers) carry an explicit honesty note (not a silent ✓).
- [ ] `docs/renderer/m25-parity-report.md` `records` each specialist's refutation attempt + verdict; no app-scope row graded a lib gap.
- [ ] `pnpm gates` green.

#### DoD
- [ ] The matrix flipped with evidence; the report written as the release artifact; CHANGELOG notes the exit-gate audit.

## Edge cases absorbed

From the blueprint § Edge cases (MUST-FIX owners = the phase that ships the surface):
1. Ragged rows / missing delimiter / escaped pipe / CJK cell (T1.1).
2. Table wider than terminal at every col-min → plain-text degrade (T1.1 width-matrix).
3. Streaming partial table → fail-soft paragraph (T1.1).
4. Del run ≠ add run → no pairing (T2.1); identical lines → no changed segments (T2.1).
5. Intra-line OFF byte-identical (T2.1 regression oracle); NO_COLOR inverse stripped (T2.1).
6. Empty output / char-cap-only / unfocused ctrl+o (T3.1); multiple independent toggles (T3.1); char guard not bypassed (T3.1).
7. OSC off-TTY no-op / multiplexer suppression / plain-text degrade (T4.1).
8. Audit: app-scope row not mis-graded; borderline row honesty note; ✓ requires oracle+example (T6.1).

## Coverage Matrix

| Goal claim | Task(s) |
|---|---|
| Markdown tables in MarkdownText (degrade to aligned plain text) | T1.1 |
| DiffViewer intra-line word highlight (opt-in) | T2.1 |
| Interactive expand/collapse on ToolResult/CodeBlock caps (ctrl+o, M24 CollapsibleBlock) | T3.1 |
| setTerminalTitle() + OSC-8 hyperlink helper (no-op off-TTY) | T4.1 |
| Matrix re-audit: `docs/v4-parity-matrix.md` re-scored; report is the release artifact | T6.1 |
| Gates/coverage/CHANGELOG house standard | every task DoD + T5.1 |
| Width-matrix oracles (narrow-width tables) — risk 1 | T1.1 |
| Adversarial re-audit (not self-grade) — risk 2 | T6.1 |
| Example + smoke + dual-render parity | T5.1 |
| New `diff` dep cleared | T2.1 (deps-audit) |

## Drawbacks & Risks

| # | Risk / drawback | Mitigation |
|---|---|---|
| 1 | Table layout can overflow or lose data under narrow widths (RISK-1). | Pure two-phase width algo + aligned plain-text degrade (no truncation); a width-matrix oracle over `columns ∈ [80,60,40,20,10]` gates it (T1.1). |
| 2 | The re-audit could self-grade leniently (RISK-2). | An adversarial refutation panel (independent specialists trying to REFUTE each ✓); exit-gate = component∧oracle∧example; borderline rows get honesty notes; the report is the release artifact (T6.1). |
| 3 | The `intraLineHighlight` opt-in could drift the default-off render. | Default `false`; a byte-identical regression oracle pins the off path (T2.1); the highlight import is lazy on the opt-in path. |
| 4 | A new dependency (`diff`) adds supply-chain surface. | Single, battle-tested, BSD-3 package used only on the opt-in path; `/deps-audit` clears CVEs before use (T2.1). |
| 5 | OSC escape bytes could leak to a non-supporting terminal / pipe (RISK-2 capability). | The `notify.ts` capability-gate shape: no-op off-TTY, multiplexer-suppressed, degrade to plain text; exact-byte + every-branch tests (T4.1). |

## Failure scenarios (when I/O external)

The external-I/O surfaces are (a) the terminal width for tables, (b) `setTerminalTitle`/
`osc8Link` writing escape bytes, (c) the terminal capability env. Handled: the table
degrades (never overflows) via the width-matrix-gated algorithm; the OSC helpers are
no-ops off-TTY, suppressed under multiplexers, and emit only exact known-safe bytes
(injectable-env branch tests catch a mis-detected terminal in a unit test, not
production). No network/DB/queue beyond the one pure dep (`diff`), so no
timeout/5xx/retry scenarios apply.

## Unresolved Questions

(none — every decision is resolved at plan time). The blueprint's two forks are
RESOLVED in the ADRs: table degrade is aligned plain text (A), intra-line pairing is
equal-length runs (B). The `diff` dependency is gated by `/deps-audit` (T2.1) — a
process step, not an open question.

## Test Plan

- **Unit (pure):** `markdown-table.test.ts` (width + degrade, 100% branch), `diff-word.test.ts` (pairing + segmentation, 100% branch), `terminal-osc.test.ts` (capability + exact bytes, 100% branch), `markdown-model.test.ts` additions (table parse + fail-soft).
- **Component (itl-adapter):** `markdown-text.test.tsx` table render + **width-matrix**; `diff-viewer.test.tsx` intra-line on/off/no-color; `expandable-output.test.tsx` + `tool-result`/`code-block` interactive mode.
- **Dual-render parity:** the M20 harness for the table + intra-line render (Ink vs V4 byte-identical).
- **Example smoke:** `tests/example-parity-polish.integration.test.ts` (piped render + clean exit).
- **Audit (T6.1):** the refutation panel; each ✓ cites component + oracle + example.
- **Regression harness:** the existing MarkdownText / DiffViewer / ToolResult / CodeBlock tests stay green (tables/intra-line/interactive are additive; opt-in off is byte-identical).

## Global Definition of Done

- [ ] All 6 phases' DoD checked.
- [ ] Tables / intra-line highlight / ExpandableOutput / `setTerminalTitle` / `osc8Link` exported from `src/index.ts` (or wired into their host components).
- [ ] One new dependency (`diff`), `/deps-audit`-cleared; no `output-engine`/`renderer` change.
- [ ] Quality gates: `pnpm gates` (prettier + lint + typecheck + test + build) green twice consecutively; new pure modules 100% branch-covered; complexity ≤10.
- [ ] Table width-matrix oracle green (no row exceeds `columns`, narrow → plain-text degrade); `intraLineHighlight` off byte-identical; OSC helpers no-op off-TTY + multiplexer-suppressed.
- [ ] `examples/parity-polish.tsx` runs + smoke-clean; dual-render parity holds for the new renders.
- [ ] The adversarial re-audit ran; `docs/v4-parity-matrix.md` flipped with per-row evidence; `docs/renderer/m25-parity-report.md` written as the release artifact; CHANGELOG `[Unreleased]` complete; blueprint + plan cross-referenced.
