# Discovery Plan: M6 Theme + robustness foundation

**Slug:** `m6-theme-robustness`
**Owner:** paulohenriquevn + Claude (assisted)
**Created:** 2026-07-07
**Time budget:** 5h (per-project breakdown in ADR D1)

## Context

`ROADMAP.md § M6` — Theme + robustness foundation: theme system (tokens +
terminal-adaptive palette), `<TheoTUIProvider>` finalized with a
`<ThemeProvider>`-equivalent + ≥ 2 built-in themes; every primitive respects
`NO_COLOR`/`FORCE_COLOR`/`TERM=dumb` and renders (degraded) in non-TTY/pipe; snapshot
matrix per primitive × {truecolor, 16-color/NO_COLOR, non-TTY}. Depends on M1-M5 (all
RELEASED or READY_TO_MERGE). Risks: (1) combinatorial snapshot surface;
(2) terminal capability detection edge cases.

M6 is the CONVERGENCE milestone: M0-M5 deliberately parked color/glyph decisions as
module-local constants with "M6 theming candidate" flags. The internal debt register:
`ACCENT_COLOR` duplicated in `context-window-bar.tsx:12`/`token-usage-chart.tsx:6`;
`HLJS_COLOR_MAP` (~10 buckets) in `code-block.tsx:31`; `STATUS_VISUALS` in
`tool-call.tsx:28`; theme deepmerge + nested-provider composition deferred in
`theme.tsx:30,76`; M4 review notes (bg tints, hljs light-terminal legibility, `→`/`…`
EAW widths); M5 review notes (binary→tiered degrade, wrap hardening when container <
width, `█`/`░` EAW-Ambiguous exposure, truncation-indicator wording unification
M2/M4); `chat-composer.tsx:148` visible fallback.

## Objective

Answer the 6 research questions below with cited evidence from the local reference
clones + the internal debt register so `/to-plan` can write the M6 implementation plan
with zero unresolved design questions.

## In-Scope / Out-of-Scope

### In-Scope (per reference project)

- `gemini-cli` — THE Ink production theme system: `packages/cli/src/ui/themes/`
  (theme.ts semantic tokens + builder, theme-manager.ts, builtin themes incl.
  no-color.ts), `packages/cli/src/ui/utils/` terminal capability handling.
- `ink-ui` — component-level theme system (`source/theme.ts`, per-component
  `theme.ts` files, ThemeProvider/extendTheme) — the LIBRARY-shaped analog.
- `ink` itself (node_modules or clone) — what the renderer already gives us:
  chalk color-level detection, FORCE_COLOR/NO_COLOR handling, non-TTY behavior.
- `codex` — terminal capability detection + ANSI-16 degrade strategy (patterns only).
- `bubbles`/lipgloss — adaptive color profiles (truecolor→256→16 degradation ladder)
  as the non-JS SOTA reference.

### Out-of-Scope (explicit)

- New components (M6 ships tokens + robustness, not surfaces).
- User-facing theme FILE loading/config (consumers pass objects; persistence is an
  app concern).
- Windows terminal quirks beyond what chalk/ink already abstract.
- Interactive theme switching UI (gemini has a dialog — app concern, not library).

## ADRs

### D1 — Time budget + stop conditions

**Decision:** `gemini-cli` themes: 2h; `ink-ui`: 1h; `ink`/chalk internals: 0.5h;
`codex`: 0.5h; lipgloss: 0.5h; internal debt audit: 0.5h. Total 5h.

**Rationale:** gemini ships the only Ink production multi-theme system with a
no-color theme (the M4 discovery already proved its NO_COLOR-as-theme pattern);
ink-ui is the only npm LIBRARY analog with a public ThemeProvider contract — the
API-shape source; ink/chalk internals bound what detection we must NOT reimplement
(Rule 9); lipgloss's adaptive profiles are the degradation-ladder SOTA.

**Stop condition — per question (mandatory):** Fase A empty on named hotspots → ONE
alternative Grep spelling; still empty → `blocked` with attempts recorded. Never
fabricate.

**Stop condition — per project (mandatory):** Budget exhausted → remaining questions
`blocked (budget)`.

**Anti-pattern:** NEVER fabricate Fase B answers (Unbreakable Rule 3).

**Consequences:** Blocked questions seed the next discovery.

### D2 — Token taxonomy must absorb the ENTIRE M0-M5 debt register (hypothesis to verify)

**Decision:** Q3 verifies whether one token taxonomy (semantic slots à la gemini vs
component-scoped themes à la ink-ui) can host ALL parked constants (accent, hljs
buckets, status visuals, role tokens, dim/truncation styling) without breaking the
existing `TheoThemeOverride` public API (M0 contract — backward compat is a DoD).
The blueprint picks one architecture with evidence and a migration table
constant-by-constant.

**Rationale:** M6's value IS the convergence; a taxonomy that hosts 80% of the debt
leaves the other 20% as permanent stragglers.

