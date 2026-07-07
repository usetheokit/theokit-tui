---
slug: m9-welcome-banner
milestone_id: M9
created_at: 2026-07-07
goal: Ship the WelcomeBanner primitive — accent-bordered startup banner (name/version/tagline/hints/children) with width clamp + plain-text final rung, theme-token color, NO_COLOR-clean, zero new dependencies.
---

# Plan: m9-welcome-banner

## Goal

Ship `WelcomeBanner` — the Claude Code/gemini-cli-style startup banner as an
@theokit/tui primitive: props `name`/`version?`/`tagline?`/`hints?`/`children`,
accent-bordered box clamped to `min(columns ?? 60, 60)` with a plain-text
final rung below the 24-col floor, colors exclusively via M6 theme tokens
(NO_COLOR-clean), fail-fast typed prop validation, zero new dependencies —
wired through the composition root with example + smoke, per blueprint
`.claude/knowledge-base/discoveries/blueprints/m9-welcome-banner-blueprint.md`
(SHIPPABLE 98.2) and the M9 grill
(`.claude/knowledge-base/grills/welcome-banner-feature-grill.md`).

## Baseline Context

Repo state at planning: develop @ `7144e62` (post v0.8.0 release chain;
430/430 tests green; version 0.8.0).

### Files that will be touched

| File | LoC | Role for M9 |
|---|---|---|
| `src/theme.tsx` | 403 | M6 tokens consumed: `theme.accent` (border+name); `isMonochrome(theme)` (module export, line 384) drives the border-style branch; NO_COLOR swap lives in the provider (lines 327-341) — the banner never reads env |
| `src/context-window-bar.tsx` | 139 | The house static-component shape M9 mirrors (props validation, width handling, dimColor idiom) |
| `src/context-window-bar.test.tsx` | ~300 | The house unit-suite shape: boundary pairs, width sweep, batched snapshots, typed-error negatives, token assert |
| `src/index.ts` | ~120 | Composition root — gains the `WelcomeBanner` export (+ props type) |
| `tests/fixtures/no-color-probe.tsx` | 87 | All-primitives degrade fixture — gains one `<WelcomeBanner>` (zero new spawns) |
| `tests/degrade-matrix.integration.test.tsx` | ~135 | `assertDegradedScene` gains banner asserts (name/hint presence; border-glyph policy) |
| `tests/public-api.integration.test.tsx` | ~430 | Gains the M9 composed scene + 1 anchored snapshot |
| `tests/export-surface.test.ts` | ~150 | Gains presence pins (WelcomeBanner) |
| `examples/` + `package.json` | — | Gain `examples/banner.tsx` + `example:banner` script + smoke |

### Current callers / dependents

- `src/welcome-banner.tsx` is NEW — zero existing callers; first callers land
  in the same milestone (entry export consumed by the public-api scene,
  degrade fixture, and `examples/banner.tsx`).
- Consumed symbols (additive, unmodified): `useTheoTheme`/`isMonochrome`
  (`src/theme.tsx` — module import for the predicate, entry-absent by M6
  design), ink `Box`/`Text`/`useStdout`.
- No existing production symbol is modified — M9 is purely additive.

### Domain glossary

- **floor** = 24 columns — below it the bordered box no longer
  yields a legible line (width − 2 border − 2 padding = 20 usable), so the
  final rung renders one plain `<Text>` (`{name} v{version}`).
