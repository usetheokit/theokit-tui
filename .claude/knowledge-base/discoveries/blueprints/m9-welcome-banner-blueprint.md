---
slug: m9-welcome-banner
milestone_id: M9
created_at: 2026-07-07
discovery_plan: .claude/knowledge-base/discoveries/plans/m9-welcome-banner-plan.md
question: How do production agent CLIs build their welcome banner, and what is the minimal AI-native WelcomeBanner API for @theokit/tui?
---

# Blueprint: m9-welcome-banner

## Context

M9 ships `WelcomeBanner` — the Claude Code/gemini-cli-style startup banner
for @theokit/tui. The discovery plan (SHIPPABLE 97.8) locked 6 questions over
gemini-cli, opencode, oh-my-logo, codex and ink internals, absorbing 11
edge-case findings. Every claim below was read from source by 4 parallel
research agents (2026-07-07); citations resolve on disk. Questions Q1–Q6:
all `done`.

## Objective

Lock the D1–D5 ADRs (API, color, width, Static contract, validation) plus
the test strategy and evidence artifact the M9 implementation plan consumes
directly — zero open design questions at `/to-plan` time.

## Cross-cutting Comparison

| Dimension | gemini-cli | opencode | oh-my-logo | codex | OURS (decision) |
|---|---|---|---|---|---|
| Logo/name region | 3-variant ASCII ladder, no floor guard (EC-5 hole) | fixed-width marker art, no measurement | figlet/cfonts fonts | 35-line animation, hard floors | text name + accent border; plain-text final rung (closes the EC-5 hole) |
| Width source | `columns \|\| 60` + resize listener | framework hook | n/a (CLI once) | ratatui area | `columns ?? 60`, read at render (ink re-renders on resize) |
| Color | ThemedGradient (theme-level degrade) | per-char theme tokens | RAW ANSI gradient-string (NO_COLOR broken — EC-7) | ratatui styles | `theme.accent` + `dimColor` ≡ ThemedGradient's empty branch |
| Static | header IS first Static item + refreshStatic clearTerminal | n/a | n/a | n/a | NEVER Static (single-consumer invariant) — D4 |
| Hints | conditional renumbering + session cap in host hooks | n/a | n/a | n/a | `hints?: readonly string[]`, caps = host concern |
| Tests | svg snapshots + mock-heavy | n/a | n/a | structural row asserts + boundary pairs | boundary pairs + anchored snapshots (house style) |

## Recommendations

1. Implement per D1–D5 below; the plan's TDD tables consume Corner 1 verbatim.
2. ZERO new dependencies (Corner 2 table) — ink borderStyle + M6 tokens.
3. Evidence = no-new-bench justification + non-TTY smoke (Corner 3).
4. Guard in review: no layout props, no `<Static>`, no gradient dep.

## Coverage Corner 1 — Integration Tests

**Peer idioms.** codex pins its welcome degrade with STRUCTURAL buffer
oracles, not snapshots — `row_containing` scans rows
(`.claude/knowledge-base/references/codex/codex-rs/tui/src/onboarding/welcome.rs:129-137`)
and the height breakpoint is pinned on BOTH sides
(`.claude/knowledge-base/references/codex/codex-rs/tui/src/onboarding/welcome.rs:155-168`);
the `snapshots/` dir has `.snap` files only for `trust_directory`, none for
welcome (plan assumption corrected). gemini pins the multi-line banner policy
via `it.each` + svg snapshots at fixed width 80
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Banner.test.tsx:12-33`)
and the conditional-tip renumbering with one snapshot per branch
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Tips.test.tsx:13-24`).
gemini's `Header.test.tsx:16-54` is mock-heavy (mocks ink.Text itself) — NOT
copied (testing.md § 6).

