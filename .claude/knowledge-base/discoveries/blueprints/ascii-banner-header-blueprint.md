---
slug: ascii-banner-header
milestone_id: M27
kind: discovery-blueprint
date: 2026-07-10
owner: auto-plan (Staff-level deep research)
sources: gemini-cli/packages/cli/src/ui, oh-my-logo/src, opencode/packages/tui
verdict_target: SHIPPABLE_WITH_CAVEATS
---

# Blueprint — `<Banner>` ASCII-art header (figlet peer + framed status panel)

How SOTA agent CLIs render a startup banner (big ASCII-art logo + framed status
header) and generate art from text (figlet), distilled into decisions for a new
Ink/React `<Banner>` component. Every claim cites a real file under
`.claude/knowledge-base/references/`.

## Objective

A `<Banner>` agent-surface component: a big ASCII-art logo (ready `art` string, or
degrade to the bold product name when absent) + an optional framed status panel
(model/agent/dir rows in a themed bordered box), `minimal|banner` layout — extends
the WelcomeBanner/AppStatusBar family. figlet generation is an OPTIONAL peer via an
async helper.

## Coverage Corner 4 — Techniques (the core idiom)

### T1 — ASCII art is a rendered string block (pre-rendered or figlet-generated)

- **gemini-cli** stores art as literal string constants in THREE size variants
  (`shortAsciiLogo`/`longAsciiLogo`/`tinyAsciiLogo`) and selects one by terminal
  width (`gemini-cli/packages/cli/src/ui/components/AsciiArt.ts:7`; selection in
  `.../components/Header.tsx:28`). Art renders in a `<Box flexShrink={0}>` so the
  layout never compresses it (`.../components/Banner.tsx:60`).
- **opencode** stores art as arrays of parallel rows (`opencode/packages/tui/src/logo.ts:1`).

**Decision (ADR-1):** `<Banner>` is PURE/sync and renders a provided `art` STRING
verbatim in its own `<Box flexDirection="column">` (each line a `<Text>`), themed
with the accent. No async in render. When `art` is absent it degrades to the bold
product `name` (the WelcomeBanner idiom). The consumer chooses the art (and its
size) — mirroring gemini's app-side variant selection.

### T2 — figlet is a SYNC generator; wrap it in an OPTIONAL async peer helper

- **oh-my-logo** generates art via `figlet.textSync(text, { font, width: 80,
  whitespaceBreak: true })` — SYNCHRONOUS (`oh-my-logo/src/renderer.ts:12`). It
  wraps the sync call in an `async render()` only for API consistency
  (`oh-my-logo/src/lib.ts:62`). figlet is a hard dep there.

**Decision (ADR-2):** ship `renderFigletArt(text, font?): Promise<string | null>` —
an async helper that DYNAMICALLY imports `figlet` (an OPTIONAL peer via
`peerDependenciesMeta.figlet.optional`), calls `figlet.textSync` internally, and
returns the art string — or `null` when figlet is not installed (caught import
error) or the font is unknown. The app calls it and passes the result as `art`;
`null` → the app falls back to `name`. This is the CodeBlock/highlighter
optional-peer precedent already in the repo. The component never imports figlet
(stays pure/sync).

### T3 — Width handling: measure widest line; the consumer owns fit

- **gemini-cli** measures art width as the longest line
  (`getAsciiArtWidth = Math.max(...lines.map(l => l.length))`,
  `gemini-cli/packages/cli/src/ui/utils/textUtils.ts:19`) and picks a smaller
  variant when the terminal is narrow (`.../Header.tsx:28`). No truncation.

**Decision (ADR-3):** `<Banner>` renders the given `art` verbatim (`flexShrink={0}`)
— it does NOT truncate or wrap art (that would mangle block letters). The DEGRADE
path (bold `name`) is single-line and never overflows. A `bannerArtWidth(art)`
helper (max line length via `string-width`, the repo oracle) is exported so the app
can pick a fit — mirroring gemini's app-side selection. RISK-2 (art width) is thus
owned by the consumer for `art`, and structurally safe on the `name` degrade.

### T4 — Framed status panel = a themed bordered box of rows

- **opencode** frames session panels with box-drawing borders (a left `┃` edge /
  custom border chars) showing model/dir/status
  (`opencode/packages/opencode/src/cli/cmd/run/footer.command.tsx:60`).
- **gemini-cli** `Banner.tsx` wraps content in `<Box borderStyle="round">` with
  `borderColor` + `paddingX` (`.../components/Banner.tsx:60`).

