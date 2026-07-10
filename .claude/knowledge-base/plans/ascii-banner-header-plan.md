---
slug: ascii-banner-header
milestone_id: M27
created_at: 2026-07-10
goal: Ship a `<Banner>` agent-surface component — a big ASCII-art logo (ready `art` string, or degrade to the bold product name when absent) + an optional framed status panel (model/agent/dir rows in a themed bordered box), with a `minimal|banner` layout — plus a `renderFigletArt` async helper that generates art via an OPTIONAL `figlet` peer and degrades to null when absent. Extends the WelcomeBanner/AppStatusBar family; a Qwen/OpenCode-style polished agent-CLI startup header.
---

# Plan: ascii-banner-header (M27)

## Goal

Deliver a `<Banner>` component and a figlet helper: (1) **`<Banner>`** renders a
provided `art` string verbatim (themed accent, in its own `flexShrink` box) OR
degrades to the bold product `name` (the WelcomeBanner idiom) when `art` is absent —
PURE/sync, no async in render; (2) an **optional framed status panel**
(`status?: {label,value}[]`) in a themed bordered box (round/accent; `single` under
monochrome — the ComposerFrame idiom); (3) a **`layout: 'minimal' | 'banner'`** prop
(default `minimal` = bold name only, current behavior; `banner` stacks the art above
the status panel — narrow-safe, no side-by-side overflow); (4) **`renderFigletArt(text,
font?)`** — an async helper that dynamically imports `figlet` (an OPTIONAL peer) and
returns the generated art string, or `null` when figlet is absent or the font is
unknown, so the app falls back to `name`; (5) a **`bannerArtWidth(art)`** pure helper
(widest line via `string-width`) so the app can pick a fitting art. No new REQUIRED
runtime dependency; figlet is an optional peer. House rules hold:
presentational/declarative, degrade-as-data, DIP for the figlet I/O seam.

## Baseline Context

### Files that will be touched

| File | LoC | Role | Change |
|---|---|---|---|
| `src/banner.tsx` | new | the `<Banner>` component + status panel | created |
| `src/banner.test.tsx` | new | banner render + degrade + status snapshots | created |
| `src/figlet-art.ts` | new | `renderFigletArt` + `bannerArtWidth` helpers | created |
| `src/figlet-art.test.ts` | new | figlet-absent degrade + width, injectable loader | created |
| `src/index.ts` | ~195 | public surface | export `Banner`, `renderFigletArt`, `bannerArtWidth`, types |
| `package.json` | — | manifest | `peerDependenciesMeta.figlet.optional`; `@types/figlet` devDep |
| `examples/banner.tsx` | ~30 | banner example | extend with the new `<Banner>` layout |
| `tests/export-surface.test.ts` | — | surface guard | assert `Banner`/`renderFigletArt` exposed |
| `CHANGELOG.md` | — | contract | `[Unreleased]` entry |

### Current callers / dependents (READ — the integration seams)

- `WelcomeBanner` (`src/welcome-banner.tsx`) renders `name` bold + accent + tagline
  + hints in an accent box — the DEGRADE target the `<Banner>` name-path mirrors.