**Alternatives considered:** deciding by API taste (rejected: gemini + ink-ui both
ship working taxonomies — read them).

**Consequences:** The M6 plan's task decomposition hangs off this verdict.

### D3 — Snapshot-matrix budget is a DESIGN decision (roadmap risk 1)

**Decision:** Q4 must deliver how analogs bound the combinatorial surface (primitives
× color levels): what they snapshot vs assert mechanically, how many snapshots per
primitive, subprocess vs in-process level pinning. The blueprint locks a matrix
budget (target: O(primitives + levels), NOT O(primitives × levels) full snapshots)
with the mechanical-invariant alternative for the off-diagonal.

**Rationale:** each primitive × 3 levels × states would explode into hundreds of
snapshots — drift maintenance kills the suite; the roadmap names this risk.

**Alternatives considered:** full cartesian snapshots (rejected: the drift-budget
lesson from M4's ≤2 highlighted snapshots).

**Consequences:** The M6 plan's test tasks get exact snapshot counts.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | Theme-system anatomy: how do analogs DECLARE themes (token schema), SELECT them (provider/manager), MERGE overrides, and ship built-ins? What is the public API shape (ThemeProvider/extendTheme/useTheme)? | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/no-color.ts`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/semantic-tokens.ts`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/dark/ansi-dark.ts`, `.claude/knowledge-base/references/ink-ui/source/theme.tsx`, `.claude/knowledge-base/references/ink-ui/source/components/spinner/theme.ts` | Grep `Theme\|extendTheme\|ThemeProvider\|useComponentTheme\|semantic` across gemini themes/ + ink-ui source/ | Read gemini theme.ts + manager end-to-end; read ink-ui theme.ts + 2 per-component theme.ts fully | Token-schema comparison (semantic slots vs component-scoped) + provider/merge API table + built-in theme inventory + D2 verdict inputs — citations |
| Q2 | Terminal capability detection + adaptive degrade: who detects color level (chalk? supports-color? hand-rolled), how do NO_COLOR/FORCE_COLOR/TERM=dumb interact, what happens at 16-color (truecolor values → ANSI mapping), and in non-TTY/pipe? What does ink ALREADY do for us (Rule 9 boundary)? | techniques | `node_modules/ink/` (chalk/supports-color chain — installed tree), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts` (no-color swap trigger), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/color-utils.ts`, `.claude/knowledge-base/references/codex/codex-rs/tui/src/` (color detection), `.claude/knowledge-base/references/bubbles/` + lipgloss profiles (via go.mod docs if vendored) | Grep `supportsColor\|colorLevel\|NO_COLOR\|FORCE_COLOR\|TERM\|dumb\|isatty\|ColorProfile` | Trace the chalk level chain in the installed ink; read the gemini no-color trigger; codex/lipgloss degrade ladders | Capability matrix (env × level × behavior) + "what ink gives us free" boundary + adaptive-palette mechanism (paired light/dark? ansi named colors?) — citations |
| Q3 | Internal debt migration: for EVERY parked constant (ACCENT_COLOR ×2, HLJS_COLOR_MAP, STATUS_VISUALS, role tokens, dim usage, truncation indicators M2/M4, composer fallback), which token slot does it map to in the Q1 taxonomy, and does the M0 `TheoThemeOverride` API survive (backward compat)? | techniques | OUR tree: `src/theme.tsx`, `src/tool-call.tsx:28-60`, `src/code-block.tsx:31-52`, `src/context-window-bar.tsx:9-15`, `src/token-usage-chart.tsx:6-8`, plus `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts` (semantic bucket list — M4 blueprint anchor) | Grep `M6\|ACCENT_COLOR\|HLJS_COLOR_MAP\|STATUS_VISUALS\|dimColor` in src/ | Read each flagged site + the current TheoTheme interface; map one-by-one | Migration table (constant → token slot → breaking? → task seed) + backward-compat verdict on TheoThemeOverride — citations |
| Q4 | Snapshot-matrix strategy: how do analogs test across color levels without cartesian explosion — what is snapshotted vs mechanically asserted, how is the color level PINNED per test (env? theme swap? subprocess), and what does a no-color theme test look like? | tests | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.test.ts` (if exists — else theme.test.ts spelling), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/StatsDisplay.test.tsx` (color snapshots), `.claude/knowledge-base/references/ink-ui/test/` (component theme tests), OUR `tests/fixtures/no-color-probe.tsx` + `vitest.config.ts` (FORCE_COLOR pin) | `wc -l` first (EC sampling); Grep `toMatchSnapshot\|NO_COLOR\|FORCE_COLOR\|colorize\|theme` in the named test dirs | Read harness + representative cases | Matrix-budget proposal (per-primitive counts, subprocess reuse, mechanical invariants for off-diagonal) satisfying D3 — citations |
| Q5 | Dependencies: does ANY analog pull a theming/color lib beyond what ink already ships (chalk, ansi-styles)? Is a color-conversion helper (truecolor→256→16) needed or does chalk downsample automatically? | deps | `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json`, `.claude/knowledge-base/references/ink-ui/package.json`, installed `node_modules/ink/package.json` + its chalk version | Grep `chalk\|ansi\|color` in the manifests | Trace any hit to usage; verify chalk's own downsampling behavior (its README/source in node_modules) | Rule 9 verdict: expected ZERO new deps (chalk downsamples; ink re-exports nothing → we consume Text color strings only) — citations |
| Q6 | Robustness evidence: is a bench meaningful for M6 (theme-switch cost? level-detection overhead?) or is the honest evidence artifact the EXPANDED probe matrix (NO_COLOR + TERM=dumb + non-TTY subprocess scenes)? Cycle owner requires data — decide with rationale. | tools | OUR `benchmarks/sampling.ts` + `tests/fixtures/no-color-probe.tsx` lineage; `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts` (is theme switch hot-path?) | Map whether any M6 code runs per-frame (tokens are read at render — does indirection add per-frame cost measurable by the M5 footer bench shape?) | Decide: light bench (M5 metrics-footer bench re-run with themed vs default provider — measures token-indirection cost) OR recorded justification + probe-matrix as the evidence artifact (default to the light bench if any per-frame indirection lands) | M6 evidence proposal (bench workload OR probe matrix + rationale) — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q4 | Covered |
| Dependencies | Q5 | Covered |
| Tools | Q6 | Covered |
| Techniques | Q1, Q2, Q3 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Edge cases absorbed (from /discover-edge-cases 2026-07-07)

- **EC-1 (MUST-FIX, absorbed into Q1):** merge semantics under PARTIAL overrides of a
  non-default built-in theme — M0's merge is `defaultTheme + override`; with ≥ 2
  built-ins the base becomes a parameter (`builtin + override`). Evidence must state
  how analogs compose (extendTheme base, nested providers) and whether our documented
  "nested provider RESETS" semantics survives.
- **EC-2 (MUST-FIX, absorbed into Q2):** conflicting env combinations — NO_COLOR=1 AND
  FORCE_COLOR=1 simultaneously (our own vitest pin relies on FORCE_COLOR winning);
  TERM=dumb WITH FORCE_COLOR; the answer must pin the exact precedence chain chalk
  implements (with source citation) so our tests assert reality, not assumption.
- **EC-3 (MUST-FIX, absorbed into Q3):** tokens consumed OUTSIDE `<Text color>` —
  `dimColor` (boolean, not a color string) and bold/italic attributes: does the
  taxonomy carry ATTRIBUTES or only colors? gemini's no-color theme zeroes colors but
  what happens to bold/dim in their degrade?
- **EC-4 (SHOULD, absorbed into Q4):** snapshot determinism across chalk versions —
  truecolor themes emit `38;2;r;g;b` sequences; a chalk/ink bump can reorder or
  re-encode; how do analogs pin (exact dep versions? ANSI-16-only built-ins?).
- **EC-5 (SHOULD, absorbed into Q2):** 16-color terminals with truecolor theme values
  — chalk downsamples hex → nearest ANSI-16: VERIFY (run node with FORCE_COLOR=1 vs 3)
  that the downsample is deterministic and document the mechanism our adaptive
  palette relies on.
- **EC-6 (SHOULD, absorbed into Q1):** theme identity stability — gemini memoizes the
  provider value (our F-dom-1 lesson); with theme objects now BUILT (base + override),
  referential stability across rerenders must be part of the API design evidence.

## Halt-loop Checkpoints

- After each question: citations verified on disk before recording.
- After Q1/Q3: D2 taxonomy verdict drafted with the migration table.
- Before blueprint synthesis: every question `done` or `blocked`; EC sampling recorded
  for any file > 800 lines.

## Acceptance Criteria

- [ ] All 6 questions answered with `path:line` citations that resolve on disk (or honestly `blocked`)
- [ ] Blueprint drafted at `.claude/knowledge-base/discoveries/blueprints/m6-theme-robustness-blueprint.md` with 4/4 corners populated and ≥ 1 ADR incl. the D2 taxonomy verdict + D3 snapshot-matrix budget + the full debt-migration table
- [ ] `python3 .claude/skills/discover-confidence/scripts/run_blueprint_score.py` on the blueprint returns verdict ≥ SHIPPABLE_WITH_CAVEATS
- [ ] Zero fabricated citations — path-existence sweep passes

## Global Definition of Done

- [ ] Blueprint SHIPPABLE(_WITH_CAVEATS) committed on `develop`
- [ ] `/to-plan` can start with zero unresolved design questions (token taxonomy + capability matrix + migration table + snapshot budget + deps verdict + evidence artifact all locked)