**Our strategy (consumed verbatim by the plan's TDD tables):**

| Layer | Oracles | Precedent |
|---|---|---|
| Unit `src/welcome-banner.test.tsx` | `hints={[]}` → zero hint lines AND zero margin gap vs `hints=undefined` (EC-8); `version` undefined → no `vundefined`, no empty meta line (EC-11; gemini renders conditionally, `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Header.tsx:52-56`); width-floor boundary PAIR (border at floor, plain-text rung at floor−1 — codex idiom); rows ≤ width sweep across [60,40,20] (`src/context-window-bar.test.tsx:211-224` house shape); EC-9 policy pins (`\n` in name → typed error; tagline splits; hint entry with `\n` → typed error); accent-token consumption via provider override; typed-error negatives | codex welcome.rs + our context-window-bar suite |
| Snapshots (budget 2) | 1 unit snapshot (default banner, fixed width, anchors FIRST) + 1 composed scene in `tests/public-api.integration.test.tsx` (banner above ChatThread, `<Box width={60}>`, anchor-then-snapshot per its lines 277-283) | 1 public-api snapshot per milestone (M5/M7 precedent) |
| Degrade matrix | Extend `tests/fixtures/no-color-probe.tsx` (all-primitives provider fixture) with one `<WelcomeBanner>`; add name/hint presence + border-glyph policy assert to `assertDegradedScene` — ZERO new spawns (3-scene structure + TERM=dumb byte-equality inherit it, `tests/degrade-matrix.integration.test.tsx:10-101`) | M6 degrade matrix |
| Non-TTY smoke | `tests/example-banner.integration.test.ts` in the `tests/example-stream.integration.test.ts:1-25` shape — piped stdout IS the EC-2 environment (`columns === undefined` → fallback path exercised by construction) | M7 smoke |

## Coverage Corner 2 — Dependencies

**Verdict: ZERO new dependencies.**

| Candidate | Verdict | Evidence |
|---|---|---|
| `ink-gradient` | SKIP — gemini runtime dep (`.claude/knowledge-base/references/gemini-cli/packages/cli/package.json:53`) consumed via ThemedGradient; D2 locks accent-only; gemini must mock it in tests | port the degrade PATTERN, not the dep |
| `gradient-string` | SKIP — oh-my-logo emits RAW ANSI via marker matchAll (`.claude/knowledge-base/references/oh-my-logo/src/InkRenderer.tsx:46-73`), bypassing chalk level ⇒ NO_COLOR broken (EC-7 confirmed: its own `shouldUseColor()` in `.claude/knowledge-base/references/oh-my-logo/src/utils/stdout.ts:6-34` is never imported by the render paths) | — |
| `figlet` / `cfonts` | SKIP — oh-my-logo runtime deps (`.claude/knowledge-base/references/oh-my-logo/package.json:50-57`); ASCII-art fonts out of scope | — |
| `string-width` | SKIP — NOT resolvable from our root (pnpm-strict; only ink may import its own dep `string-width@^7.2.0`); gemini declares it directly (`.claude/knowledge-base/references/gemini-cli/packages/cli/package.json:64`) but our design needs NO manual string measurement (D3: ink truncates via `wrap="truncate-end"`; ink itself measures via widest-line/string-width — `node_modules/ink/build/measure-text.js:1`, `node_modules/ink/build/output.js:2`) | parsimony rung 3 |
| border | USE ink built-in `borderStyle` — cli-boxes@3.0.0 already installed via ink; styles `single, double, round, bold, singleDouble, doubleSingle, classic, arrow` (`node_modules/ink/build/styles.d.ts:142`, `node_modules/ink/build/render-border.js:1-11`) | rung 4 |
| color | USE M6 tokens (`theme.accent` + `dimColor` idiom) | rung 4 |

## Coverage Corner 3 — Tools

**Evidence artifact decision (Q6).** No new bench — mirroring the M7 D7
wording (`.claude/knowledge-base/implementations/m7-stream-adapter-implementation.md:69-76`):

> **No-new-bench justification (M9):** `WelcomeBanner` renders exactly ONCE
> at startup — a static box with no per-frame path, no timers, no
> stream-driven re-render (every existing bench target measures ms-per-frame
> under streaming). A dedicated banner bench would measure a single mount
> dominated by process startup — noise, not signal. Startup cost is
> accounted as a TTFATT contribution note in the subprocess smoke.
> **Flip condition:** the day the banner grows a per-frame path (animated
> logo à la codex `AsciiAnimation` — `.claude/knowledge-base/references/codex/codex-rs/tui/src/onboarding/welcome.rs:28`
> — a resize-reactive loop, or a gradient shimmer), that slice MUST land
> with its own bench before merge.

**Smoke design:** `examples/banner.tsx` (human caller, wiring pillar a) +
subprocess smoke asserting: name literal; `v{x.y.z}` AND
`not.toContain("vundefined")` (EC-11); ≥ 1 hint; the border corner glyph of
the D3 style (pipe fallback width 60 sits above the floor → border present);
exit 0. Full-suite regression re-run remains the render-path guard.

## Coverage Corner 4 — Techniques

**Anatomy (Q1).** gemini has TWO headers: legacy `Header.tsx` (3-variant
ASCII ladder + nightly-only right-aligned `v{version}`,
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Header.tsx:15-56`)
and the composed `AppHeader.tsx` (4-row half-block icon + metadata column:
bold name + dim ` v{version}`, column-mode below 60 cols,
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/AppHeader.tsx:25-157`).
`Banner.tsx` is NOT the logo — an informational round-bordered text box
(first line bold/gradient, rest plain,
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Banner.tsx:20-70`).
`Tips.tsx` renumbers conditionally — no rotation; frequency caps live in
HOST hooks (useBanner sha256 ≤ 5 shows, useTips ≤ 10 sessions), confirming
caps are app concerns, not component API
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Tips.tsx:16-38`,
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useBanner.ts:13`,
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useTips.ts:15-23`).
opencode: fixed-width per-char marker art colorized from theme tokens, no
measurement, no gradient dep
(`.claude/knowledge-base/references/opencode/packages/tui/src/logo.ts:1-11`,
`.claude/knowledge-base/references/opencode/packages/tui/src/component/logo.tsx:9-55`).

**Width (Q2).** gemini `useTerminalSize`: `process.stdout.columns || 60`
(+ rows || 20) with resize listener
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useTerminalSize.ts:9-30`)
— EC-2 pipe fallback = 60. Ladder: long→short→tiny with NO guard below tiny
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Header.tsx:31-39`
+ `flexShrink={0}` → broken art below ~23 cols — the EC-5 hole); codex has
an explicit floor + boundary-pair test. **Ours:** clamp
`width = min(columns ?? 60, 60)`; final rung below the floor = plain
one-line `<Text>` title (no art, no fixed Box). Width measurement: NONE
manual — ink measures/truncates (EC-1 resolved at rung 3: gemini's
`.length` is ASCII-only by design, `string-width` unimportable under
pnpm-strict, `Intl.Segmenter` counts graphemes not columns).