- `AppStatusBar` (`src/app-status-bar.tsx`) renders `model · cwd · tokens · state`
  one-line — the status-content precedent (Banner's panel is the bordered variant).
- `isMonochrome(theme)` + `theme.accent` + `theme.role` drive the border/degrade —
  the ComposerFrame (`src/chat-composer.tsx`) bordered-box idiom is reused.
- `string-width` is already a dependency (`output-grid.ts`, `markdown-table.ts`).
- `figlet` is NOT installed (verified `node -e require.resolve` → absent) — the
  optional-peer degrade path is the DEFAULT test environment.

### Domain glossary

- **art** — a multi-line ASCII-art string (block letters) rendered verbatim.
- **degrade path** — when `art` is absent, `<Banner>` renders the bold `name`.
- **status panel** — a themed bordered box of `{label,value}` rows.
- **optional peer** — `figlet` declared in `peerDependenciesMeta` as optional; a
  dynamic import that catches absence and returns null.

### Architecture boundaries affected

Presentational (`rules/architecture.md`): `<Banner>` is pure/sync, no I/O. The figlet
generation is an async helper at the boundary (DIP — an injectable loader), never in
render. No new required dependency.

## Prior Art

The discovery blueprint
(`.claude/knowledge-base/discoveries/blueprints/ascii-banner-header-blueprint.md`)
distilled the idiom with verified citations: gemini-cli
`gemini-cli/packages/cli/src/ui/components/AsciiArt.ts:7` (art as string constants) +
`.../components/Header.tsx:28` (width-variant selection) + `.../components/Banner.tsx:60`
(`flexShrink` box + round border) + `.../utils/textUtils.ts:19` (max-line width);
oh-my-logo `oh-my-logo/src/renderer.ts:12` (`figlet.textSync`); opencode
`opencode/packages/tui/src/logo.ts:1` (art rows) +
`opencode/packages/opencode/src/cli/cmd/run/footer.command.tsx:60` (framed status box).

## ADRs

### A — `<Banner>` is pure/sync; renders `art` string OR degrades to bold `name`
gemini renders a string block; keeping render sync (no async) means figlet lives in a
separate helper. Alternative rejected: generate art inside the component (would force
async render or a hard figlet dep).

### B — `renderFigletArt` is an async optional-peer helper returning `string | null`
oh-my-logo calls `figlet.textSync`; we wrap it behind a dynamic `import('figlet')`
that catches absence → null (the CodeBlock/highlighter precedent). The helper accepts
an injectable loader (DIP) so a test can exercise the figlet-PRESENT path without a
hard dep. Alternative rejected: hard figlet dep (weight on every consumer).

### C — Status panel is a themed bordered box of `{label,value}` rows
Reuses the ComposerFrame bordered-box idiom (round/accent; single monochrome) — no new
border lib (`cli-boxes` already present). Alternative rejected: a custom border-char
API (YAGNI).

### D — `layout: minimal|banner`; banner stacks art above the status panel
Stacking is narrow-safe (no side-by-side overflow — RISK-2). Side-by-side deferred
(YAGNI). `minimal` (default) preserves the current name-only behavior (non-breaking).

### E — Art rendered verbatim (`flexShrink={0}`), no truncation; export `bannerArtWidth`
Block letters must not wrap/truncate. The consumer owns fit (gemini app-side variant
selection); `bannerArtWidth` (max line via `string-width`) helps them pick.

## Dependencies

No new REQUIRED runtime dependency. `figlet` is added as an OPTIONAL peer
(`peerDependenciesMeta.figlet.optional = true`) — pulled only by consumers who want
text→art generation. `@types/figlet` is a devDependency (helper typing). `string-width`
(already declared) measures art width; `cli-boxes` (already declared) backs the border.
`/deps-audit` runs to confirm no CVE on the optional peer + the type package.

## Critical paths

- `src/banner.tsx` — the component (art path + name degrade + status panel + layout).
- `src/figlet-art.ts` — the optional-peer helper (dynamic import + null degrade).

## Phase 1: `<Banner>` component — art path + name degrade (ADR A, E)

### T1.1 — `src/banner.tsx` renders `art` verbatim OR degrades to the bold name

#### Objective
Build `<Banner>` with props `{ art?, name, version?, status?, layout? }`. When `art`
is a string, render it verbatim in a `<Box flexDirection="column">` (each line a
`<Text>`, accent-colored), `flexShrink={0}` so layout never compresses it. When `art`
is absent, render the bold `name` (+ dim ` v{version}`) — the WelcomeBanner degrade.
Export a pure `bannerArtWidth(art)` (widest line via `string-width`).

#### Why this step
The art/degrade core is DoD item 1 and the highest-visibility surface; building it
pure/sync first (no figlet) de-risks the render before the peer helper.

#### Evidence
Blueprint ADR A/E, §T1/T3; gemini `AsciiArt.ts:7`, `Banner.tsx:60`, `textUtils.ts:19`;
current degrade target `src/welcome-banner.tsx`; `string-width` (`output-grid.ts:7`).

#### TDD
- RED `banner.test.tsx` (renderFrame): `test_renders_provided_art_verbatim` (frame `contains` the art lines), `test_degrades_to_bold_name_when_art_absent` (frame `contains` the name, no art), `test_version_renders_dim_after_name_on_degrade`, `test_multiline_art_keeps_every_line` (line count `equals` the art's).
- RED `bannerArtWidth` pure: `test_width_is_the_widest_line`, `test_empty_art_width_is_zero`, `test_cjk_art_counts_display_width` (`string-width`).
- GREEN: the component + `bannerArtWidth` (complexity ≤10 via a `NameHeader` sub-view).

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `bannerArtWidth` is pure, 100% branch-covered; complexity ≤10.
- [ ] With `art`, the frame `asserts` every art line renders verbatim; with no `art`, the frame `asserts` the bold `name` (degrade) and NO art.
- [ ] `test_multiline_art_keeps_every_line` `asserts` the rendered line count `equals` the art line count (no wrap/truncation).
- [ ] `pnpm gates` green.

#### DoD
- [ ] `<Banner>` art + name-degrade land; `banner.tsx`/`figlet-art.ts` (width) covered; CHANGELOG `[Unreleased]` updated.

## Phase 2: Framed status panel + layout (ADR C, D)

### T2.1 — status panel box + `layout: minimal|banner`

#### Objective
Add `status?: {label,value}[]` → a `<Box borderStyle="round" paddingX={1}>` (accent;
`single` + no accent under monochrome — ComposerFrame idiom), one `label value` row
per entry (label dim, value normal). Add `layout?: 'minimal' | 'banner'` (default
`minimal` = name-only; `banner` stacks the art/name ABOVE the status panel).

#### Why this step
The framed status box + layout is DoD items 2-3, completing the Qwen/OpenCode look
around the art from T1.1.

#### Evidence
Blueprint ADR C/D, §T4/T5; opencode `footer.command.tsx:60`; gemini `Banner.tsx:60`
(round border); ComposerFrame `src/chat-composer.tsx` (bordered-box degrade idiom).

#### TDD
- RED `banner.test.tsx`: `test_status_panel_renders_each_label_value_row` (frame `contains` each `label`+`value`), `test_status_panel_box_is_bordered` (frame `contains` a box-drawing char), `test_monochrome_status_panel_degrades_to_single_border` (no accent SGR; box still present), `test_banner_layout_stacks_art_above_status` (art line index `<` status line index), `test_minimal_layout_omits_the_status_panel`.
- GREEN: the `StatusPanel` sub-view + the layout switch (complexity ≤10 via helpers).

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] Each `{label,value}` `renders` as a row inside a bordered box; monochrome `asserts` a border with no accent SGR (degrade-as-data).
- [ ] `banner` layout `asserts` the art appears ABOVE the status panel; `minimal` `asserts` NO status panel.
- [ ] `pnpm gates` green; export-surface stays green.

#### DoD
- [ ] Status panel + layout land as the default `minimal`/opt-in `banner`; snapshots green; CHANGELOG updated.

## Phase 3: `renderFigletArt` optional-peer helper (ADR B)

### T3.1 — `src/figlet-art.ts` generates art via an OPTIONAL figlet peer, degrades to null

#### Objective
Add `renderFigletArt(text, font?, loader?)` — async. It resolves a figlet module via
`loader` (default: `() => import('figlet')`, DIP seam), calls `figlet.textSync(text,
{ font, width, whitespaceBreak: true })`, and returns the art string — OR `null` when
the import fails (peer absent) or `textSync` throws (unknown font). Declare figlet as
an OPTIONAL peer in `package.json`.

#### Why this step
The optional-peer helper is DoD item 4 — the "400 fonts" value without a hard dep.
Doing it last means the pure component (P1/P2) is already proven.

#### Evidence
Blueprint ADR B, §T2; oh-my-logo `renderer.ts:12` (`figlet.textSync`); optional-peer
precedent `src/code-block.ts` (highlighter); injectable-seam precedent `src/notify.ts`.

#### TDD
- RED `figlet-art.test.ts`: `test_returns_null_when_figlet_is_absent` (default loader; figlet is NOT installed → null — the real repo state), `test_generates_art_via_an_injected_figlet_loader` (fake loader returning a `{ textSync }` stub → the stub's output), `test_returns_null_on_an_unknown_font` (stub `textSync` throws → null), `test_passes_the_font_option_to_textSync` (assert the option object).
- GREEN: the helper (dynamic import + try/catch → null; complexity ≤10).

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — the figlet module + font files)
- figlet ABSENT (the default env) MUST return `null`, never throw — a hard import
  would crash every consumer without figlet; the default-loader test proves it. An
  UNKNOWN font (`textSync` throws) MUST also return `null` (caught), so a bad `font`
  degrades to the `name` path rather than crashing the banner.

#### Acceptance Criteria
- [ ] `renderFigletArt` is 100% branch-covered (absent → null, present → art, bad font → null).
- [ ] `test_returns_null_when_figlet_is_absent` `asserts` `null` with figlet uninstalled (no throw).
- [ ] `package.json` declares `figlet` in `peerDependenciesMeta` as optional; `/deps-audit` clears it.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `renderFigletArt` + optional-peer manifest land; degrade proven WITHOUT figlet; CHANGELOG updated.

## Phase 4: Example + live evidence (DoD 5)

### T4.1 — wire `examples/banner.tsx` to the `<Banner>` banner layout + capture live tmux

#### Objective
Extend `examples/banner.tsx` to render the `<Banner>` in `banner` layout: a provided
`art` string (a small block-letter logo) + a status panel (`model`/`cwd` rows). Capture
a live tmux frame into the example header comment / parity note.

#### Why this step
DoD item 5 — evidence the banner renders end-to-end at real width, not just snapshots.

#### Evidence
Current `examples/banner.tsx` (WelcomeBanner demo); tmux session `theokit` (the QA harness).

#### TDD
- RED `tests/example-banner.integration.test.ts`: piped render `contains` the art + a status row, exits clean (deterministic, non-TTY).
- GREEN: the example edit; the captured tmux frame pasted into the example header.

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — terminal dims)
- At a narrow terminal the provided `art` renders verbatim (the consumer's choice); the
  `name` degrade path (no art) MUST stay single-line and never overflow; the status
  panel border MUST stay intact. Proven by the T1.1 width test + the live capture.

#### Acceptance Criteria
- [ ] The example integration test `asserts` the piped banner `contains` the art + a status row and exits `0`.
- [ ] A live tmux capture of the banner layout is embedded in the example/parity note.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `examples/banner.tsx` renders the new `<Banner>`; live evidence captured; CHANGELOG updated.

## Coverage Matrix

| Goal claim | Task(s) |
|---|---|
| `<Banner>` renders `art` verbatim OR degrades to bold `name` (pure/sync) | T1.1 |
| `bannerArtWidth` pure width helper | T1.1 |
| Framed status panel (`{label,value}` bordered box, monochrome degrade) | T2.1 |
| `layout: minimal\|banner` (default minimal; banner stacks art above status) | T2.1 |
| `renderFigletArt` optional-peer helper; null when figlet absent | T3.1 |
| No new REQUIRED dep; figlet optional peer cleared | Dependencies + T3.1 (deps-audit) |
| New surface default-safe; export-surface green | T1.1, T2.1, T3.1 |
| Live tmux evidence + per-path snapshots | T1.1, T2.1, T4.1 |
| Optional-peer degrade WITHOUT figlet — risk 1 | T3.1 |
| Art width/overflow owned by consumer; name degrade single-line — risk 2 | T1.1 |

## Drawbacks & Risks

| # | Risk / drawback | Mitigation |
|---|---|---|
| 1 | A hard `import 'figlet'` breaks consumers without the peer. | `renderFigletArt` uses a dynamic `import()` (injectable loader) + try/catch → null; a test asserts null with figlet ABSENT (the real repo state) (T3.1). |
| 2 | Wide block art overflows a narrow terminal / misaligns beside a status box. | Art rendered verbatim in its own box (no mangling); banner layout STACKS (no side-by-side); `bannerArtWidth` lets the app pick a fit; the `name` degrade is single-line (T1.1/T2.1). |
| 3 | `art`/`name` are consumer strings — ANSI/control chars could misrender. | Rendered via `<Text>` (no eval); the name path single-lines like WelcomeBanner; documented consumer responsibility (M2 EC-16 precedent). |
| 4 | Adding an optional peer + a type dep grows the manifest. | Optional (not installed by default) → zero weight for non-users; `/deps-audit` clears CVEs (T3.1). |

## Failure scenarios (when I/O external)

The external surfaces are (a) the terminal width for the art, and (b) the figlet module
load. Handled: the art renders verbatim (consumer owns fit) and the `name` degrade never
overflows; `renderFigletArt` returns null (never throws) when figlet is absent or the
font is unknown — proven by the default-loader test in the current figlet-less repo. No
network/DB/queue/RPC is touched, so no timeout/5xx/retry scenarios apply.

## Unresolved Questions

(none — every decision is resolved at plan time). The design forks are RESOLVED in the
ADRs: the component is pure and figlet lives in an async helper (A/B); the status panel
reuses the ComposerFrame border (C); the layout stacks, side-by-side deferred (D). The
figlet optional-peer + `@types/figlet` are gated by `/deps-audit` (a process step, not
an open question).

## Test Plan

- **Unit (pure):** `bannerArtWidth` (widest line, empty, CJK — 100% branch);
  `renderFigletArt` (absent→null, injected-present→art, bad-font→null — 100% branch).
- **Component (renderFrame):** `banner.test.tsx` — art verbatim, name degrade, version,
  multiline; status panel rows + border + monochrome degrade; layout minimal vs banner.
- **Integration:** `tests/example-banner.integration.test.ts` (piped banner `contains`
  art + status row, clean exit).
- **Live:** tmux capture of the banner layout embedded in the example/parity note.
- **Regression harness:** existing WelcomeBanner / AppStatusBar tests stay green (the
  Banner is additive); export-surface stays green.

## Global Definition of Done

- All five M27 DoD bullets validated with evidence (snapshots + live tmux frame).
- `pnpm gates` green (prettier + lint ≤10 complexity + typecheck + test + build).
- New pure modules 100% branch-covered; CHANGELOG `[Unreleased]` updated.
- `/code-quality` verdict ∈ {PASS, PASS_WITH_CAVEATS}; `/review` = READY_TO_MERGE.
- figlet declared as an OPTIONAL peer; the degrade proven WITHOUT it installed.