- **final rung** = codex-style explicit degrade step (blueprint Corner 4 §
  Width, closing gemini's EC-5 hole).
- **anchor-then-snapshot** = house convention pinning load-bearing strings
  before `toMatchSnapshot`.

### Architecture boundaries affected

The banner is a LEAF component: consumes `useTheoTheme()` + `useStdout()`
only; never mounts `<Static>` (D4); no env reads (theme provider owns
NO_COLOR); no new module-level state. No layering change; composition root
gains one export.

## Prior Art

- Blueprint: `.claude/knowledge-base/discoveries/blueprints/m9-welcome-banner-blueprint.md` — D1–D5 FINAL, cross-cutting comparison, deps verdict, test strategy (Corner 1 consumed verbatim below).
- Grill: `.claude/knowledge-base/grills/welcome-banner-feature-grill.md` — API locked, risks R1 (slots scope-creep) / R2 (narrow terminals).
- House precedents: `src/context-window-bar.*` (static component + suite), `tests/example-stream.integration.test.ts` (smoke shape), M6 degrade matrix.

## ADRs

### D1 — Minimal AI-native API, single children slot

**Decision:** `WelcomeBannerProps = { name: string; version?: string;
tagline?: string; hints?: readonly string[]; children?: ReactNode }` — no
layout props, no `hidden` prop (suppression = don't render; gemini's guards
live in the composing host — blueprint Corner 4 § Suppression).
**Rationale:** every peer banner reduces to name/meta/hints; children covers
composition without a layout framework (grill R1 guard).
**Alternatives considered:** slot-per-region API (rejected: layout-framework
drift — the out-of-scope item); render-props (rejected: over-engineering for
a static box); `hidden` escape hatch (rejected: no peer leaf exposes one).
**Consequences:** review guards no layout-prop creep.

### D2 — Accent-only color via M6 tokens; no gradient

**Decision:** border + name = `theme.accent`; version/hints = `dimColor`
idiom; tagline = plain text. NO gradient dependency.
**Rationale:** accent-only IS gemini's `ThemedGradient` empty-gradient branch
(blueprint Corner 4 § Color); oh-my-logo's gradient-string emits raw ANSI
that bypasses chalk level and breaks NO_COLOR (EC-7, source-proven).
**Alternatives considered:** ink-gradient (rejected: new dep + mock burden —
gemini mocks it in its own tests); gradient-string (rejected: EC-7);
a `gradient` theme token (rejected: YAGNI — zero current use).
**Consequences:** NO_COLOR correct for free via the M6 wholesale theme swap;
the pre-existing project-wide `dimColor` SGR-2 caveat applies unchanged.

### D3 — Width: clamp min(columns ?? 60, 60); floor 24; plain-text final rung

**Decision:** read `stdout.columns ?? 60` via ink `useStdout` at render (no
resize listener — ink re-renders on resize); box width
`min(columns ?? 60, 60)`; below 24 cols render ONE plain `<Text>` line
`{name} v{version}` (no border, no fixed-width box). Content truncation via
ink `wrap="truncate-end"` — ZERO manual string measurement (EC-1: ink
measures via widest-line/string-width internally). Border style as data:
`isMonochrome(theme) ? "single" : "round"` (EC-4 — ink never degrades
borderStyle; the policy is ours, driven by theme data, never env).
**Rationale:** gemini's pipe fallback 60 is production-proven (EC-2); the
final rung closes gemini's EC-5 no-guard-below-tiny hole (codex precedent).
**Alternatives considered:** fixed width (rejected: grill R2); `string-width`
direct dep (rejected: unimportable under pnpm-strict from our root + not
needed); resize listener state (rejected: ink already re-renders; a
startup-moment component needs no extra effect); height ladder (dispensed
with record — EC-10: banner ≤ 10 lines vs codex's 35-line animation gate).
**Consequences:** boundary-pair tests at 24/23; the smoke exercises the pipe
fallback by construction.

### D4 — No `<Static>`; plain component above the thread

**Decision:** `WelcomeBanner` NEVER mounts `<Static>` — plain render above
ChatThread/AgentTimeline.
**Rationale:** the repo pins ONE mounted `<Static>` consumer
(`src/agent-timeline.tsx:176-204`); gemini's alternative (header as first
Static item + `refreshStatic` clearTerminal machinery) is host-app-grade
complexity a library primitive must not own (blueprint Corner 4 § Static).
**Alternatives considered:** own `<Static>` (rejected: breaks the
single-consumer invariant); refreshStatic machinery (rejected: a library
must not own clearTerminal).
**Consequences:** documented Drawback — the banner visually sinks below
graduated history in long sessions (accepted for a WELCOME moment); flip
condition: a ChatThread `header` slot folded into ITS Static (gemini shape).

### D5 — Fail-fast typed props validation

**Decision:** boundary validation at the component: empty/whitespace `name`,
`\n` in `name`/`version`/hint entries → `TypeError` naming the prop and the
offending value; `tagline` MAY contain `\n` (splits into one line each).
**Rationale:** M0–M6 house pattern (context-window-bar precedent); gemini's
`\\n`-literal normalization is remote-config transport, surprising in a
typed API (EC-9).
**Alternatives considered:** silent normalization (rejected: EC-9 rationale);
no validation (rejected: error-handling rule 8 — validate at the boundary).
**Consequences:** negative tests per prop (testing.md § 4.1).

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| `ink` (Box borderStyle via cli-boxes; useStdout) | `^5.2.0` (existing) | no | native platform feature — rung 3; styles single/round/classic verified in `node_modules/ink/build/styles.d.ts:142` |
| `react` | peer (existing) | no | — |
| ink-gradient / gradient-string / figlet / cfonts / string-width | — | NOT ADDED | blueprint Corner 2 verdict table — each evaluated and rejected with source evidence |

**NEW runtime dependencies: (none).** **NEW devDependencies: (none).**

## Critical paths

- `src/welcome-banner.tsx` prop validation + width ladder (floor branch) —
  100% line coverage required.

## Phase 1: Component

**Objective:** the `WelcomeBanner` leaf, exhaustively unit-tested.

### T1.1 — welcome-banner.tsx: component + validation + width ladder

#### Objective
The component per D1–D5 with the full unit suite.

#### Why this step (action + reasoning)

1. **What:** RED — the Corner-1 unit oracle suite (13+ tests below); GREEN —
   the component; REFACTOR — helpers under complexity 10.
2. **Why now:** the leaf everything else wires; pure fastest loop.

#### Evidence
- API/color/width/validation: blueprint ADRs D1–D5 (FINAL).
- House suite shape: `src/context-window-bar.test.tsx` (boundary pairs,
  width sweep, batched snapshots, typed negatives, token assert).

#### Files to edit
```
src/welcome-banner.test.tsx — (NEW) RED suite
src/welcome-banner.tsx      — (NEW) component
CHANGELOG.md                — Added entry
```

#### Deep Dives
- Regions inside the bordered Box (top→bottom): name line — ONE outer
  `<Text wrap="truncate-end" color={accent} bold>` with the version as a
  NESTED `<Text dimColor>` child (EC-4 absorbed: nested Texts squash into
  one line and truncate ANSI-aware; a Box row of two Texts would
  truncate/wrap each independently); optional tagline line(s)
  (plain, split on `\n`); optional hints block (one dimColor line per entry,
  `marginTop={1}` ONLY when hints non-empty — EC-8); children last (raw).
- Floor branch: `columns < 24` → `<Text>{name}{version ? ` v${version}` : ""}</Text>`
  — nothing else (no border, tagline, hints, children).
- Validation helper `assertBannerProps` (module-internal): throws TypeError
  naming prop + value; complexity ≤ 10 via per-prop helpers.
- Width: `const width = Math.min(stdout?.columns ?? 60, 60)` — `useStdout()`.
- **Test harness for columns (EC-2 absorbed):** ink-testing-library hard-codes
  `columns = 100` (prototype getter, no setter — its `Stdout` class); the
  suite defines a LOCAL `renderAtColumns(cols, node)` helper calling INK's
  own `render` with a parameterized fake stdout (`{ get columns() { return
  cols; }, write, … }` mirroring the ink-testing-library shape) capturing
  frames for `lastFrame()`. The plain `renderBanner` (via house
  `renderFrame`) sees columns=100 → clamp 60, coherent with the design.
- Border: `borderStyle={isMonochrome(theme) ? "single" : "round"}`,
  `borderColor={theme.accent}` (empty string under no-color = unstyled),
  `paddingX={1}`.

#### Tasks
1. RED (suite below)
2. GREEN component
3. CHANGELOG

#### TDD
```
RED:     banner_renders_name_version_tagline_hints() — const frame = renderBanner({ name: "Theo", version: "1.0.0", tagline: "AI in your terminal", hints: ["/help for commands", "esc to cancel"] }); expect(frame).toContain("Theo"); expect(frame).toContain("v1.0.0"); expect(frame).toContain("AI in your terminal"); expect(frame).toContain("/help for commands")
RED:     version_absent_renders_no_vundefined_and_no_empty_meta_line() — const frame = renderBanner({ name: "Theo" }); expect(frame).not.toContain("vundefined"); const lines = nonEmptyLines(frame); expect(lines).toHaveLength(3) (top border, name row, bottom border — EC-11)
RED:     hints_empty_array_renders_zero_lines_and_zero_margin_gap() — const withEmpty = nonEmptyLines(renderBanner({ name: "T", hints: [] })); const withUndef = nonEmptyLines(renderBanner({ name: "T" })); expect(withEmpty).toEqual(withUndef); const rawEmpty = renderBanner({ name: "T", hints: [] }); const rawUndef = renderBanner({ name: "T" }); expect(rawEmpty).toBe(rawUndef) (EC-8 — no margin gap either)
RED:     tagline_splits_on_newline_one_text_per_line() — const frame = renderBanner({ name: "T", tagline: "line one\nline two" }); expect(frame).toContain("line one"); expect(frame).toContain("line two"); const lines = nonEmptyLines(frame); expect(lines).toHaveLength(5)
RED:     children_render_inside_the_box() — render with <Text>extra row</Text> child; expect(frame).toContain("extra row"); child row appears BEFORE the bottom border line
RED:     width_floor_boundary_pair_border_at_24_plain_at_23() — under the DEFAULT theme (provider-less fallback — EC-6): const at = renderAtColumns(24, { name: "Theo", version: "1.0.0" }); expect(at).toContain("╭"); const below = renderAtColumns(23, { name: "Theo", version: "1.0.0" }); expect(below).not.toContain("╭"); expect(below).not.toContain("│"); expect(below).toContain("Theo v1.0.0") (D3 boundary pair — codex idiom)
RED:     width_matrix_lines_fit() — for cols of [60, 40, 24]: every line of renderAtColumns(cols, longProps) has visualWidth <= cols (stripAnsi + length — ASCII fixture strings)
RED:     width_clamps_at_60_on_wide_terminals() — const frame = renderAtColumns(120, { name: "T" }); const top = firstLine(frame); expect(stripAnsi(top).length).toBe(60)
RED:     long_name_truncates_never_wraps() — renderAtColumns(30, { name: "A".repeat(80) }); const lines = nonEmptyLines(frame); expect(lines).toHaveLength(3) (truncate-end — no extra wrapped rows); ALSO with version: renderAtColumns(30, { name: "A".repeat(80), version: "1.0.0" }) still 3 lines (the composed nested-Text line truncates as ONE unit — EC-4)
RED:     monochrome_theme_switches_border_to_single() — render under themes["no-color"] provider; expect(frame).toContain("┌"); expect(frame).not.toContain("╭"); render under default theme; expect(frame2).toContain("╭") (D3/EC-4 — data-driven, never env)
RED:     accent_token_paints_name_and_border() — render under TheoTUIProvider theme={{...defaultTheme, accent: "magenta"}}; expect(frame).toContain("[35m") (house token assert)
RED:     no_color_frame_contains_zero_ansi_color_bytes() — render under themes["no-color"]; expect(stripAnsi(frame)).toBe(frameWithoutDim(frame)) — assert no [3Xm color codes present (dim SGR-2 tolerated per the documented caveat)
RED:     invalid_props_throw_typed_errors() — for bad of [{name: ""}, {name: "  "}, {name: "a\nb"}, {name: "T", version: "1\n2"}, {name: "T", hints: ["ok", "bad\nhint"]}]: expect(() => renderBanner(bad)).toThrow(TypeError); const err = catchError(() => renderBanner({ name: "a\nb" })); expect(err.message).toContain("name") (D5 — message names the prop)
RED:     snapshots_default_and_floor() — two named snapshots in ONE test: default banner at 60 cols (anchors asserted FIRST), floor rung at 23 cols (house batched-snapshot shape)
GREEN:   Implement src/welcome-banner.tsx until all pass
REFACTOR: validation + region helpers extracted; complexity <= 10
VERIFY:  pnpm vitest run src/welcome-banner.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/welcome-banner.test.tsx` exits 0 (14+ tests)
- [ ] `wc -l src/welcome-banner.tsx` ≤ 250
- [ ] `pnpm lint` + `pnpm typecheck` exit 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Phase 2: Wiring + evidence

**Objective:** composition-root export, degrade coverage, example + smoke.

### T2.1 — Entry export + contract suites + degrade matrix

#### Objective
Wiring pillar (b): the banner reachable ONLY via the composition root,
degrade-proven.

#### Why this step (action + reasoning)

1. **What:** RED — export-surface pin + composed public-api scene + snapshot
   + degrade-matrix fixture extension; GREEN — the `src/index.ts` export.
2. **Why now:** T1.1 delivered the leaf; this closes the public surface.

#### Evidence
- Blueprint Corner 1 rows 2-3 (snapshot budget 2; degrade delta ~5 lines,
  zero new spawns).

#### Files to edit
```
src/index.ts                              — export WelcomeBanner + type
tests/export-surface.test.ts              — presence pin
tests/public-api.integration.test.tsx     — M9 scene + 1 anchored snapshot
tests/fixtures/no-color-probe.tsx         — + <WelcomeBanner>
tests/degrade-matrix.integration.test.tsx — banner asserts in assertDegradedScene
CHANGELOG.md                              — entry (grouped with T1.1)
```

#### TDD
```
RED:     public_entry_exposes_welcome_banner() — const mod = await import("../src/index.js"); expect(typeof mod.WelcomeBanner).toBe("function")
RED:     composed_banner_scene_matches_snapshot() — banner (name/version/tagline/2 hints) above a 2-message ChatThread in <Box width={60}> via entry imports; anchors FIRST (name, "v0.9", hint text, "✦"); then toMatchSnapshot("welcome-banner-scene")
RED:     degrade_matrix_covers_banner() — extend fixture with <WelcomeBanner name="Probe" version="0.0.0" hints={["hint row"]}/>; assertDegradedScene gains ONLY theme-agnostic asserts: expect(plain).toContain("Probe"); expect(plain).toContain("hint row"). Border glyph asserted PER SCENE (EC-3 absorbed — the policy is theme-DATA-driven, D3): NO_COLOR scene → "┌" (no-color theme, isMonochrome true); TERM=dumb + bare-pipe scenes → "╭" (dark theme at chalk level 0 — isMonochrome(dark) false). The M6 byte-equality test (term_dumb === no_color modulo marker) gains corner normalization: map ╭→┌ ╮→┐ ╰→└ ╯→┘ alongside the existing ▏→space (─/│ shared between round and single)
VERIFY:  pnpm vitest run tests/export-surface.test.ts tests/public-api.integration.test.tsx tests/degrade-matrix.integration.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suites exit 0; snapshot budget: ≤ 2 new snapshots TOTAL for M9 — `git diff --stat <m9-base>..HEAD -- '**/__snapshots__/**'` shows insertions only
- [ ] Zero new subprocess spawns — `grep -rc "execFileSync(" tests/ src/ | awk -F: '{n+=$2} END {print n}'` ≤ 10 before T2.2

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.2 — examples/banner.tsx + smoke + script

#### Objective
Wiring pillars (a)+(c): human-runnable caller + runtime evidence.

#### Why this step (action + reasoning)

1. **What:** RED — the subprocess smoke; GREEN — the example + script.
2. **Why now:** last wiring pillar; the smoke IS the EC-2 non-TTY oracle.

#### Evidence
- Smoke shape: `tests/example-stream.integration.test.ts:1-25` (dual 30s
  timeouts, minimal env, FORCE_COLOR=1).
- Blueprint Corner 3 smoke design.

#### Files to edit
```
examples/banner.tsx                       — (NEW) deterministic demo
tests/example-banner.integration.test.ts  — (NEW) subprocess smoke
package.json                              — "example:banner" script
CHANGELOG.md                              — entry (grouped)
```

#### Deep Dives
- Example: static render; exit via the house shape
  `setTimeout(() => instance.unmount(), 50)` (EC-5 absorbed: every
  smoke-tested example uses explicit unmount/exit — basic.tsx, the only one
  without, is also the only one without a smoke); banner with
  name "Theo TUI", version from `VERSION`, tagline, 3 hints, one child line;
  piped output = final scene (EC-2 fallback path).
- TTFATT note: the smoke records the banner as the first-mount primitive.

#### TDD
```
RED:     banner_example_renders_and_exits_cleanly_when_piped() — execFileSync tsx examples/banner.tsx (timeout 30000 both layers, env PATH/HOME/FORCE_COLOR=1); expect(out).toContain("Theo TUI"); expect(out).toContain("v0."); expect(out).not.toContain("vundefined"); expect(out).toContain("/help"); expect(out).toContain("╭") (pipe fallback width 60 > floor → border present)
VERIFY:  pnpm vitest run tests/example-banner.integration.test.ts && pnpm example:banner | cat
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Smoke exits 0; `pnpm example:banner | cat` exits 0 with the banner scene
- [ ] Subprocess spawn count suite-wide ≤ 11 — `grep -rc "execFileSync(" tests/ src/ | awk -F: '{n+=$2} END {print n}'` outputs ≤ 11

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Edge cases absorbed (from /edge-case-plan 2026-07-07)

- **EC-1 (MUST-FIX):** no-color oracle rewritten — color-class SGR regex; SGR
  1/2/22 tolerated in-process (chalk.bold at FORCE_COLOR=1); true zero-ANSI
  proven by the subprocess matrix at level 0.
- **EC-2 (MUST-FIX):** `renderAtColumns` harness SPECIFIED (ink render +
  parameterized fake stdout) — ink-testing-library hard-codes columns=100.
- **EC-3 (MUST-FIX):** border glyph asserts made theme-data-honest per scene
  (┌ only under NO_COLOR; ╭ under dumb/pipe which resolve dark at level 0);
  M6 byte-equality gains 4-corner normalization — pre-M9 suite preserved.
- **EC-4 (SHOULD):** name+version = ONE outer truncating Text with nested
  dim Text; long-name+version truncation case added.
- **EC-5 (SHOULD):** example uses the house unmount shape.
- **EC-6 (SHOULD):** floor boundary rows pin the default theme explicitly.

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M9 DoD-1: WelcomeBanner exported with name/version/tagline?/hints?/children (ROADMAP § M9) | T1.1, T2.1 | Component + entry export + presence pin |
| 2 | M9 DoD-2: theme tokens + NO_COLOR/term-dumb degrade in degrade-matrix (ROADMAP § M9) | T1.1, T2.1 | accent/dimColor tokens; monochrome border branch proven in the NO_COLOR scene (data-driven — dumb/pipe scenes resolve the dark theme at level 0, EC-3); fixture extension, zero new spawns; byte-equality corner-normalized |
| 3 | M9 DoD-3: unit + integration via composition root + 1 anchored snapshot (ROADMAP § M9) | T1.1, T2.1 | 14+ unit tests; composed scene; 2-snapshot budget |
| 4 | M9 DoD-4: examples/ + subprocess smoke (ROADMAP § M9) | T2.2 | examples/banner.tsx + smoke + script |
| 5 | M9 DoD-5: gates green, 100% lines on module, CHANGELOG (ROADMAP § M9) | T1.1, T2.1, T2.2 | per-task gates-gated commits; Critical paths § |
| 6 | Grill R1 — slots scope-creep guard | T1.1 | D1: single children, no layout props; review guard |
| 7 | Grill R2 — narrow terminals | T1.1 | D3 floor + boundary pair + width matrix |
| 8 | EC-1/EC-2/EC-4/EC-5/EC-10 (width family, edge review) | T1.1, T2.2 | no manual measurement; pipe fallback smoke; data-driven border; final rung; height dispensa |
| 9 | EC-8/EC-9/EC-11 (props semantics) | T1.1 | empty-hints/no-margin oracle; \n policy typed errors; version-absent oracle |
| 10 | EC-3/EC-6 (Static contract; suppression) | T1.1 (docs), T2.1 (scene proves plain-render above thread) | D4 no-Static + Drawback; D1 no hidden prop |
| 11 | Rule 6 CHANGELOG | T1.1, T2.1, T2.2 | [Unreleased] per task |
| 12 | Rule 9 deps (deps-audit) | T1.1 | ZERO new deps (blueprint Corner 2); T1.1's diff proves the manifest untouched; audit PASS 2026-07-07 |

**Coverage: 12/12 gaps covered (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Banner sinks below graduated history in long sessions (D4 — thread's `<Static>` rows print above the dynamic region) | Low | Accepted-by-design for a WELCOME moment; flip condition recorded (ChatThread header slot, gemini shape) | implement |
| `dimColor` SGR-2 may still be emitted under NO_COLOR (ink→chalk independent of the theme swap) | Low | Pre-existing project-wide M0–M6 behavior; documented caveat, honest no-color test oracle tolerates dim | implement |
| Border glyphs on exotic terminals (ink emits cli-boxes unconditionally — EC-4) | Low | Data-driven `single` fallback for monochrome; TERM=dumb glyph fidelity out of scope (ink's own posture), recorded | implement |
| Emoji/CJK name truncation exactness relies on ink's internal string-width (EC-1) | Low | Width-matrix tests use ASCII fixtures; wide-script measurement is third-party behavior (not re-tested), documented | implement |

## Failure scenarios (when I/O external)

(none — no external I/O touched; the banner is a pure render component)

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D5.)

## Test Plan

Unit (14+ co-located) + contract pins (export-surface) + composed scene +
snapshot (public-api) + degrade-matrix extension (3 scenes inherit) +
subprocess smoke (non-TTY). Suite-wide: two consecutive green runs,
snapshot budget ≤ 2, spawn budget ≤ 11.

## Final Phase: Integration Validation (MANDATORY)

- Coverage: `pnpm test:coverage` — `src/welcome-banner.tsx` 100% lines.
- Two consecutive `pnpm test` runs green, byte-identical snapshots.
- `pnpm build` green; dts exports `WelcomeBanner`.
- **Bench:** NO re-run — M9 is purely ADDITIVE (zero existing render-path
  files modified; T2.1 touches only tests/fixtures). Justification + flip
  condition per blueprint Corner 3; recorded in the implementation log. If
  review finds any src/ file OTHER than welcome-banner.tsx + index.ts
  modified, this decision flips to a full load-gated re-run.
- `run_validation.py m9-welcome-banner` exit 0; `/code-quality` PASS.

## Global Definition of Done

- [ ] All phases completed; all tasks committed gates-gated
- [ ] `pnpm test` green (430 + ~18 new); typecheck/lint/format clean
- [ ] Coverage: `src/welcome-banner.tsx` 100% lines (`pnpm test:coverage`)
- [ ] `pnpm build` green; `grep -c "WelcomeBanner" dist/index.d.ts` ≥ 1
- [ ] Snapshot budget ≤ 2 new, zero existing changed — `git diff --stat <m9-base>..HEAD -- '**/__snapshots__/**'` insertions only
- [ ] Backward compat: pre-M9 suites pass unmodified; `git diff --name-only <m9-base>..HEAD -- 'src/*.test.*'` lists only NEW files
- [ ] CHANGELOG `[Unreleased]` updated per task
- [ ] File budget: `wc -l src/welcome-banner.tsx` ≤ 250
- [ ] Plan archived to `completed/` after review READY_TO_MERGE + release merge
