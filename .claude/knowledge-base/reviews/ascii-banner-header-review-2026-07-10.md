# Review — ascii-banner-header (M27)

**Verdict:** READY_TO_MERGE
**Date:** 2026-07-10
**Slug:** ascii-banner-header · **Milestone:** M27
**Commits reviewed:** 93b5590→HEAD (discover+plan, impl)

## Panel (2 consolidated specialist agents)

| Agent | Verdict | Summary |
|---|---|---|
| architecture + wiring | READY | `<Banner>` purely presentational (pure/sync, no I/O); figlet isolated in `renderFigletArt` (DIP loader seam); variable-specifier dynamic import genuinely evades build-time resolution (tsc exit 0 with figlet ABSENT); optional peer mirrors lowlight; wiring triad holds (example caller + integration test + guarded exports); complexity ≤10; no dead code. |
| test + domain (TUI) + cross-validation | READY_TO_MERGE | All 5 DoD bullets evidence-backed; EDGE + NEGATIVE cases present (figlet absent + unknown font → typed null, not throw); `bannerArtWidth` uses display width (string-width); art rendered verbatim (`flexShrink={0}`, no wrap-mangling); name degrade single-line; example comment honest. |

## DoD (5/5) evidence

1. `<Banner>` art verbatim OR bold-name degrade — `renders_provided_art_verbatim`, `multiline_art_keeps_every_line`, `degrades_to_the_bold_name_when_art_is_absent` (asserts `[1m` + no art), version test.
2. Framed status panel + monochrome degrade — `renders_each_label_value_row_in_a_bordered_box`, `monochrome_status_panel_degrades_to_a_single_border_no_accent`.
3. `layout minimal|banner` non-breaking — `banner_layout_stacks_the_art_above_the_status_panel`, `minimal_layout_omits_the_status_panel`; default `minimal`.
4. `renderFigletArt` optional peer, null when absent — `returns_null_when_figlet_is_absent` (real figlet-less repo, default loader), injected-loader, unknown-font→null, font-option; `package.json` optional peer guarded by export-surface.
5. Live tmux evidence + gates + export-surface — integration test asserts art fragment `|_.__/` + `model` + `theo-demo-1`; live tmux confirmed the ASCII logo + framed box.

## Gate status

- `pnpm gates`: green (1110 tests, 112 files, build ok; complexity ≤10; prettier/lint/typecheck clean — verified WITH figlet uninstalled).
- `/code-quality`: **PASS** (cap 100, 0 hard/soft caps).
- `/plan-confidence`: **SHIPPABLE 98.8** (0 caps, coverage 100%).

## INFO (non-blocking, no action)

- `@types/figlet` intentionally NOT added (FigletLike typed locally — KISS).
- `renderFigletArt` degrades silently (caller-invoked) vs CodeBlock's console.warn (auto-loaded) — intentional.
- Uncovered branches (`banner.tsx` accent-on-name-path; `figlet-art.ts` installed-default-export) are unreachable in the figlet-less test env, not missing negatives.
- Monochrome oracle is basic-16-specific — sound for this project's palette.

No BLOCKER/HIGH/MEDIUM/LOW. **READY_TO_MERGE.**
