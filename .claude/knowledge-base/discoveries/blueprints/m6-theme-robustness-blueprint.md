# Blueprint: M6 Theme + robustness foundation

> **Version 1.0** — Synthesizes the deep research over `gemini-cli` (the only Ink
> production multi-theme system: 19 built-ins + NoColor swap, semantic tokens derived
> from a 17-slot palette), `ink-ui` (the LIBRARY-shaped ThemeProvider/extendTheme
> contract), the INSTALLED ink→chalk 5.6.2 chain (empirically verified precedence:
> NO_COLOR is handled NOWHERE — it is ours to implement at the theme layer) and the
> complete internal M0-M5 debt register into the locked M6 decisions: TheoTheme grows
> semantic groups (`accent`, `code.*`, `toolStatus.*`) hosting 100% of the parked
> color/glyph debt with a byte-identical default (zero snapshot churn as an acceptance
> criterion); theme selection via a backward-compatible union prop with an EXPLICIT
> base (never ambient); built-ins in ANSI-16 named colors (chalk-version-proof
> snapshots); NO_COLOR as an all-empty theme swap resolved once at provider level;
> a 3-scene degrade-probe matrix (+2 subprocess spawns, one fixture) instead of a
> snapshot cartesian (≤ 3 new snapshots); no new bench (structurally zero per-frame
> delta — justification recorded) with the full 6-bench re-run as regression
> evidence. All 6 research questions answered; 0 blocked.

**Slug:** `m6-theme-robustness`
**Source plan:** `.claude/knowledge-base/discoveries/plans/m6-theme-robustness-plan.md`
**Owner:** paulohenriquevn + Claude (assisted)
**Generated:** 2026-07-07 via `/discover-execute`
**Confidence verdict:** SHIPPABLE (98.7/100 — 2026-07-07, zero caps)

## Context

Inherited from the discovery plan: `ROADMAP.md § M6` — theme system (tokens +
terminal-adaptive palette), `TheoTUIProvider` finalized + ≥ 2 built-ins; every
primitive respects `NO_COLOR`/`FORCE_COLOR`/`TERM=dumb` and renders degraded in
non-TTY; snapshot matrix per primitive × color level. Risks: (1) combinatorial
snapshot surface; (2) capability-detection edge cases.

## Objective

Enable `/to-plan` to write the M6 plan with zero unresolved design questions.

---

## Coverage Corner 1 — Integration Tests

*(Answers Q4.)*