**Border/TERM=dumb (Q2/EC-4).** ink emits cli-boxes glyphs UNCONDITIONALLY
(`node_modules/ink/build/render-border.js:1-11`; zero TERM checks). Policy is
ours, as data: `borderStyle = isMonochrome(theme) ? "single" : "round"`
(module-import of the M6 predicate — env handling stays in the provider per
`src/theme.tsx:324-341`). NO_COLOR strips border COLOR via the theme swap;
glyphs stay.

**Height (Q2/EC-10).** Dispensed with record: banner ≤ 10 lines; a 24-row
terminal keeps ≥ 55% viewport; codex's 37-row gate exists for a 35-line
animation (`.claude/knowledge-base/references/codex/codex-rs/tui/src/onboarding/welcome.rs:23-24`)
we don't ship. Flip: adopt the codex single-guard pattern if a tall variant
ever lands.

**Color (Q3).** gemini `ThemedGradient` is the theme-level pattern: ≥2
colors → ink-gradient; 1 → `Text color`; empty → accent fallback
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/ThemedGradient.tsx:12-37`;
token optional at
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:183`).
**Accent-only IS that pattern with `gradient === undefined`** — no
divergence, minus branches we don't need. Our mapping: `theme.accent` =
border + name; `dimColor` idiom = hints/version (house precedent across
M0–M6 — e.g. `src/tool-call.tsx:101`); warning variant possible later via
`theme.status.warning` (not in v0 — YAGNI). NO_COLOR free via wholesale
theme swap (`src/theme.tsx:327-341`; `accent: ""` at 179). Honest caveat
(pre-existing project-wide): `dimColor` SGR-2 is emitted by ink→chalk
independent of the theme swap — same accepted behavior as all M0–M6
components. Token gaps: none.

