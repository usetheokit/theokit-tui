---
slug: m9-welcome-banner
milestone_id: M9
created_at: 2026-07-07
question: How do production agent CLIs build their welcome banner (layout, width-responsiveness, color/gradient, hints, degradation), and what is the minimal AI-native WelcomeBanner API for @theokit/tui?
---

# Discovery Plan: m9-welcome-banner

## Context

M9 (added 2026-07-07 via `/roadmap-feature`) ships a `WelcomeBanner` primitive —
the Claude Code/gemini-cli-style startup banner. The grill locked: props
`name`/`version`/`tagline?`/`hints?` + a single `children` slot; theme-token
consumption (M6 accent + NO_COLOR degradation); risks = slots scope-creep and
narrow terminals. Freshly-cloned peers (opencode, oh-my-logo, ascii-motion) plus
gemini-cli/codex/ink-ui cover the pattern in production. M0–M7 primitives +
gates conventions (co-located tests, degrade-matrix, anchored snapshots,
composition-root integration, subprocess smokes) are established baseline.

## Objective

Produce a blueprint locking: the banner layout anatomy, the width-responsiveness
strategy, the color/degradation mapping onto M6 theme tokens, the hints-row
pattern, the test strategy, and the evidence artifact decision — every claim
cited from the references.

## In-Scope / Out-of-Scope