**Decision (ADR-4):** `status?: {label,value}[]` renders in a `<Box
borderStyle="round" paddingX={1}>` (accent border; `single` + no accent under
monochrome — the M25/ComposerFrame idiom), one `label value` row per entry. Reuses
the existing bordered-box pattern; no new border lib (we already have `cli-boxes`).

### T5 — Layout: minimal (name) vs banner (art stacked above status)

- gemini renders logo + a small side label, and stacks major sections vertically
  (`.../Header.tsx:44`).

**Decision (ADR-5):** `layout?: 'minimal' | 'banner'` (default `minimal` = the bold
name only, current behavior). `banner` stacks the art ON TOP of the status panel
(vertical) — narrow-safe (no side-by-side overflow, mitigating RISK-2). Side-by-side
is a documented future option, deferred (YAGNI).

## Coverage Corner 1 — Integration tests

- Peers snapshot the rendered art block. Our convention (testing.md §5) is
  `renderFrame()` + ANSI-strip snapshots. **Decision:** snapshot the `art` path, the
  `name` degrade path, and the status-panel box; a NEGATIVE test drives
  `renderFigletArt` with figlet ABSENT (asserting `null`), proving the optional-peer
  degrade WITHOUT installing figlet.

## Coverage Corner 2 — Dependencies

- `figlet` is an OPTIONAL peer (`peerDependenciesMeta.figlet.optional = true`) — NOT
  a runtime dep, so consumers who only want the status box / `art` string pull zero
  extra weight (parsimony ladder rung 4). `@types/figlet` as a devDep for the helper
  typing. `string-width` (already a dep) measures art width. **Decision (ADR-6):** no
  new REQUIRED runtime dep. `/deps-audit` clears the optional peer.

## Coverage Corner 3 — Tools

- Reuse `pnpm gates` + the existing snapshot infra + `renderFrame`. To exercise the
  figlet-PRESENT path in a test without adding a hard dep, the helper accepts an
  injected loader (DIP) so a test can pass a fake figlet — the notify.ts/terminal-osc
  injectable-seam precedent. No new tooling.

## ADRs

| ADR | Decision | Rationale |
|---|---|---|
| ADR-1 | `<Banner>` is pure/sync; renders `art` string OR degrades to bold `name` | gemini renders a string block; keeps render sync (no async-in-render) |
| ADR-2 | `renderFigletArt(text,font?)` async helper; figlet = OPTIONAL peer, returns null when absent | oh-my-logo uses `figlet.textSync`; optional-peer = CodeBlock/highlighter precedent |
| ADR-3 | Art rendered verbatim (`flexShrink={0}`), no truncation; export `bannerArtWidth` | block letters must not wrap; consumer owns fit (gemini app-side selection) |
| ADR-4 | Status panel = themed bordered box of `{label,value}` rows | opencode/gemini bordered-box idiom; reuse `cli-boxes` (no new dep) |
| ADR-5 | `layout: minimal\|banner`; banner stacks art above status (vertical) | narrow-safe; side-by-side deferred (YAGNI) |
| ADR-6 | No new REQUIRED dep; figlet optional peer + injectable loader for tests | parsimony; testability without a hard dep |

## Risks (carried into the plan)

1. **Optional-peer degrade** — a hard `import 'figlet'` would break consumers without
   it. Mitigation: dynamic `import()` in `renderFigletArt`, catch → return null; a
   test runs with figlet ABSENT and asserts null (the current repo state — figlet is
   NOT installed, verified).
2. **Art width/overflow** — wide block art can overflow a narrow terminal. Mitigation:
   render verbatim in its own box (no mangling); `bannerArtWidth` lets the app pick a
   fit; the `name` degrade is single-line; banner layout stacks (no side-by-side).

## Project-rule alignment

- `rules/architecture.md` — the component stays presentational; figlet I/O is an
  injectable async helper at the boundary (DIP), never in render.
- `rules/testing.md §5` — snapshot via `renderFrame`; NEGATIVE case = figlet absent
  (typed null return, not a throw).
- `rules/parsimony-ladder.md` — rung 4 (reuse `cli-boxes`/`string-width`; figlet is an
  OPTIONAL peer, not a required dep); rung 1 (side-by-side layout deferred — YAGNI).

## Acceptance (feeds `/to-plan`)

Every M27 DoD bullet maps to a technique above; the plan decomposes into: (P1)
`<Banner>` pure component (art + name degrade), (P2) framed status panel + layout,
(P3) `renderFigletArt` optional-peer helper + degrade test, (P4) example + live
evidence.