- **Neither analog does a snapshot cartesian.** gemini pins ONE color level suite-wide
  (`FORCE_COLOR='3'` + `COLORTERM=truecolor` + `getColorDepth = () => 24` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/test-setup.ts:17-47`) and
  its THEME tests assert STRUCTURE + VALUES, never rendering (zero `toMatchSnapshot`
  in `theme-manager.test.ts`/`theme.test.ts`/`color-utils.test.ts` — e.g. value
  asserts at
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.test.ts:38-45`);
  its NO_COLOR test is an in-process theme-swap unit test
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.test.ts:117-126`)
  — possible only because their env check is per-call. ink-ui builds expected frames
  WITH chalk in the test (oracle auto-tracks the level —
  `.claude/knowledge-base/references/ink-ui/test/badge.tsx:7-11`) and re-renders ONCE
  per component with a custom theme (`.claude/knowledge-base/references/ink-ui/test/unordered-list.tsx:38-73`)
  — one custom case, not a matrix.
- **Snapshot budget (D3 satisfied — O(primitives + levels)):** the existing 21
  snapshots ARE the canonical diagonal (default theme × pinned level). M6 adds ≤ 3:
  one composite scene under the second built-in + ≤ 2 slack (the M4 ≤2-highlighted
  precedent). Everything else is mechanical: per-built-in token-value tests (gemini
  idiom); the generalized M4-D8 invariance test
  `stripAnsi(themed frame) === stripAnsi(default frame)` parameterized over the
  primitives (theming may change ONLY color bytes — the off-diagonal is safe without
  snapshots); token→escape-byte asserts in the provider tests (our
  `src/chat-message.test.tsx:114-125` `[32mtinted` shape). Avoided: ~12 primitives ×
  3 levels × states ≈ 144 snapshots.
- **Migration churn = 0 by construction:** value-preserving token migration changes no
  emitted byte — "default theme byte-identical to M0-M5 output" is an explicit
  acceptance criterion; ANY snapshot diff during migration is a regression finding,
  never `--update` noise.
- **EC-4 (determinism across chalk versions):** our snapshots contain ZERO truecolor
  sequences (`grep -rc '38;2' src/__snapshots__/` = 0; the color alphabet is ANSI-16:
  `[36m` ×10, `[32m` ×5, `[31m` ×5, `[33m` ×4, `[90m` ×3, `[35m` ×2, `[34m` ×1).
  Named ANSI-16 colors are LEVEL-INDEPENDENT (empirically: `chalk.cyan` → `[36m` at
  level 1 and 3) — built-ins in named colors keep every snapshot chalk-version-proof
  AND level-pin-proof. A tiny downsample canary (`hex('#ff8800')` → `38;5;214` at
  level 2) turns any future chalk rounding change into one red test.
- **Typed per-component consumption idiom (if ever needed):** ink-ui's
  `useComponentTheme<Theme>('Spinner')` derives the type from the theme module
  (`.claude/knowledge-base/references/ink-ui/source/components/spinner/theme.ts`,
  consumed at `.claude/knowledge-base/references/ink-ui/source/components/spinner/spinner.tsx:16`)
  — our closed interface keeps this unnecessary.
- **In-process env stubbing is a trap (rule for the blueprint):** chalk freezes its
  level at import — level changes REQUIRE a fresh subprocess; theme swaps are
  in-process (provider prop). A `vi.stubEnv('NO_COLOR')` + snapshot test would be
  green-but-vacuous.

---

## Coverage Corner 2 — Dependencies

*(Answers Q5.)*

- **ZERO new dependencies.** The installed chain audited: `ink@5.2.1` → `chalk@5.6.2`
  (which VENDORS its own supports-color + ansi-styles). ink-ui — the library analog —
  adds only `chalk` (already ink's dep) for input-hook cursor inverse
  (`.claude/knowledge-base/references/ink-ui/package.json`,
  usage at `.claude/knowledge-base/references/ink-ui/source/components/text-input/use-text-input.ts:3`); gemini pulls no theming
  lib (its `color-convert` is declared but has no import under `packages/cli/src` —
  verified absence; hex/luminance math hand-rolled in
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/color-utils.ts`).
- **What ink gives us FREE (Rule 9 boundary — do NOT reimplement):** level detection
  (frozen at chalk import), deterministic hex→256→16 downsampling (pure math in
  vendored ansi-styles: `hexToRgb` → `rgbToAnsi256` 6×6×6 cube → `ansi256ToAnsi`;
  empirically `#ff8800` → `[93m` @L1, `38;5;214` @L2, `38;2;255;136;0` @L3), non-TTY
  → level 0 plain text, attribute stripping at level 0 (dim/bold/italic vanish with
  color — glyphs are the only surviving channel), CI last-frame rendering
  (`is-in-ci`; note `CI=""` counts as TRUE).
- **What ink does NOT give us (the M6 surface):** `NO_COLOR` — ZERO handling in the
  entire installed chain (grep-verified across chalk 5.6.2 source, supports-color
  7.2.0, ink build); `TERM=dumb` beyond level 0; plain-pipe frame-erase escapes
  (`log-update` eraseLines still land in a non-CI pipe — "renders degraded in
  non-TTY" means color-free content, not control-sequence-free bytes); runtime
  re-detection.
- **YAGNI list:** direct `supports-color` dep (could resolve to a different major
  with different NO_COLOR semantics than chalk's vendored copy);
  `color-convert`/`colorette`/`picocolors`; a perceptual-distance ANSI mapper (codex's
  `terminal_palette.rs` ladder — reimplements chalk's job); OSC-11 terminal-background
  query machinery (gemini's TerminalCapabilityManager — app concern, out of scope).

---

## Coverage Corner 3 — Tools

*(Answers Q6.)*

- **NO new bench — justification recorded with data:** M6 adds zero per-frame work.
  Components already read tokens via `useTheoTheme()` → `useContext`
  (`src/theme.tsx`); the provider value is memoized (F-dom-1). M6 changes WHICH object
  the context holds — merge cost moves to provider mount / theme-prop change, never
  the render hot path. A "themed vs default" bench would measure the same `useContext`
  on both sides: the delta is structurally zero and reporting ±noise as "theming cost"
  is benchmark theatre. Theme switch is not a hot path (one merge per user action;
  no N to scale).
- **The honest M6 evidence artifacts:** (a) the 3-scene degrade-probe matrix
  (Corner 1/ADR D6) — robustness evidence, which is what M6's name promises; (b) the
  `stripAnsi` theme-invariance test over the primitives; (c) a full
  `benchmarks/run.ts` re-run (all 6 benches, M5-vs-M6 comparison, mean ± std dev)
  recorded in the implementation log — catches any accidental per-frame regression
  from the token migration (e.g. building theme objects inside a component render)
  with real numbers; bar: no bench regresses beyond its recorded run-to-run variance;
  (d) this recorded justification. **Flip condition:** if the M6 design ends up doing
  ANY per-render computation (per-render capability detection, non-memoized token
  derivation), re-run `metrics-footer.bench.tsx` with a themed provider as the light
  bench — its mode-delta shape is reusable as-is.

---

## Coverage Corner 4 — Techniques

*(Answers Q1, Q2, Q3.)*

### Q1 — Theme-system anatomy

- **Declaration:** gemini = two layers — 17-slot raw palette shared by the dark
  built-ins (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:208-228`,
  consumed at `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/dark/default-dark.ts:7-35`)
  (`ColorsTheme` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:163-184`)
  + derived `SemanticColors` (`text.*`, `background.*`, `border.*`, `ui.*`,
  `status.{error,success,warning}` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/semantic-tokens.ts:9-43`)
  + a ~40-class hljs map DERIVED from the palette (`theme.ts:439-574` — our
  HLJS_COLOR_MAP debt, generated not hand-rolled). ink-ui = component-scoped prop-bag
  style slots that absorb non-color tokens (glyphs via figures, `dimColor: true` —
  `.claude/knowledge-base/references/ink-ui/source/components/progress-bar/theme.ts:14-24`;
  schema `.claude/knowledge-base/references/ink-ui/source/theme.tsx:17-26`).
- **Selection/merge:** gemini = module-singleton manager selecting by string name
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts:300-310`);
  custom themes merge onto `DEFAULT_THEME` — NEVER onto the active theme
  (`theme-manager.ts:143-148` — EC-1: the base is explicit/fixed, not ambient).
  ink-ui = `extendTheme(base, new)` deepmerge with the base as an EXPLICIT argument
  (`.claude/knowledge-base/references/ink-ui/source/theme.tsx:59-61`); ThemeProvider
  passes the value through unmemoized (`theme.tsx:53-57` — caller's burden; our
  provider already memoizes, EC-6).
- **Built-ins:** gemini ships 19 named + NoColor (env-triggered, not listed):
  `ansi-dark` uses Ink NAMED colors only
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/dark/ansi-dark.ts:10-28`
  — the 16-color-safe class); `no-color` sets EVERY slot to `''` (unstyled render —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/no-color.ts:10-29`).
  ink-ui ships exactly 1.
- **Custom-theme fill:** gemini's `createCustomTheme` fills gaps with `??` chains +
  luminance interpolation
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:394-433`);
  ink-ui parameterizes style slots by component props
  (`.claude/knowledge-base/references/ink-ui/source/components/alert/theme.ts:14-20`)
  and carries icon/glyph config per variant (`alert/theme.ts:39-59`).
- **Pitfalls:** gemini's singleton needs `resetForTesting` (global mutable state —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts:257-299,663`;
  library code stays in React context); its getter shims read the singleton on every property access, bypassing React
  reactivity
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/colors.ts:10`,
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/semantic-colors.ts:10`);
  ink-ui's deepmerge CONCATENATES arrays (array tokens need replace semantics); its
  unknown-component lookup returns undefined uncast; gemini's `_buildColorMap` DROPS
  the bold/italic declared in no-color.ts (`theme.ts:382-383` — attributes must be
  first-class or not in the theme at all).

### Q2 — Capability detection (empirically verified)

- **The precedence chain (chalk 5.6.2 vendored supports-color, source-cited + run):**
  `FORCE_COLOR=0` → 0 absolute; non-TTY → 0 ONLY if FORCE_COLOR unset; from there
  FORCE_COLOR≥1 is a FLOOR (`min`), not a force (`FORCE_COLOR=3` with
  `TERM=xterm-256color`, no COLORTERM → level **2**); `TERM=dumb` → exactly the floor
  (`TERM=dumb + FORCE_COLOR=N` → exactly N — immune even to `GITHUB_ACTIONS=true`,
  the deterministic pin recipe); `GITHUB_ACTIONS` → 3 (a CI-runner divergence trap:
  our current `FORCE_COLOR=1, CI=""` pin yields level 1 locally but would yield 3 on
  GH Actions — masked today ONLY because all our colors are named/level-independent);
  `NO_COLOR` → **read NOWHERE** (grep zero hits across the chain).
- **Level 0 collapses the ENTIRE visual channel** (colors AND dim/bold/italic —
  empirically `FORCE_COLOR=0` renders `dim`/`bold` as plain) — glyphs/labels are the
  only signal, which is exactly what our probe mechanisms assert.
- **NO_COLOR is ours:** gemini's pattern is the verified SOTA — `getActiveTheme()`
  short-circuits to NoColorTheme when `process.env['NO_COLOR']` is set
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts:316-319`); degrade is DATA (an all-empty theme), not code
  branches. Caveat: their check runs per call — ours must resolve ONCE (module scope /
  provider memo), or it becomes the per-frame work Corner 3 concluded doesn't exist.
- **Adaptive palette:** truecolor hex tokens are SAFE everywhere (deterministic
  downsample; codex's perceptual ladder and paired 16-color values are unnecessary —
  rejected alternatives), BUT hex values make snapshots level-pin-dependent (the GH
  Actions divergence). Verdict for v1 built-ins: named ANSI-16 colors (gemini
  ansi-dark precedent); hex stays available to CONSUMERS via override (chalk
  downsamples deterministically — their choice, their terminals).

### Q3 — Debt migration (complete register)

- **Migration table verdict: ONE semantic taxonomy hosts 100% of the color/glyph
  debt; the residue is CORRECTLY non-theme** (attributes, truncation copy, cursor
  fallback, SGR merge → robustness/copy lanes; no permanent stragglers).
  - `ACCENT_COLOR "cyan"` ×2 (`src/context-window-bar.tsx:15`,
    `src/token-usage-chart.tsx:8`) → `accent` slot (the chart gains its missing
    `useTheoTheme()` hook).
  - `HLJS_COLOR_MAP` 18 classes → 7 colors (`src/code-block.tsx:33-52`) →
    `code.{keyword,builtin,number,string,regexp,comment,variable}` (bucket-level
    tokens; the class→bucket table stays module-local — gemini keeps its class map
    inside the Theme too).
  - `STATUS_VISUALS` glyph+color per status (`src/tool-call.tsx:36-38`) →
    `toolStatus.{pending,running,success,failed}.{glyph,color}` (colors already
    alias theme slots — only glyphs + the map location are debt; `failed.bold` stays
    a component attribute). `agent-streaming` spinner shares `toolStatus.running`.
  - Diff add/del already consume `status.success/error`; a `diff.*` group is DEFERRED
    until bg tints land (YAGNI — gemini's diff slots are backgrounds).
  - Role tokens: already themed since M0 — unchanged.
- **Backward compat: SURVIVES.** `TheoThemeOverride` gains optional groups — every
  existing override stays valid; the provider prop grows by union, not signature
  change. Sharp edge: `TheoTheme` (OUTPUT type) gains required groups — a consumer who
  hand-built a full `TheoTheme` breaks at typecheck (CHANGELOG-declared type growth,
  not semver-major; `{...defaultTheme, ...}` is the survival path).
- **EC-3 verdict: attributes stay OUT of tokens.** gemini's SemanticColors has zero
  attribute fields; attributes are the channel that SURVIVES color loss (our 23
  dimColor + 4 bold + 2 italic + 2 inverse sites stay component-level Ink props;
  modeling dim as a "gray" token would DESTROY it under NO_COLOR; gemini composes
  attributes WITH a color token directly at the call site —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.tsx:85`).
- **NOT theme concerns (honest out-of-scope):** truncation wording unification (M2/M4
  three-wording provenance — component copy, i18n-shaped scope creep; defer);
  `chat-composer.tsx:148` invisible inverse cursor under level 0 — a REAL degrade gap
  the DoD's "every primitive" covers → M6 ROBUSTNESS task (visible fallback char) —
  and the composer (+ CodeBlock) are MISSING from the probe fixture today; F9
  bold+dim SGR merge → re-document/accept; timeline prefix alignment + M5 tiered
  degrade/wrap hardening/EAW → recorded backlog, not M6 DoD.
- **Snapshot churn:** 21 snapshot sites, all ANSI-16 bytes; zero churn if
  value-preserved (the acceptance criterion).

## Cross-cutting Comparison

| Dimension | gemini-cli | ink-ui | ours (M6 target) |
|---|---|---|---|
| Token schema | palette → derived semantic + hljs | component prop-bags | grown semantic groups + glyph-bearing tokens |
| Selection | singleton manager, string name | provider prop, whole object | provider prop union (override / name / {base, override}) |
| Override base | always DEFAULT_THEME (explicit) | explicit extendTheme arg | explicit base param — never ambient |
| Built-ins | 19 + NoColor (env swap) | 1 | dark(=default) + light + no-color (env swap) |
| Built-in values | hex (+ ansi-dark named) | named | NAMED ANSI-16 (EC-4) |
| NO_COLOR | theme swap per call | none | theme swap resolved once |
| Attributes in theme | declared then dropped (bug) | in prop-bags | OUT of tokens (component props) |
| Level testing | one pinned level + swap unit tests | chalk-computed oracles | pinned level + 3-spawn probe matrix + invariance test |
| New deps | none | none | none |

## ADRs

### D1 — TheoTheme grows semantic groups hosting 100% of the debt; attributes stay out

**Decision:** `TheoTheme` gains `accent: string`, `code.{keyword, builtin, number,
string, regexp, comment, variable}`, `toolStatus.{pending, running, success,
failed}.{glyph, color}` — frozen in `defaultTheme` with values IDENTICAL to today's
module constants (byte-identical default). `role.*` and `status.*` unchanged. dim/
bold/italic/inverse stay component-level Ink props (never tokens). `diff.*` deferred
(YAGNI until bg tints). The hljs class→bucket table stays module-local in
code-block.tsx, mapping to `theme.code.*`.

**Rationale:** Q3's migration table proves 100% hosting with zero stragglers; gemini
derives its hljs map from the palette the same way; attributes are the surviving
channel under level 0 (gemini's no-color declares italic/bold/underline —
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/no-color.ts:96-117`
— then `_buildColorMap` DROPS them at
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:382-383`
— a bug class we avoid by exclusion).

**Alternatives considered:** ink-ui component prop-bag themes (rejected: open
`Record<string, unknown>` loses our closed typed contract and invites the undefined-
lookup crash class); per-hljs-class tokens (rejected: 40 slots of API for 7 values);
dim-as-gray-token (rejected: destroys the color-independent affordance).

**Consequences:** token-value structural tests per group; chart gains `useTheoTheme`;
both ACCENT_COLOR constants and the sync comments delete.

### D2 — Theme selection: backward-compatible union prop with an EXPLICIT base

**Decision:**

```ts
theme?: TheoThemeOverride                       // M0 call — unchanged semantics
      | TheoBuiltinThemeName                    // "dark" | "light" | "no-color"
      | { base?: TheoBuiltinThemeName; override?: TheoThemeOverride }
```

Resolution (inside the existing single `useMemo`): resolve base (default `"dark"` =
today's defaultTheme values) → leaf-merge override → freeze. The base of a partial
override is EXPLICIT, never "whatever is active" (gemini merges customs onto
DEFAULT_THEME; ink-ui takes the base as an argument). Nested providers keep RESET
semantics (reset target = the nested provider's own resolved base). Built-ins are
frozen module constants (free referential stability).

**Rationale:** EC-1 resolved by both analogs the same way; the union is discriminated
by `typeof === "string"` / `"base" in` / plain object — every existing consumer call
compiles and behaves identically.

**Alternatives considered:** a theme manager singleton (rejected: gemini's needs
resetForTesting — global mutable state is app-shaped); public `extendTheme` export
(rejected: the provider already merges; YAGNI until 2 concrete needs); deepmerge dep
(rejected: our leaf-merge extended one level is ~20 lines; ink-ui's deepmerge
array-concat is a documented foot-gun).

**Consequences:** `TheoBuiltinThemeName` + built-in objects exported; TheoTheme output
type grows (CHANGELOG-declared); provider tests gain name/base/override cases.

### D3 — Built-ins: dark (=default), light, no-color — NAMED ANSI-16 values only

**Decision:** Three built-ins: `dark` ≡ today's defaultTheme values (the byte-identical
anchor); `light` — a named-ANSI-16 palette tuned for light terminals (satisfies the
"≥ 2 built-in themes" DoD; seeds from gemini's ansi-light slot choices —
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/light/ansi-light.ts`); `no-color` —
every color slot `""` (Ink renders unstyled), glyphs preserved. Built-in values are
Ink NAMED colors ONLY (no hex) — consumers may pass hex in overrides (chalk
downsamples deterministically; their choice).

**Rationale:** EC-4 — our 21 snapshots are pure ANSI-16 and named colors are
level-independent (proven empirically), so named built-ins are chalk-version-proof
AND immune to the GH-Actions level divergence (`GITHUB_ACTIONS` forces level 3 while
our local pin yields 1 — hex built-ins would fork snapshots between environments).
gemini ships ansi-dark/ansi-light for exactly this class of terminal
(`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/dark/ansi-dark.ts:41-157`,
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/light/ansi-light.ts`).

**Alternatives considered:** hex palettes + lockfile pinning (rejected: level-pin
divergence between local and CI is live TODAY; a canary only detects, not prevents);
paired per-level palettes / perceptual mapper (rejected: reimplements chalk — Rule 9).

**Consequences:** one composite snapshot under `light` (the ≤3 budget); a downsample
canary test pins `hex('#ff8800')` → `38;5;214` at level 2 so consumer-facing hex
behavior is guarded.

### D4 — NO_COLOR is implemented BY US as a theme swap, resolved once

**Decision:** The provider resolves `process.env.NO_COLOR` (non-empty → the
`no-color` built-in wins over any `theme` prop — the spec's intent) ONCE per provider
instance inside the existing memo (env does not change mid-process; a module-scope
read is acceptable). Components stay branch-free: degrade is DATA (empty color
strings render unstyled), the gemini-verified pattern.

**Rationale:** Q2's decisive finding — the installed chain contains ZERO NO_COLOR
handling (grep-verified; our vitest comment claiming "FORCE_COLOR precedence over
NO_COLOR" was true only vacuously). The DoD explicitly promises NO_COLOR respect —
without this ADR the promise is false. Per-call env reads (gemini) would add the
per-frame work Corner 3 ruled out.

**Alternatives considered:** doing nothing / relying on chalk (rejected: chalk never
reads NO_COLOR — the promise would be a lie); per-component env branches (rejected:
gemini proves degrade-as-data needs zero render branches).

**Consequences:** the NO_COLOR probe scene now tests OUR code (no longer vacuous —
today it passes because the pipe forces level 0); an in-process unit test of the swap
complements the subprocess probe.

### D5 — Value-preserving migration: byte-identical default as an acceptance criterion

**Decision:** Migrating ACCENT_COLOR/HLJS_COLOR_MAP/STATUS_VISUALS to tokens preserves
every default VALUE — "the default theme renders byte-identical to M0-M5 output" is a
stated acceptance criterion; expected snapshot churn = 0 of 21; any snapshot diff
during migration is a regression finding. Deliberate visual changes (if any) are
separate tasks with their own snapshot budget lines.

**Rationale:** Q3's churn analysis + the M4 drift-budget lesson — without the
criterion, `--update` noise drowns real regressions across 11 snapshot files.

**Alternatives considered:** migrating + retuning palettes in one motion (rejected:
un-reviewable diffs; the M4 review's hljs light-terminal retune belongs to the
`light` built-in, not to the default).

**Consequences:** refactor tasks are snapshot-stable by contract; the invariance test
(D6) enforces the same property against the `dark` built-in continuously.

### D6 — Test strategy: probe matrix (3 spawns, one fixture), invariance test, ≤ 3 new snapshots

**Decision:** (1) Extend the probe fixture with the MISSING primitives (ChatComposer —
whose cursor is invisible at level 0 today — and CodeBlock) so it mounts ALL
primitives; (2) THREE spawns of the same fixture in a dedicated
`tests/degrade-matrix.integration.test.tsx`: `NO_COLOR=1` (moves the existing block),
`TERM=dumb` (new — identical expected bytes to NO_COLOR: assert output equality as a
bonus invariant), bare-pipe with NO color env (new — proves detection without being
told; asserts color-absence + content, NOT control-sequence-free bytes — ink's
eraseLines still land in a non-CI pipe; set `CI` deliberately per scene since `CI=""`
counts as in-CI); both timeout layers + minimal env per spawn (house rule; +2 spawns
total, budget 8); (3) the generalized invariance test:
`stripAnsi(render under light/no-color) === stripAnsi(render under dark)` looped over
the primitives — layout/text NEVER change with theme; (4) per-built-in token-value
structural tests (gemini idiom) + provider resolution tests (name / base+override /
NO_COLOR wins / nested reset / referential stability); (5) ONE composite snapshot
under `light` (+ ≤2 slack); (6) the downsample canary; (7) composer visible-cursor
fallback gets a RED test in the robustness task.

**Rationale:** Corner 1 evidence — both analogs pin one level and test themes as data;
our subprocess probe is already stronger than both; the cartesian is avoided by
construction.

**Alternatives considered:** per-primitive probe fixtures (rejected: subprocess spawn
budget); in-process stubEnv level tests (rejected: vacuous — chalk freezes at
import).

**Consequences:** the existing NO_COLOR assertions relocate (file organization; bytes
unchanged); the suite ends ≤ 24 snapshots.

### D7 — Evidence: no new bench (recorded justification) + full 6-bench regression re-run

**Decision:** Per Corner 3 — no new bench; the M6 implementation log records the
justification (zero per-frame delta by construction: memoized provider, unchanged
useContext reads) and a full `benchmarks/run.ts` re-run comparing M6 vs the M5
recorded numbers; bar: no bench regresses beyond its recorded run-to-run variance.
Flip condition: any per-render computation lands → re-run metrics-footer.bench.tsx
themed-vs-default as a light bench.

**Rationale:** The cycle owner requires data over adjectives — the data here is the
6-bench regression table plus the structural argument; a synthetic themed-vs-default
bench would report noise as signal (analysis-golden-rule § 3 rigor).

**Alternatives considered:** theme-switch micro-bench (rejected: one merge per user
action, no N); skipping the regression re-run (rejected: the migration touches every
component's render path — the re-run is the honest guard).

**Consequences:** the M5 baselines stay the comparison anchor; implementation-log
carries the table.

## Recommendations for the project

| # | Recommendation | Linked to | Priority |
|---|---|---|---|
| 1 | TheoTheme growth (`accent`, `code.*`, `toolStatus.*`) + frozen byte-identical defaults | Q1/Q3, D1, D5 | HIGH |
| 2 | Provider union prop (name / base+override) with explicit base + memoized resolve | Q1, D2 | HIGH |
| 3 | Built-ins dark/light/no-color in named ANSI-16 + exports | Q1/Q2, D3 | HIGH |
| 4 | NO_COLOR theme-swap (ours — the chain has none) + in-process swap unit test | Q2, D4 | HIGH |
| 5 | Constant→token migration (3 components) under the zero-churn criterion | Q3, D5 | HIGH |
| 6 | Degrade-matrix: fixture gains composer+code-block; 3 spawns; invariance test; canary | Q4, D6 | HIGH |
| 7 | Composer visible-cursor fallback at level 0 (the one real degrade DEFECT found) | Q3, D6 | HIGH |
| 8 | 6-bench regression re-run + no-new-bench justification in the log | Q6, D7 | HIGH |
| 9 | Defer: `diff.*` bg tints, truncation-copy unification, tiered degrade/wrap hardening/EAW, extendTheme export, OSC-11 background detection | D1-D7 YAGNI | LOW |

## Blocked questions (if any)

(none — all 6 answered)

## Halt-loop progress (audit trail)

- Iterations used: 1 (inline — 4 parallel research agents + synthesis; Stop hook active)
- Questions answered: 6/6 · blocked: 0
- EC-1..EC-6 all answered with evidence (EC-1 explicit-base verdict from both analogs;
  EC-2 precedence chain source-cited AND empirically run — 14-row matrix; EC-3
  attributes-out verdict with the gemini drop-bug as counter-evidence; EC-4 zero
  truecolor bytes in our snapshots + named-color independence proven; EC-5
  deterministic downsample verified at 3 levels; EC-6 memo/frozen-singleton stability)
- Honesty notes preserved: lipgloss NOT vendored locally (profile details from
  bubbletea consumers only); gemini's `color-convert` declared-but-unused; our
  vitest NO_COLOR comment was vacuously true; the current probe's cleanliness comes
  from the PIPE, not NO_COLOR
- Citations verified: pre-synthesis path-existence sweep (all reference paths resolve)

## Related

- Discovery plan: `.claude/knowledge-base/discoveries/plans/m6-theme-robustness-plan.md`
- Project rules linked: `.claude/rules/architecture.md`, `.claude/rules/testing.md`,
  `.claude/rules/error-handling.md`, `.claude/rules/parsimony-ladder.md`