**In:** banner/logo/header/tips components of the peers; width handling; color
gradients vs theme tokens; static-component test idioms; deps verdict.
**Out:** animated ASCII banners as a SHIPPED feature (ascii-motion is studied
as design reference only — animation is YAGNI for v0); ASCII-art font
rendering engines (oh-my-logo's figlet path is prior art, not a dependency);
onboarding FLOWS (codex onboarding_screen is multi-step — we ship ONE
component, not a wizard).

## ADRs

### D1 — Minimal AI-native API, single children slot (preliminary)

**Decision:** `WelcomeBannerProps = { name: string; version?: string;
tagline?: string; hints?: readonly string[]; children?: ReactNode }` — no
grid/columns/layout system (the out-of-scope guard from the grill).
**Rationale:** every peer banner reduces to logo/name + metadata lines + tips;
a single children slot covers composition without becoming a layout framework.
**Alternatives:** slot-per-region API (rejected: layout-framework drift);
render-props (rejected: over-engineering for a static box).
**Consequences:** consumers compose extra content as children; the review
guard checks no layout props creep in.

### D2 — Theme tokens only; no gradient dependency (preliminary)

**Decision:** color via M6 `theme.accent` (+ existing role/dim tokens); NO
gradient library — verify what oh-my-logo/gemini use and record the delta.
**Rationale:** M6 already solved NO_COLOR/term-dumb degradation at the theme
layer; a gradient dep would bypass it (Rule 9 + parsimony rung 4).
**Alternatives:** ink-gradient (to verify: chalk-level coupling, NO_COLOR
behavior); manual per-char color ramp (to research in oh-my-logo).
**Consequences:** Q3 must verify the visual cost of accent-only vs gradient.

### D3 — Width-responsive: measure, clamp, degrade (preliminary)

**Decision shape (to be evidenced):** banner width = min(terminal columns,
configured max); below a minimum, drop the border/logo before dropping text.
**Rationale:** grill risk R2 — bordered boxes break under ~40 cols.
**Alternatives:** fixed width (rejected: the risk itself); no border ever
(rejected: loses the recognizable banner identity).
**Consequences:** Q2 must extract the peers' exact width strategies.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | Banner anatomy in production Ink agent CLIs: gemini-cli's Banner/Header/AsciiArt/Tips composition (regions, version/model/cwd layout, hint numbering — tips are frequency-capped NOT rotated, EC-8) and opencode's logo.ts/logo.tsx; the render-once vs resize contract (gemini's header lives in `<Static>` + manual refreshStatic; OUR single-`<Static>`-consumer restriction — where does the banner live when mounted above ChatThread? EC-3 → likely a new ADR); the suppression pattern (`hideBanner`/screenReader guards — consumer's responsibility or API escape hatch? EC-6); multi-line policy for string props (`\n` embedded: normalize/forbid — gemini normalizes, EC-9) | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Banner.tsx`, `Header.tsx`, `AppHeader.tsx`, `AsciiArt.ts`, `Tips.tsx`, `constants/tips.ts`; `.claude/knowledge-base/references/opencode/packages/tui/src/logo.ts`, `component/logo.tsx` | Grep `width\|columns\|Box\|border` across the components | Read Banner/Header/Tips + opencode logo end-to-end; build the region table (logo, meta lines, hints) | Anatomy table region-by-region with props each peer exposes — citations |
| Q2 | Width-responsiveness + narrow terminals: how gemini-cli/opencode measure terminal width (useTerminalSize; `process.stdout.columns \|\| 60` under pipe — EC-2), their breakpoints and the degrade ladder floor (what happens BELOW the minimum: wrap vs truncate vs accepted overflow — EC-5); WIDTH MEASUREMENT for arbitrary consumer strings (grapheme/emoji: `string-width` vs our `Intl.Segmenter` precedent — the peers' `line.length` is ASCII-only, EC-1); CONFIRM ink does NOT degrade `borderStyle` under TERM=dumb (cli-boxes emitted unconditionally — the degrade policy is OURS to decide, EC-4); height budget (rows) explicitly considered-and-dispensed or laddered (codex gates by MIN_ANIMATION_HEIGHT — EC-10) | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/` (grep terminal-size hooks), `.claude/knowledge-base/references/opencode/packages/tui/src/` (grep width/cols), OUR `src/agent-timeline.tsx`/`tests/degrade-matrix.integration.test.tsx` (existing width/degrade idioms) | Grep `useStdout\|columns\|process.stdout\|terminalWidth\|useTerminalSize\|shortAscii` | Read the measuring hook + every width branch | Width-strategy table: measure mechanism, breakpoints, degrade ladder — citations |
| Q3 | Color: gradient vs tokens — oh-my-logo's gradient-string path emits RAW ANSI escapes (bypasses chalk level ⇒ NO_COLOR broken — the D2 risk confirmed, EC-7); gemini's `ThemedGradient` degrade (≥2 colors → ink-gradient, 1 → Text color, empty → accent) as the THEME-LEVEL pattern to port onto M6 tokens (accent-only ≡ empty gradient); NO_COLOR + isMonochrome behavior | techniques | `.claude/knowledge-base/references/oh-my-logo/src/palettes.ts`, `InkRenderer.tsx`, `renderer.ts`; `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Banner.tsx` (+ theme files it imports); OUR `src/theme.tsx` (M6 tokens) | Grep `gradient\|chalk\|color\|palette` | Read the gradient path + gemini color wiring; map onto TheoTheme tokens | Color-mapping decision: token set used, gradient verdict (use/skip + why), NO_COLOR behavior — citations |
| Q4 | Test idioms for a static banner: codex onboarding/welcome.rs snapshot style, gemini's Banner.test (multi-line pins), and OUR house idioms; MANDATORY oracles from the edge review: `hints={[]}` renders zero lines AND zero margin gap (≠ undefined, EC-8), `version` undefined → no `vundefined`/empty line (EC-11), sub-minimum width behavior pinned (EC-5), non-TTY/pipe smoke (columns undefined, EC-2) | tests | `.claude/knowledge-base/references/codex/codex-rs/tui/src/onboarding/welcome.rs` + `snapshots/`, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/` (grep Banner/Tips tests), OUR `tests/degrade-matrix.integration.test.tsx`, `tests/public-api.integration.test.tsx`, `src/context-window-bar.test.tsx` (recent static-component suite shape) | Grep `test\|snapshot\|describe` around banner components | Read the test files; extract the oracle set (what breaks if the banner regresses) | Test-strategy: unit oracles (width clamp, hint rows, token consumption), snapshot count, degrade-matrix delta — citations |
| Q5 | Dependencies: verify ZERO new runtime deps suffices — ink's built-in `borderStyle` inventory (round/single/double + fallback), whether gemini/opencode pull a gradient/figlet dep for their banner, and the license/size cost if any candidate dep were adopted (expected verdict: none) | deps | ink source in node_modules (`Box` borderStyle impl — cli-boxes), `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json`, `.claude/knowledge-base/references/oh-my-logo/package.json`, OUR package.json | Grep `borderStyle\|cli-boxes\|ink-gradient\|figlet` | Trace what each peer's banner actually imports at runtime | Rule 9 verdict table (candidate dep → use/skip + evidence) — citations |
| Q6 | Evidence artifact: bench needed? The banner renders ONCE at startup (no per-frame path) — validate the no-new-bench justification against the M7 precedent (flip condition wording) and define the runtime evidence instead (subprocess smoke asserting the rendered banner + TTFATT contribution note) | tools | OUR `.claude/knowledge-base/implementations/m7-stream-adapter-implementation.md` (§ no-new-bench justification), `benchmarks/run.ts` inventory, `tests/example-stream.integration.test.ts` (smoke shape) | Map whether any banner code runs per-frame (expect: no) | Write the justification + flip condition; define smoke oracles | Evidence proposal (justification + smoke design) — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q4 | Covered |
| Dependencies | Q5 | Covered |
| Tools | Q6 | Covered |
| Techniques | Q1, Q2, Q3 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Edge cases absorbed (from /discover-edge-cases 2026-07-07)

- **EC-1 (MUST-FIX → Q2):** visual width of arbitrary `name`/`tagline`/`hints`
  (grapheme/emoji/CJK) — peers' `line.length` is ASCII-only by design
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/textUtils.ts:20-25` vs its `stringWidth` import at line 10); decide `string-width`
  (ink-transitive) vs our `Intl.Segmenter` precedent (src/text-buffer.ts).
- **EC-2 (MUST-FIX → Q2/Q4):** non-TTY pipe — `process.stdout.columns` is
  undefined; gemini falls back `|| 60` (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useTerminalSize.ts:11-13`); the M9
  smoke runs exactly in that environment — pin it.
- **EC-3 (MUST-FIX → Q1):** render-once vs resize contract — gemini's header
  lives in `<Static>` with manual refreshStatic (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:694`); our
  repo restricts to ONE mounted `<Static>` consumer (agent-timeline.tsx) —
  banner placement above ChatThread needs an ADR.
- **EC-4 (MUST-FIX → Q2):** ink does NOT degrade `borderStyle` on TERM=dumb —
  cli-boxes chars emitted unconditionally (`node_modules/ink/build/render-border.js:5-10`);
  the degrade policy is ours; block glyphs are per-terminal fragile (gemini's
  Apple Terminal special-case, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/AppHeader.tsx:35-45`).
- **EC-5 (MUST-FIX → Q2/Q4):** content wider than the banner: wrap vs
  truncate vs accepted overflow below the ladder floor (gemini's tiny-logo
  else-branch has no guard — `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Header.tsx:33-38`); D3 must state the floor.
- **EC-6 (MUST-FIX → Q1):** suppression pattern — gemini hides banner+tips
  under screenReader/hideBanner settings (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/AppHeader.tsx:77-79`);
  decide: consumer's responsibility (don't render) — record in D1.
- **EC-7 (SHOULD → Q3):** gradient degrade is a THEME concern — gemini's
  ThemedGradient (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ThemedGradient.tsx:13-35`) vs oh-my-logo's raw-ANSI gradient-string
  (`.claude/knowledge-base/references/oh-my-logo/src/InkRenderer.tsx:45-60`) that breaks NO_COLOR; port the pattern, not a dep.
- **EC-8 (SHOULD → Q1/Q4):** `hints: []` vs undefined — zero lines AND zero
  margin gap (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Tips.tsx:20`, conditional renumbering at 28-38).
- **EC-9 (SHOULD → Q1/Q4):** embedded `\n` in string props — gemini
  normalizes literal `\n` (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Banner.tsx:17`, pinned in `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Banner.test.tsx:13-15`); decide
  single-line contract or supported multi-line; pin either way.
- **EC-10 (SHOULD → Q2):** height budget — codex gates by
  MIN_ANIMATION_HEIGHT 37 (`.claude/knowledge-base/references/codex/codex-rs/tui/src/onboarding/welcome.rs:23-24`); explicitly ladder or dispense.
- **EC-11 (SHOULD → Q4):** `version` undefined oracle — no `vundefined`, no
  empty line (gemini renders it conditionally, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Header.tsx:52-56`).

**Out-of-scope confirmed by the edge review:** RTL/bidi (no peer handles it —
one blueprint line); animation idioms in the files Q1/Q4 read (excluded);
banner frequency-cap persistence (host-app concern); figlet/cfonts fonts
(Q5 skip-verdict evidence); codex multi-step wizard (snapshot idiom only).

## Halt-loop Checkpoints

- After Q1–Q3 (techniques block): anatomy + width + color tables exist with
  citations that resolve on disk.
- After Q4–Q6: test strategy + deps verdict + evidence proposal recorded.
- Blueprint assembled: 4 coverage corners populated, ≥ 1 ADR finalized,
  citation density ≥ 1.0.

## Acceptance Criteria

- Every question answered `done` (or `blocked` with reason) in the blueprint.
- Every citation resolves via `Path.exists()`.
- Blueprint scores ≥ SHIPPABLE_WITH_CAVEATS on `/discover-confidence`.

## Global Definition of Done

- Blueprint at `.claude/knowledge-base/discoveries/blueprints/m9-welcome-banner-blueprint.md`
  with the D1–D3 ADRs finalized (confirmed or amended by evidence) and the
  D-tables the M9 implementation plan will consume.
