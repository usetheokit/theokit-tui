---
slug: ascii-banner-header
generated_by: roadmap-feature
new_milestone_id: M27
date: 2026-07-10
status: completed
out_of_scope_overlap_false_positive: "Generic TUI components (layout widgets)" — the <Banner> is an AGENT-SURFACE primitive (WelcomeBanner family, already shipped), not a generic widget. The EXCLUDED part (interactive TUI designer + 400-font library AS AN APP) is NOT being built — user consciously chose the component route (figlet as optional peer, not a designer app).
---

# Feature grill — ascii-banner-header (M27)

One-line: a <Banner> agent-surface component — big ASCII-art logo (ready `art`
string OR generated from `text`+`font` via an OPTIONAL figlet peer, degrades to
bold name if absent) + an optional framed status panel (model/agent/dir rows in a
themed bordered box). Layout: minimal|banner. Qwen/OpenCode-style startup header.

## Pre-answered scope (from the AskUserQuestion before the grill)
- ASCII art: figlet as OPTIONAL peer (400 fonts via `text`+`font`; `art` string zero-dep; degrade to bold name).
- Delivery: roadmap M27 + full CYCLE.

## Q1 — What is this feature and why now?
A `<Banner>` agent-surface component that elevates the first-run experience: an
ASCII-art logo (ready `art` OR figlet peer) + an optional framed status panel
(model/agent/dir), with a `minimal|banner` layout. Why now: explicit user request
(Qwen/OpenCode parity); the current header is minimal (name+model only) and it is
the first impression of any agent CLI built on the lib. Extends the
WelcomeBanner/AppStatusBar family.

## Q2 — Dependencies (which milestones must be [x])?
M9 (WelcomeBanner — the family the Banner extends) + M25 (V4 parity polish — the
complete renderer). Both already [x], so M27 is immediately eligible.

## Q3 — Definition of Done (3-5 verifiable bullets)?
1. `<Banner>` renders an ASCII-art logo: a ready `art` string (rendered verbatim,
   themed accent) OR degrades to the bold product name when absent (WelcomeBanner
   style). The component is PURE/sync (no async in render). (snapshot tests)
2. Optional framed status panel: `status?: {label,value}[]` in a themed bordered
   box (round/accent; single under monochrome) — the `┌─ model/dir ─┐` look.
   (snapshot test)
3. Layout `layout?: 'minimal' | 'banner'` (default `minimal` = current behavior;
   `banner` = art + status panel). Non-breaking.
4. `renderFigletArt(text, font?)` async helper: `figlet` is an OPTIONAL peer
   (peerDependenciesMeta optional). When absent → returns null → app falls back to
   the bold name. A test proves the degrade WITHOUT figlet installed.
5. Live tmux evidence of the banner layout + gates green + export-surface updated.

## Q4 — Top 2 NEW risks?
- R1 (optional-peer degrade): `figlet` as an OPTIONAL peer must degrade cleanly when
  absent — a hard import would break consumers without it. Mitigation: dynamic import
  + null return + a test that runs WITHOUT figlet (CodeBlock/highlighter precedent).
- R2 (art width/wrap): block-letter art is wide (>80 cols) and multi-line; it can
  overflow narrow terminals and misalign next to the status box. Mitigation: art in
  its own Box (no wrap-mangling); side-by-side layout degrades to stacked when narrow;
  width-matrix oracle + live tmux check.