**Static/resize contract (Q1/EC-3).** gemini mounts its header as the FIRST
`<Static>` item and pays for it with `refreshStatic()` clear-terminal
machinery (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:646-698`).
Our repo pins ONE mounted `<Static>` consumer (`src/agent-timeline.tsx:176-204`).
**Decision (D4): WelcomeBanner NEVER mounts `<Static>`** — plain component
above the thread. Documented interaction: once thread history graduates into
its `<Static>`, frozen rows print above the dynamic region and the banner
visually sinks — acceptable-by-design for a WELCOME moment. Flip condition:
a `header` element folded into ChatThread's own Static items (gemini's
shape) — NOT in v0.

**Multi-line policy (Q1/EC-9).** gemini normalizes literal `\n` for its
remote-config transport (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/Banner.tsx:17`)
— transport concern, not a props-API idiom. Ours: `name`/`version`
single-line fail-fast (typed error); `tagline` splits on real `\n` (one
`<Text>` per line); `hints` entries single-line (the array IS the multi-line
mechanism), `\n` in an entry = typed error.

**Suppression (Q1/EC-6).** Consumer's responsibility — don't mount it.
gemini's guards live in the composing host, never the leaf
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/AppHeader.tsx:77-79`).
No `hidden` prop enters the API.

## ADRs

### D1 — Minimal AI-native API, single children slot (FINAL)

**Decision:** `WelcomeBannerProps = { name: string; version?: string;
tagline?: string; hints?: readonly string[]; children?: ReactNode }`. No
grid/columns/layout props (the grill's out-of-scope guard). No `hidden`
prop (EC-6 — suppression = don't render; gemini precedent). Frequency caps
are host concerns (gemini useBanner/useTips evidence).
**Alternatives:** slot-per-region (rejected: layout-framework drift);
render-props (rejected: over-engineering); `hidden` escape hatch (rejected:
peer evidence contra).
**Consequences:** review guards no layout-prop creep; children compose free
content inside the box.

### D2 — Accent-only color via M6 tokens; no gradient (FINAL)

**Decision:** border + name via `theme.accent`; hints/version via the house
`dimColor` idiom; NO gradient dep. This IS gemini's ThemedGradient
empty-branch, not a divergence.
**Alternatives:** ink-gradient (rejected: D2 risk class + mock burden);
gradient-string (rejected: EC-7 raw-ANSI NO_COLOR bypass — proven);
new `gradient` theme token (rejected: YAGNI, zero current use).
**Consequences:** NO_COLOR correct for free; dimColor caveat documented
(pre-existing project-wide).

### D3 — Width: clamp to min(columns ?? 60, 60); plain-text final rung (FINAL)

**Decision:** read `stdout.columns ?? 60` (gemini's proven pipe fallback);
banner Box `width = min(that, 60)`; below the floor (border+padding no
longer fit a legible line, floor = 24 cols) render a single plain
`<Text>` line `name vVERSION` — codex-style explicit final rung, closing
gemini's EC-5 hole. Content truncation: ink `wrap="truncate-end"` — zero
manual string measurement (EC-1). Border style as data:
`isMonochrome(theme) ? "single" : "round"` (EC-4 — ink never degrades).
Height: dispensed with record (EC-10).
**Alternatives:** fixed width (rejected: grill R2); string-width direct dep
(rejected: no manual measurement needed); resize listener state (rejected:
ink re-renders on resize; reading columns at render suffices for a
startup-moment component).
**Consequences:** boundary-pair tests at the floor; smoke exercises the
pipe fallback by construction.

### D4 — No `<Static>`; plain component above the thread (FINAL)

**Decision:** WelcomeBanner never mounts `<Static>` (single-consumer
invariant, `src/agent-timeline.tsx:176-204`); banner-sinks-after-graduation
documented as accepted; flip = ChatThread `header` slot (gemini's
first-Static-item shape) if dogfood demands.
**Alternatives:** own Static (rejected: breaks the invariant); refreshStatic
machinery (rejected: host-app-grade complexity — a library must not own
clearTerminal).
**Consequences:** one Drawback line in the plan; no repaint machinery.

### D5 — Fail-fast typed props validation (FINAL)

**Decision:** boundary validation at the component (M0–M6 house pattern):
empty `name`, `\n` in `name`/`version`/hint entries → typed error naming
prop + offending value; `tagline` may contain `\n` (splits).
**Alternatives:** silent normalization (rejected: gemini's `\\n` replace is
transport-specific; surprising in a typed API).
**Consequences:** negative tests per prop (testing.md § 4.1).

## Verified-absence notes

- RTL/bidi: no peer handles it — out of scope, recorded.
- Tips "rotation": does not exist in gemini (conditional renumbering +
  session cap only) — plan wording corrected.
- codex welcome snapshots: absent (structural row asserts instead) — plan
  assumption corrected.
