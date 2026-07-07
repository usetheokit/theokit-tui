---
slug: m6-theme-robustness
milestone_id: M6
created_at: 2026-07-07
goal: Ship the M6 theme + robustness foundation (TheoTheme semantic growth hosting 100% of the M0-M5 color/glyph debt byte-identically; provider union prop with explicit base; built-ins dark/light/no-color in named ANSI-16; NO_COLOR implemented at the theme layer — the installed chain has none; composer visible-cursor degrade fix; 3-scene degrade-probe matrix; ≤3 new snapshots) with all gates green and the 6-bench regression re-run recorded.
---

# Plan: M6 Theme + robustness foundation

> **Version 1.0** — Implements `ROADMAP.md § M6` on top of M0-M5: `TheoTheme` grows
> `name`/`accent`/`code.*`/`toolStatus.*` (hosting ACCENT_COLOR ×2, HLJS_COLOR_MAP and
> STATUS_VISUALS with byte-identical defaults — zero snapshot churn as an acceptance
> criterion), the provider gains a backward-compatible union prop
> (`override | builtin-name | {base, override}`) with an EXPLICIT base (never ambient),
> three built-ins in named ANSI-16 colors, NO_COLOR resolved BY US at the theme layer
> (the installed ink→chalk chain contains zero NO_COLOR handling — empirically
> verified), the composer's invisible-cursor-at-level-0 defect fixed via a
> theme-driven visible marker, and the degrade-probe matrix (3 spawns of one fixture:
> NO_COLOR / TERM=dumb / bare-pipe) + theme-invariance test replacing a snapshot
> cartesian. No new bench (recorded justification) — the 6-bench regression re-run is
> the performance evidence. All design decisions locked by the m6-theme-robustness
> blueprint (SHIPPABLE 98.7).

## Goal

Enable TypeScript agent-CLI developers to theme every `@theokit/tui` primitive from
one token system (built-in selection + partial overrides, backward compatible with
every M0-M5 call site) and to ship agent CLIs that stay READABLE under
NO_COLOR/TERM=dumb/non-TTY — measured by the CI gate chain (format → lint →
typecheck → test → coverage → build → bench smoke) exiting 0 on `develop`.

## Context

M0-M5 shipped twelve primitives that deliberately parked color/glyph decisions as
module-local constants flagged "M6 theming candidate". `ROADMAP.md § M6` requires the
theme system (tokens + adaptive palette, ≥ 2 built-ins, provider finalized), the
terminal-robustness contract (NO_COLOR/FORCE_COLOR/TERM=dumb + non-TTY degrade for
EVERY primitive) and the snapshot matrix. Risks: (1) combinatorial snapshot surface —
resolved: existing 21 snapshots are the canonical diagonal, ≤ 3 new, off-diagonal via
the stripAnsi theme-invariance test + probe matrix (Blueprint §"D6"); (2) capability
detection edge cases — resolved: the exact chalk 5.6.2 precedence chain was
source-cited AND empirically run (14-row matrix); the decisive finding is that
NO_COLOR is handled NOWHERE in the installed chain — the DoD promise is OURS to
implement via the gemini theme-swap pattern (Blueprint §"D4"). The DISCOVER cycle
produced a SHIPPABLE blueprint (98.7) locking seven ADRs.

## Baseline Context (deep review of current state)

### Files that will be touched

| File | LoC today | Last commit (sha) | Why it exists today | Invariants to preserve |
|---|---|---|---|---|
| `src/theme.tsx` | 96 | `fa2c74e` | TheoTheme/Override/Provider/useTheoTheme (M0) | Every existing override call compiles + behaves identically; provider memo (F-dom-1) |
| `src/theme.test.tsx` | 113 | — | provider/merge tests | grows: built-ins, union prop, NO_COLOR, stability |
| `src/tool-call.tsx` | 150 | `eb611f9` | ToolCall/Card + STATUS_VISUALS | rendered bytes unchanged (byte-identical migration) |
| `src/agent-streaming.tsx` | 87 | — | live indicator (spinner color = status.warning) | bytes unchanged |
| `src/code-block.tsx` | 264 | `f8dfa42` | CodeBlock + HLJS_COLOR_MAP | bytes unchanged; class→bucket table stays module-local |
| `src/context-window-bar.tsx` | 144 | `c2e9c9a` | gauge + ACCENT_COLOR | bytes unchanged; ACCENT_COLOR deleted |
| `src/token-usage-chart.tsx` | 97 | `c2e9c9a` | chart + ACCENT_COLOR (no hook today) | bytes unchanged; gains useTheoTheme |
| `src/chat-composer.tsx` | 209 | `ae00ca0` | composer; cursor = `<Text inverse>` (invisible at level 0 — the one real degrade DEFECT) | colored-mode bytes unchanged; no-color mode gains a visible cursor marker |
| `tests/fixtures/no-color-probe.tsx` | 67 | — | degrade probe fixture (MISSING composer + code-block) | gains both; existing scene content preserved |
| `src/chat-message.test.tsx` | 198 | — | hosts the NO_COLOR probe test (M0 artifact) | probe test MOVES to the new degrade-matrix file (assertions preserved verbatim) |
| `tests/degrade-matrix.integration.test.tsx` (NEW) | 0 | — | 3-scene probe matrix | — |
| `tests/export-surface.test.ts` | 128 | — | public-entry contract | grows: themes/TheoBuiltinThemeName present |
| `tests/public-api.integration.test.tsx` | 277 | — | integration scenes | grows: light-theme composite scene |
| `examples/themes.tsx` (NEW) | 0 | — | dark vs light showcase (TTFATT caller for built-ins) | — |
| `tests/example-themes.integration.test.ts` (NEW) | 0 | — | subprocess smoke | — |
| `package.json` | 85 | — | manifest | + `example:themes` script ONLY (zero new deps) |
| `CHANGELOG.md` | — | — | M5 entries under Unreleased | every task appends |

### Current callers / dependents

- **`useTheoTheme` consumers today:** chat-message, chat-composer, tool-call,
  tool-result, agent-timeline, agent-streaming, diff-viewer, context-window-bar (NOT
  token-usage-chart — T2.3 adds it). All keep working — `TheoTheme` grows, nothing
  renames.
- **Public API impact:** `TheoThemeOverride` gains OPTIONAL groups (source-compatible);
  the provider `theme` prop widens by union (existing object calls unchanged);
  `TheoTheme` (output type) gains required fields — type-level growth declared in
  CHANGELOG (consumers spreading `defaultTheme` are unaffected).
- **Snapshot surface:** 21 `toMatchSnapshot` sites, ALL ANSI-16 bytes (zero `38;2`
  truecolor — grep-verified). Byte-identical migration ⇒ 0 churn expected; any diff
  is a regression finding (Blueprint §"D5").
- **vitest env pin:** `FORCE_COLOR=1 / NO_COLOR="" / CI=""` — named colors are
  level-independent, so the pin stays; the NO_COLOR="" empty value resolves to
  "not set" under the non-empty check (D4) — pinned by a provider test.

### Domain glossary

- **token groups (new):** `accent` (single color slot — the metrics fill),
  `code.{keyword, builtin, number, string, regexp, comment, variable}` (7 hljs
  buckets), `toolStatus.{pending, running, success, failed}.{glyph, color}`.
- **theme name** — `TheoTheme.name: string` (`"dark" | "light" | "no-color"` for
  built-ins; `"custom"` when an override changes a base) — degrade-as-data seam: the
  composer's cursor fallback reads it instead of branching on env.
- **explicit base** — a partial override always merges onto a NAMED base (default
  `"dark"` ≡ today's values), never onto "whatever is active" (EC-1, both analogs).
- **no-color built-in** — every color slot `""` (Ink renders unstyled), glyphs
  preserved; selected automatically when `process.env.NO_COLOR` is NON-EMPTY (read
  inside the provider memo — once per mount/prop-change, never per frame).
- **degrade matrix** — 3 subprocess spawns of ONE fixture: `NO_COLOR=1` (tests OUR
  theme swap end-to-end), `TERM=dumb` (chalk level 0), bare-pipe (no color env at
  all — proves detection); NO_COLOR and TERM=dumb outputs are asserted BYTE-EQUAL
  (both level 0 + same theme resolution... no-color swap makes NO_COLOR scene ours;
  dumb scene exercises chalk-only degrade — equality assert documents that both paths
  converge on the same bytes).
- **theme-invariance test** — `stripAnsi(frame under any theme) === stripAnsi(frame
  under dark)`: theming may change ONLY color bytes, never text/layout (the M4-D8
  text-invariance oracle generalized).
- **downsample canary** — one test pinning `chalk.hex("#ff8800")` at level 2 →
  `38;5;214` so a chalk bump that changes rounding turns ONE test red (consumer hex
  overrides stay guarded even though built-ins are named-only).

### Architecture boundaries affected

Per `rules/architecture.md § 1-3`: `src/theme.tsx` stays the single theming seam
(context provider — interface layer); token resolution (base + override merge +
NO_COLOR read) lives inside the provider's existing `useMemo` — components stay
branch-free consumers of `useTheoTheme()` (degrade is DATA); the hljs class→bucket
table remains module-local in code-block.tsx (render-side mapping, not theme API).
No external I/O (a `process.env` read at provider-mount is configuration, not I/O).

## Prior Art & Related Work

- **Internal blueprint:** `knowledge-base/discoveries/blueprints/m6-theme-robustness-blueprint.md` —
  ADRs D1–D7 consumed verbatim (§ ADRs restates condensed); Corners 1–4 carry the evidence.
- **Patterns skills:** (none exist).
- **Reference projects** (key anchors):
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/semantic-tokens.ts:9-43` — semantic slot taxonomy (naming source).
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts:143-148,316-319` — explicit-base merge + NO_COLOR theme swap.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/no-color.ts:10-29` — all-empty-string degrade theme.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/dark/ansi-dark.ts:10-28` + `builtin/light/ansi-light.ts` — named-ANSI-16 built-in class (light palette seed).
  - `knowledge-base/references/ink-ui/source/theme.tsx:53-61` — extendTheme(base, …) explicit-base + provider pass-through.
  - `knowledge-base/references/gemini-cli/packages/cli/test-setup.ts:17-47` — one-pinned-level suite strategy.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.test.ts:117-126` — in-process NO_COLOR swap unit test shape.
  - Installed chain (empirical): chalk 5.6.2 vendored supports-color — NO_COLOR read nowhere; FORCE_COLOR is a floor; `TERM=dumb + FORCE_COLOR=N` → exactly N.
- **External literature:** none beyond the above.

## Objective

- [ ] `TheoTheme` hosts `name`, `accent`, `code.*` (7), `toolStatus.*` (4×{glyph,color}) with frozen byte-identical defaults; `TheoThemeOverride` grows optional groups (source-compatible)
- [ ] Provider accepts `override | "dark" | "light" | "no-color" | {base, override}`; base is explicit; nested reset semantics kept; value memoized + referentially stable
- [ ] NO_COLOR (non-empty env) resolves to the no-color built-in — implemented by US, proven by an in-process swap test AND the subprocess probe
- [ ] STATUS_VISUALS / HLJS_COLOR_MAP / ACCENT_COLOR ×2 migrated to tokens with ZERO snapshot churn (byte-identical criterion)
- [ ] Composer cursor visibly rendered under the no-color theme (the level-0 invisibility defect fixed)
- [ ] Degrade matrix green: 3 spawns (NO_COLOR / TERM=dumb / bare-pipe) of the ALL-primitives fixture; theme-invariance test over the primitives; downsample canary
- [ ] Snapshot budget respected: ≤ 3 new snapshots (1 light composite + slack)
- [ ] 6-bench regression re-run recorded (M6 vs M5 numbers, no regression beyond run-to-run variance) + no-new-bench justification in the log
- [ ] All gates green locally and in CI (node 20 + 22); coverage ≥ 90% on `src/**` (critical paths 100% lines)

## Dependencies

> Contract for `/deps-audit`. **Zero new dependencies** (Blueprint Corner 2): the
> installed ink→chalk chain already does level detection + deterministic downsampling;
> ink-ui (the library analog) adds zero color libs; gemini's one declared color lib
> (`color-convert`) has no import in its src (verified absence).

### Existing — use as-is

| Package | Version | Ecosystem | Why |
|---|---|---|---|
| `ink` | `^5.2.0` | npm | Box/Text + the chalk color pipeline (level detection, downsampling — Rule 9 boundary) |
| `ink-spinner` | `^5.0.0` | npm | running-status spinner (color becomes `toolStatus.running.color`) |
| `parse-diff` | `^0.12.0` | npm | (unchanged) |
| `react` | `^18.0.0 \|\| ^19.0.0` (peer) | npm | component model |
| `lowlight` | `^3.0.0` (optional peer) | npm | (unchanged — CodeBlock colors move to `code.*` tokens) |

### New — to be introduced

| Package | Version | Ecosystem | Rule 9 rationale (libs evaluated) | Why this one |
|---|---|---|---|---|
| (none) | — | — | Evaluated per Blueprint Corner 2: direct `supports-color` (rejected — chalk's VENDORED copy is what ink consults; a direct dep could diverge on NO_COLOR semantics); `color-convert`/`colorette`/`picocolors` (rejected — chalk already converts); perceptual ANSI mapper à la codex (rejected — reimplements chalk's downsampling); deepmerge (rejected — our leaf-merge extended to the new groups is ~20 lines; ink-ui's deepmerge array-concat is a documented foot-gun) | Theme = plain frozen objects; NO_COLOR = one env read + one built-in |

### Removed

| Package | Last version | Why removed |
|---|---|---|
| (none) | | |

## ADRs

> D1–D7 originate in the blueprint (Blueprint §"ADRs" carries the evidence); restated
> condensed and self-contained. D8 is plan-local.

### D1 — TheoTheme grows semantic groups hosting 100% of the debt; attributes stay OUT

**Decision:** `TheoTheme` gains `name: string`, `accent: string`,
`code: { keyword, builtin, number, string, regexp, comment, variable }` (all string),
`toolStatus: { pending, running, success, failed } → { glyph: string, color: string }`.
`defaultTheme` (the `dark` built-in) freezes values IDENTICAL to today's constants:
accent `"cyan"`; code buckets = the current HLJS_COLOR_MAP colors (keyword/literal/
symbol/name→`"blue"`→`keyword`; built_in/type/attr/attribute→`"cyan"`→`builtin`;
number/class→`"green"`→`number`; string/meta-string→`"yellow"`→`string`;
regexp/template-tag→`"red"`→`regexp`; comment/quote→`"gray"`→`comment`;
variable/template-variable→`"magenta"`→`variable`); toolStatus = today's
STATUS_VISUALS (pending `{glyph:"o", color:"gray"}`, running `{glyph:"", color:
"yellow"}` — spinner glyph is ink-spinner's, running.glyph unused by ToolCall but
kept "" for shape uniformity? NO — see Deep Dive T1.1: running carries NO glyph slot;
toolStatus.running is `{color}` only... resolved: uniform `{glyph, color}` with
running.glyph = `"⠿"` NEVER rendered (ink-spinner animates instead) is FORBIDDEN
fabrication — instead `toolStatus.running` omits `glyph` at the TYPE level:
`{ pending: GlyphToken; running: { color }; success: GlyphToken; failed: GlyphToken }`
where `GlyphToken = { glyph, color }`. dim/bold/italic/inverse stay component-level
Ink props (never tokens). `role.*`/`status.*` unchanged. `diff.*` deferred (YAGNI
until bg tints).

**Rationale:** Q3's migration table hosts 100% of the color/glyph debt with zero
stragglers; gemini derives its hljs map from the palette the same way; attributes are
the channel that SURVIVES color loss (gemini declares then DROPS them — a bug class
we avoid by exclusion).

**Alternatives considered:** ink-ui open component prop-bags (rejected: loses the
closed typed contract); per-hljs-class tokens (rejected: 40 API slots for 7 values);
dim-as-gray-token (rejected: destroys the color-independent affordance under
NO_COLOR).

**Consequences:** structural value tests per group; token-usage-chart gains
`useTheoTheme`; both ACCENT_COLOR constants + sync comments delete.

### D2 — Theme selection: backward-compatible union prop with an EXPLICIT base

**Decision:**

```ts
export type TheoBuiltinThemeName = "dark" | "light" | "no-color";
theme?: TheoThemeOverride
      | TheoBuiltinThemeName
      | { base?: TheoBuiltinThemeName; override?: TheoThemeOverride }
```

Resolution inside the EXISTING single `useMemo`: resolve base (default `"dark"`) →
leaf-merge override per group (the M0 merge extended to the new groups) → result
carries `name` = base name (or `"custom"` when an override is present). Nested
providers keep RESET semantics (reset target = own resolved base). Built-ins are
frozen module constants (referential stability free when un-overridden). Union
discrimination: `typeof theme === "string"` → name; `"base" in theme || "override" in
theme` → pair; else → M0 override (degenerate `base: "dark"` — byte-identical
behavior).

**Rationale:** EC-1 — both analogs make the base explicit (gemini merges customs onto
DEFAULT_THEME regardless of active; ink-ui's extendTheme takes base as an argument);
every existing consumer call compiles and behaves identically.

**Alternatives considered:** theme-manager singleton (rejected: global mutable state —
gemini needs `resetForTesting`); public `extendTheme` export (rejected: provider
already merges — YAGNI); deepmerge dep (rejected: array-concat foot-gun + Rule 9
table).

**Consequences:** entry exports `TheoBuiltinThemeName` + `themes` (frozen
name→TheoTheme map); `TheoTheme` output type grows (CHANGELOG-declared).

### D3 — Built-ins: dark (≡ default), light, no-color — NAMED ANSI-16 values only

**Decision:** `themes.dark` ≡ today's defaultTheme values (byte-identical anchor);
`themes.light` — named-ANSI-16 palette tuned for light terminals (role prefixes/
accent/code buckets re-picked from the non-bright range where bright-on-white is
illegible; seeded from gemini ansi-light slot choices; exact values locked in T1.2's
table); `themes["no-color"]` — every COLOR slot `""` (Ink renders unstyled), glyphs
preserved, `name: "no-color"`. Built-ins never use hex; consumer overrides MAY use
hex (chalk downsamples deterministically — canary-guarded).

**Rationale:** EC-4 — our 21 snapshots are pure ANSI-16 and named colors are
level-independent (proven); hex built-ins would fork snapshots between local (level 1)
and GH Actions (level 3 — `GITHUB_ACTIONS` short-circuits the chain).

**Alternatives considered:** hex palettes + lockfile pin (rejected: live level-pin
divergence); per-level paired palettes (rejected: reimplements chalk — Rule 9).

**Consequences:** ONE composite snapshot under light (the ≤3 budget); the downsample
canary guards the consumer-hex path.

### D4 — NO_COLOR is implemented BY US as a theme swap, resolved in the provider memo

**Decision:** Inside the provider's `useMemo`: when `process.env["NO_COLOR"]` is
NON-EMPTY, the resolved theme is `themes["no-color"]` — overriding any `theme` prop
(the spec's intent: user's environment wins). The read happens once per
mount/prop-change (never per frame); components stay branch-free (degrade is DATA —
empty color strings render unstyled). The vitest pin `NO_COLOR: ""` (empty) resolves
to "not set" — pinned by a provider test.

**Rationale:** The decisive Q2 finding: the installed chain contains ZERO NO_COLOR
handling (grep-verified; our earlier vitest comment was true only vacuously) — the
DoD promise is false without this. gemini's per-call read (their pattern) would add
per-frame work; the memo read is the library-shaped equivalent.

**Alternatives considered:** relying on chalk (rejected: chalk never reads NO_COLOR);
per-component env branches (rejected: degrade-as-data needs zero render branches);
module-scope read (rejected: untestable in-process — the memo read is testable via
`vi.stubEnv` + fresh mount, gemini's swap-test shape).

**Consequences:** the NO_COLOR probe scene now tests OUR code end-to-end; an
in-process swap unit test complements it.

### D5 — Value-preserving migration: byte-identical default as an acceptance criterion

**Decision:** T2.1-T2.3 preserve every default VALUE; "the dark theme renders
byte-identical to M0-M5 output" is a stated acceptance criterion — expected snapshot
churn = 0 of 21; ANY snapshot diff during migration is a regression finding, never
`--update` noise. Deliberate visual changes are OUT of these tasks (the light palette
is a NEW theme, not a default retune).

**Rationale:** Q3's churn analysis + the M4 drift-budget lesson; the invariance test
(D6) enforces the property continuously.

**Alternatives considered:** migrate + retune in one motion (rejected: un-reviewable).

**Consequences:** migration tasks are snapshot-stable by contract.

### D6 — Test strategy: probe matrix (3 spawns, one fixture), invariance test, ≤ 3 new snapshots

**Decision:** (1) The probe fixture gains the MISSING primitives (ChatComposer
focused + CodeBlock) — it then mounts ALL primitives; (2) a dedicated
`tests/degrade-matrix.integration.test.tsx` runs THREE spawns of that fixture:
`NO_COLOR=1` (the existing assertion block MOVES here verbatim + gains composer/
code-block asserts), `TERM=dumb` (same assertion set; PLUS byte-equality with the
NO_COLOR output), bare-pipe (NO color env at all — proves pipe detection; asserts
color-absence + content, NOT control-sequence-free bytes; `CI` set deliberately per
scene — `CI=""` counts as in-CI); each spawn carries BOTH timeout layers + minimal
env (house rule; suite spawn budget 6→10 — EC-3); (3) theme-invariance test:
`stripAnsi(light frame) === stripAnsi(dark frame)` AND
`stripAnsi(no-color frame) === stripAnsi(dark frame)` looped over a representative
scene of the primitives (in-process — theme swaps need no subprocess); (4) built-in
structural value tests (gemini idiom) + provider resolution tests (name / base+
override / plain override ≡ M0 / NO_COLOR wins / empty-NO_COLOR ignored / nested
reset / referential stability); (5) ONE composite light snapshot (anchored first —
hard convention); (6) the downsample canary (subprocess at TERM=dumb+FORCE_COLOR=2
— the deterministic pin recipe); (7) composer cursor fallback tests in T3.1.

**Rationale:** Corner 1 — both analogs pin one level and test themes as data; the
cartesian (~144 snapshots) is avoided by construction; in-process env stubbing for
LEVELS is vacuous (chalk freezes at import) — levels ⇒ subprocess, themes ⇒
in-process.

**Alternatives considered:** per-primitive probe fixtures (rejected: spawn budget);
full snapshot matrix (rejected: drift maintenance kills the suite).

**Consequences:** the NO_COLOR test relocates out of `src/chat-message.test.tsx`
(bytes/assertions preserved); suite ends ≤ 24 snapshots.

### D7 — Evidence: no new bench (recorded justification) + full 6-bench regression re-run

**Decision:** No new bench. The implementation log records: (a) the justification —
M6 adds zero per-frame work (token reads are the SAME memoized `useContext` as
M0-M5; merge cost sits in the provider memo, off the render path); (b) a full
`pnpm bench` re-run table (6 benches, M6 vs the M5 recorded numbers, mean ± std dev)
— bar: no bench regresses beyond its recorded run-to-run variance. Flip condition:
if ANY per-render computation lands, re-run `metrics-footer.bench.tsx`
themed-vs-default as a light bench.

**Rationale:** A themed-vs-default bench would measure the same `useContext` on both
sides — reporting ±noise as "theming cost" is benchmark theatre; the migration
touches every component's render path, so the regression re-run is the honest guard
with real numbers.

**Alternatives considered:** theme-switch micro-bench (rejected: one merge per user
action — no N to scale).

**Consequences:** M5 baselines stay the comparison anchor; the log carries the table.

### D8 — Composer cursor degrade: theme-driven visible marker (plan-local)

**Decision:** `ChatComposer` fixes the one real degrade DEFECT found (cursor =
`<Text inverse>` — invisible at level 0 where chalk strips ALL attributes): when the
resolved theme is the no-color built-in (`theme.name === "no-color"` — degrade as
DATA, no env read in the component), the focused cursor renders a visible marker
`▏` (U+258F, left one-eighth block — same EAW class as the accepted `█`/`░`)
INSERTED at the cursor position (before `atCursor`; replaces the inverse styling);
the empty-placeholder cursor cell renders `▏` likewise. Colored-mode bytes are
UNCHANGED (inverse as today). Width in no-color mode shifts by +1 — acceptable: the
degraded rendering is explicitly a different byte stream, and the probe asserts the
marker's presence.

**Rationale:** Attribute-based fixes (underline/bold) die at level 0 with inverse;
a glyph is the only surviving channel (Q2: level 0 collapses the ENTIRE visual
channel); `theme.name` keeps components branch-free on env (the D4 seam); no analog
precedent exists (gemini's composer has the same latent bug) — internal design
recorded as internal precedent.

**Alternatives considered:** always-visible marker in all modes (rejected: changes
M0-M5 colored bytes + snapshot churn); env read in the component (rejected:
degrade-as-data); doing nothing (rejected: DoD-2 says EVERY primitive renders
degraded — an invisible cursor fails "renders").

**Consequences:** composer unit tests render under `theme="no-color"` in-process;
the probe gains an EMPTY focused composer + marker assert (NO_COLOR scene only —
under TERM=dumb/bare-pipe the dark theme resolves and the cursor stays invisible:
documented Drawback, EC-1; level-0 detection via the transitive chalk is the
recorded deferred alternative).

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| `TheoTheme` output-type growth breaks consumers who hand-built full themes | Medium | CHANGELOG-declared type growth; `{...defaultTheme, …}` spread survival path documented in JSDoc; no runtime break | implement |
| Byte-identical migration silently violated (a missed default value) → snapshot churn drowns regressions | Medium | D5 criterion + the invariance test + 21 existing snapshots act as the oracle: ANY diff fails the task | implement |
| Union-prop discrimination misclassifies an override object containing a `base` key (consumer had a custom key named `base`) | Low | `TheoThemeOverride` has only `role`/`status` (+ new groups) — `base` was never a valid override key; typecheck rejects it; runtime guard throws a typed error on unknown top-level keys in the pair form | implement |
| NO_COLOR-wins semantics surprises an app that WANTS to force color despite user env | Low | Documented (spec intent: user env wins); escape hatch recorded as a future `respectNoColor={false}` prop if demanded (YAGNI now) | implement |
| TERM=dumb vs NO_COLOR byte-equality assert couples two degrade paths that could legitimately diverge later | Low | The equality assert is a DOCUMENTED invariant while both paths render unstyled text; if a future feature diverges them, the assert is updated with rationale (it is one line) | implement |
| Light-palette legibility is subjective (no light terminal in CI) | Low | Values seeded from gemini ansi-light (shipped to production); composite snapshot pins the choice; M7+ feedback loop can retune (a NEW theme tweak, not a default change) | implement |
| Composer cursor stays invisible under TERM=dumb/bare-pipe with a colored theme (the `▏` marker is no-color-theme-scoped — EC-1) | Low | Honest scope: the cursor is an INTERACTIVE affordance — meaningless in non-interactive pipes; TERM=dumb interactive terminals are rare and NO_COLOR is the standard opt-out; extending detection to chalk level 0 would require declaring the transitive chalk (phantom dep) — deferred with rationale in D8 | implement |
| pending-glyph color decouples from `role.system.prefix` (T2.1): consumers who recolored the system role ALSO recolored the pending glyph — after migration they theme `toolStatus.pending.color` instead (EC-8) | Low | Byte-identical for defaults; the behavior change gets an explicit CHANGELOG `Changed` line + JSDoc note on the token | implement |
| NO_COLOR support requires mounting the provider — provider-less primitive usage on a color TTY ignores NO_COLOR (EC-10) | Low | Documented in provider/useTheoTheme JSDoc + CHANGELOG; hook-level env fallback rejected (per-call env read) | implement |

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D7 + plan D8.)

## Critical paths

For `/code-quality` D4 when enabled: `src/theme.tsx` (resolution: union discrimination
+ base merge + NO_COLOR swap + name derivation).

## Dependency Graph

```
Phase 1 (theme core: tokens + built-ins + provider) ──▶ Phase 2 (constant→token migration ×3) ──▶ Phase 3 (composer degrade fix + degrade matrix)
                                                                                                        │
                                                                                                        ▼
                                                                                              Final Phase (integration validation + 6-bench re-run)
```

Sequential — one vertical slice; the matrix validates everything upstream.

---

## Phase 1: Theme core

**Objective:** The grown token system, three built-ins and the finalized provider —
everything downstream consumes only this.

### T1.1 — TheoTheme growth: new token groups + byte-identical frozen defaults

#### Objective
`TheoTheme`/`TheoThemeOverride`/`defaultTheme`/`mergeTheme` grow `name`, `accent`,
`code.*`, `toolStatus.*` — values identical to today's module constants.

#### Why this step (action + reasoning)

1. **What:** RED structural tests (group presence, exact default values matching the
   current constants, frozen-ness, override merge per new group) then the type/data
   growth in `src/theme.tsx`.
2. **Why now:** Every migration task consumes these slots; pure data + types = the
   fastest loop.

#### Evidence
- Slot taxonomy naming: `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/semantic-tokens.ts:9-43`.
- Values to preserve: `src/tool-call.tsx:36-38` (STATUS_VISUALS), `src/code-block.tsx:33-52` (HLJS_COLOR_MAP), `src/context-window-bar.tsx:15` (ACCENT_COLOR).

#### Files to edit
```
src/theme.test.tsx — extend: RED group/value/merge tests
src/theme.tsx      — grow TheoTheme/TheoThemeOverride/defaultTheme/mergeTheme
CHANGELOG.md       — Added entry
```

#### Deep Dives
- `toolStatus` type: `{ pending: GlyphToken; running: { color: string }; success:
  GlyphToken; failed: GlyphToken }` with `GlyphToken = { glyph: string; color:
  string }` — running has NO glyph slot (ink-spinner animates; a never-rendered
  token would be fabricated API — D1).
- `defaultTheme.name = "dark"`; `accent = "cyan"`; code buckets per the D1 table;
  toolStatus values = today's STATUS_VISUALS colors resolved to their literal values
  (`pending.color = "gray"` — today aliased via role.system.prefix; the LITERAL is
  what byte-identity requires).
- `mergeTheme` extended: leaf-level spread per new group (`code`, `toolStatus.pending`
  etc. — same two-level discipline as role/status); `name` becomes `"custom"` when
  any override group is present (an override changes the theme identity).
- All new groups `Object.freeze`d (M0 discipline).

#### Tasks
1. RED (8 tests below) — fails (fields absent)
2. GREEN growth
3. CHANGELOG

#### TDD
```
RED:     default_theme_carries_new_groups_with_todays_values() — const t = defaultTheme; expect(t.name).toBe("dark"); expect(t.accent).toBe("cyan"); expect(t.code.keyword).toBe("blue"); expect(t.code.builtin).toBe("cyan"); expect(t.code.number).toBe("green"); expect(t.code.string).toBe("yellow"); expect(t.code.regexp).toBe("red"); expect(t.code.comment).toBe("gray"); expect(t.code.variable).toBe("magenta")
RED:     default_tool_status_matches_current_visuals() — expect(defaultTheme.toolStatus.pending).toEqual({ glyph: "o", color: "gray" }); expect(defaultTheme.toolStatus.success).toEqual({ glyph: "✓", color: "green" }); expect(defaultTheme.toolStatus.failed).toEqual({ glyph: "x", color: "red" }); expect(defaultTheme.toolStatus.running).toEqual({ color: "yellow" })
RED:     new_groups_are_frozen() — expect(Object.isFrozen(defaultTheme.code)).toBe(true); expect(Object.isFrozen(defaultTheme.toolStatus)).toBe(true); expect(Object.isFrozen(defaultTheme.toolStatus.pending)).toBe(true)
RED:     override_merges_accent_leaf() — render provider with theme={{ accent: "magenta" }} capturing useTheoTheme via probe component; expect(captured.accent).toBe("magenta"); expect(captured.code.keyword).toBe("blue") (siblings preserved)
RED:     override_merges_code_group_leaf() — theme={{ code: { string: "cyan" } }}; expect(captured.code.string).toBe("cyan"); expect(captured.code.keyword).toBe("blue")
RED:     override_merges_tool_status_leaf() — theme={{ toolStatus: { failed: { glyph: "✗" } } }}; expect(captured.toolStatus.failed.glyph).toBe("✗"); expect(captured.toolStatus.failed.color).toBe("red") (leaf sibling preserved)
RED:     override_marks_theme_name_custom() — theme={{ accent: "magenta" }}; expect(captured.name).toBe("custom")
RED:     m0_override_calls_unchanged() — theme={{ role: { user: { glyph: "$ " } }, status: { error: "redBright" } }}; expect(captured.role.user.glyph).toBe("$ "); expect(captured.status.error).toBe("redBright"); expect(captured.role.assistant.glyph).toBe("✦ ") (the M0 contract intact)
GREEN:   Grow theme.tsx until all pass
REFACTOR: Keep mergeTheme one function; extract group-merge helper only if complexity > 10
VERIFY:  pnpm vitest run src/theme.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/theme.test.tsx` exits 0 (8 new tests + existing)
- [ ] `pnpm test` fully green — NO snapshot changed (type/data growth only)
- [ ] `pnpm typecheck` + `pnpm lint` exit 0
- [ ] CHANGELOG updated — `grep -q "toolStatus" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T1.2 — Built-ins (dark/light/no-color) + provider union prop + NO_COLOR swap

#### Objective
`themes` map + `TheoBuiltinThemeName` + provider resolution (name / base+override /
M0-override / NO_COLOR wins) per D2/D3/D4; entry exports; export-surface pins.

#### Why this step (action + reasoning)

1. **What:** RED provider-resolution suite (each union arm, NO_COLOR precedence,
   empty-NO_COLOR ignored, nested reset, stability, typed error on unknown pair
   keys) + light/no-color structural value tests; then the built-ins + resolution.
2. **Why now:** DoD-1's "≥ 2 built-ins + provider finalized" and DoD-2's NO_COLOR
   promise land here; the matrix (T3.2) validates it end-to-end.

#### Evidence
- Explicit base: `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts:143-148`, `knowledge-base/references/ink-ui/source/theme.tsx:59-61`.
- NO_COLOR swap + all-empty theme: `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts:316-319`, `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/no-color.ts:10-29`.
- Light palette seed: `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/light/ansi-light.ts`.
- In-process swap test shape: `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.test.ts:117-126`.

#### Files to edit
```
src/theme.test.tsx — extend: RED resolution suite
src/theme.tsx      — themes map (dark ≡ defaultTheme, light, no-color) + union resolution + NO_COLOR read in the memo
src/index.ts       — export themes + TheoBuiltinThemeName type
tests/export-surface.test.ts — extend: themes/TheoBuiltinThemeName present; internals absent unchanged
CHANGELOG.md       — Added entry
```

#### Deep Dives
- Light palette (locked here; named ANSI-16 only): role.user.prefix `"blue"`,
  role.assistant.prefix `"magenta"`, role.system.prefix `"gray"`, text slots
  undefined (terminal default); status `{error: "red", success: "green", warning:
  "yellow"}` (universal); accent `"blue"` (cyan-on-white is illegible — gemini
  ansi-light uses blue-family accents); code: keyword `"blue"`, builtin `"cyan"`→
  `"blue"`? NO — locked: builtin `"magenta"`, number `"green"`, string `"yellow"`→
  illegible on white → `"blue"`? — RESOLUTION: light.code = { keyword: "blue",
  builtin: "magenta", number: "green", string: "red", regexp: "magenta", comment:
  "gray", variable: "blue" } (bright-yellow/cyan avoided — the two white-terminal
  failures gemini's ansi-light also avoids); toolStatus colors unchanged
  (green/red/yellow/gray are bg-neutral).
- `themes["no-color"]`: every color slot `""`; glyphs preserved; `name: "no-color"`.
  Empty-string color renders unstyled in Ink (gemini-verified mechanism).
- Resolution order in the memo: (0) type guard — `theme` must be undefined, a string
  or a PLAIN object (null/number/array → TypeError `TheoTUIProvider: theme must be a
  built-in name or an override object` — EC-5); (1) NO_COLOR non-empty →
  `themes["no-color"]` (prop ignored ENTIRELY — including glyph overrides: full-swap
  semantics, documented + CHANGELOG note, EC-7); (2) string → `themes[name]` (unknown
  name → TypeError `TheoTUIProvider: unknown theme "X"`); (3) pair → resolve base
  (default dark) + merge override (unknown top-level keys → TypeError); `name` stays
  the BASE name when the override is absent/empty — `"custom"` only when a non-empty
  override is present (form-based — EC-6); (4) plain object → M0 path (base dark;
  empty object ≡ no override → name "dark").
- Referential stability: un-overridden name selection returns the frozen singleton
  (`captured1 === captured2` across rerenders AND `=== themes.dark`).

#### Tasks
1. RED (13 tests below)
2. GREEN built-ins + resolution
3. Exports + surface pins + CHANGELOG

#### TDD
```
RED:     selects_builtin_by_name() — provider theme="light"; expect(captured.name).toBe("light"); expect(captured.accent).toBe("blue")
RED:     light_theme_is_named_ansi16_only() — const values = collectColorStrings(themes.light); for each v: expect(v).not.toMatch(/^#/) (no hex in built-ins — D3)
RED:     no_color_theme_zeroes_colors_keeps_glyphs() — const nc = themes["no-color"]; expect(nc.status.error).toBe(""); expect(nc.accent).toBe(""); expect(nc.toolStatus.success.glyph).toBe("✓"); expect(nc.role.user.glyph).toBe("> "); expect(nc.name).toBe("no-color")
RED:     pair_form_merges_onto_named_base() — theme={{ base: "light", override: { accent: "magenta" } }}; expect(captured.accent).toBe("magenta"); expect(captured.role.user.prefix).toBe(themes.light.role.user.prefix); expect(captured.name).toBe("custom")
RED:     plain_override_still_merges_onto_dark() — theme={{ accent: "magenta" }}; expect(captured.code.keyword).toBe("blue") (M0 degenerate case — base dark)
RED:     no_color_env_wins_over_prop() — vi.stubEnv("NO_COLOR", "1"); fresh provider theme="light"; expect(captured.name).toBe("no-color"); vi.unstubAllEnvs() (in-process — the swap is theme-layer, gemini test shape)
RED:     empty_no_color_env_is_not_set() — vi.stubEnv("NO_COLOR", ""); provider theme="light"; expect(captured.name).toBe("light") (the vitest pin contract — D4)
RED:     unknown_theme_name_throws_typed() — expect(() => renderProvider("solarized")).toThrow(TypeError); expect(() => renderProvider("solarized")).toThrow('unknown theme')
RED:     unknown_pair_key_throws_typed() — theme={{ base: "dark", extra: 1 }} direct render; expect TypeError naming "extra"
RED:     invalid_theme_values_throw_our_typed_error() — for bad of [null, 42, []]: expect(() => renderProvider(bad)).toThrow(TypeError); expect message contains "TheoTUIProvider: theme must be" (never the engine's bare in-operator error; arrays NOT silently accepted — EC-5)
RED:     degenerate_forms_pin_name_semantics() — theme={{}} → captured.name === "dark"; theme={{ base: "light" }} (no override) → name "light" AND captured === themes.light (referential); theme={{ base: "light", override: {} }} → same; theme={{ accent: "cyan" }} (override equal to default) → name "custom" (form-based identity — EC-6)
RED:     no_color_swap_discards_all_overrides_including_glyphs() — vi.stubEnv("NO_COLOR", "1"); fresh provider theme={{ role: { user: { glyph: "$ " } } }}; expect(captured.role.user.glyph).toBe("> ") (full swap — glyphs revert to the tested-readable defaults; documented, EC-7); vi.unstubAllEnvs()
RED:     builtin_selection_is_referentially_stable() — two captures across a rerender with theme="dark"; expect(first).toBe(second); expect(first).toBe(themes.dark)
GREEN:   Implement built-ins + resolution until all pass
REFACTOR: Extract resolveTheme(theme, env) pure helper (unit-testable; the memo calls it)
VERIFY:  pnpm vitest run src/theme.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/theme.test.tsx` exits 0 (13 new tests)
- [ ] `pnpm vitest run tests/export-surface.test.ts` exits 0 (themes + name type pinned)
- [ ] NO snapshot changed
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/theme.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 2: Constant→token migration (byte-identical)

**Objective:** Delete the three parked constants; every default byte unchanged —
the 21 existing snapshots are the oracle.

### T2.1 — STATUS_VISUALS → theme.toolStatus (+ agent-streaming spinner color)

#### Objective
`tool-call.tsx` consumes `theme.toolStatus.*`; `agent-streaming.tsx` spinner color
consumes `theme.toolStatus.running.color`; STATUS_VISUALS deleted.

#### Why this step (action + reasoning)

1. **What:** RED — an override test proving the tokens drive the render (custom
   failed glyph/color visible) + byte-identity guard (existing suites untouched);
   then the swap.
2. **Why now:** First consumer proves the toolStatus group end-to-end.

#### Evidence
- Current map: `src/tool-call.tsx:28-60`; spinner: `src/agent-streaming.tsx` (status.warning site).

#### Files to edit
```
src/tool-call.test.tsx — extend: token-driven override test
src/tool-call.tsx      — consume theme.toolStatus; delete STATUS_VISUALS
src/agent-streaming.tsx — spinner color = theme.toolStatus.running.color
src/agent-streaming.test.tsx — extend: override test
CHANGELOG.md — Changed entry
```

#### Deep Dives
- `failed.bold` stays a component attribute (D1 — attributes out of tokens).
- The pending color literal `"gray"` replaces the `role.system.prefix` alias — the
  VALUE is identical (byte-identity); the alias coupling dissolves (a pending glyph
  should not change when someone themes the system role). CONSUMER-VISIBLE behavior
  change for the recolored-system-role override pattern → explicit CHANGELOG
  `Changed` line + JSDoc note (EC-8).
- Byte-identity oracle: the full existing tool-call + agent-streaming + probe suites
  pass UNCHANGED (zero snapshot diffs).

#### Tasks
1. RED (2 tests below)
2. GREEN swap
3. CHANGELOG

#### TDD
```
RED:     tool_status_tokens_drive_render() — provider theme={{ toolStatus: { failed: { glyph: "✗", color: "magenta" } } }} around <ToolCall name="t" status="failed"/>; const plain = stripAnsi(frame); expect(plain).toContain("✗"); expect(frame).toContain("[35m")
RED:     spinner_color_follows_running_token() — provider theme={{ toolStatus: { running: { color: "cyan" } } }} around <AgentStreaming/>; expect(frame).toContain("[36m")
GREEN:   Swap to tokens; delete STATUS_VISUALS
REFACTOR: None expected
VERIFY:  pnpm vitest run src/tool-call.test.tsx src/agent-streaming.test.tsx && pnpm test (zero snapshot diffs)
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Both suites exit 0; `pnpm test` green with ZERO snapshot changes (D5)
- [ ] `grep -c STATUS_VISUALS src/tool-call.tsx` outputs 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.2 — HLJS_COLOR_MAP → theme.code.* buckets

#### Objective
`code-block.tsx` maps hljs classes → bucket names (module-local table) → colors from
`theme.code.*`; HLJS_COLOR_MAP deleted.

#### Why this step (action + reasoning)

1. **What:** RED — override test (custom `code.string` color visible in a highlighted
   frame) + byte-identity guard; then the swap (highlightLine/renderHast gain the
   theme's code group as a parameter — the component passes it; pure signature grows,
   no ink import added).
2. **Why now:** The most intricate migration (per-line highlight path).

#### Evidence
- Current map: `src/code-block.tsx:31-52`; gemini derives the map from the palette
  (`knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:439-574`).

#### Files to edit
```
src/code-block.test.tsx — extend: token-driven override test
src/code-block.tsx      — class→bucket table + theme.code consumption; delete HLJS_COLOR_MAP
CHANGELOG.md — Changed entry
```

#### Deep Dives
- Module-local `HLJS_CLASS_TO_BUCKET: Record<string, keyof TheoTheme["code"]>` (18
  entries, same classes); `highlightLine(line, language, highlighter, key, codeColors)`
  — the render call site passes `theme.code`; ladder tests update their direct calls
  (signature grows — the ladder stub tests pass `defaultTheme.code`).
- Byte-identity: same classes → same buckets → same colors ⇒ identical frames; the
  ≤2 highlighted snapshots must NOT change.

#### Tasks
1. RED (1 test below)
2. GREEN swap
3. CHANGELOG

#### TDD
```
RED:     code_tokens_drive_highlight_colors() — await ensureHighlighter(); provider theme={{ code: { string: "magenta" } }} around <CodeBlock code={'const s = "x";'} language="typescript"/>; expect(frame).toContain("[35m") (string literal renders with the overridden bucket color)
GREEN:   Swap to theme.code; delete HLJS_COLOR_MAP
REFACTOR: Keep the bucket table module-local (render-side mapping — D1)
VERIFY:  pnpm vitest run src/code-block.test.tsx src/code-block-absent.test.tsx && pnpm test (zero snapshot diffs)
```

#### Concurrency tests

(none — single-threaded) — the loader promise unchanged.

#### Acceptance Criteria
- [ ] Suites exit 0; `pnpm test` green with ZERO snapshot changes
- [ ] `grep -c HLJS_COLOR_MAP src/code-block.tsx` outputs 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.3 — ACCENT_COLOR ×2 → theme.accent

#### Objective
Gauge + chart consume `theme.accent`; both constants + sync comments deleted; the
chart gains its missing `useTheoTheme()`.

#### Why this step (action + reasoning)

1. **What:** RED — accent override visible in both components; then the swap.
2. **Why now:** Completes the migration register; kills the ×2 duplication.

#### Evidence
- `src/context-window-bar.tsx:9-15`, `src/token-usage-chart.tsx:6-8` (the sync-comment pair).

#### Files to edit
```
src/context-window-bar.test.tsx — extend: accent override test
src/token-usage-chart.test.tsx  — extend: accent override test
src/context-window-bar.tsx     — theme.accent; delete constant
src/token-usage-chart.tsx      — useTheoTheme + theme.accent; delete constant
CHANGELOG.md — Changed entry
```

#### Deep Dives
- Chart rows keep dim label/value styling (attributes — untouched); only the filled
  run color moves to `theme.accent`.
- Byte-identity: accent default stays `"cyan"` ⇒ `[36m` bytes unchanged.

#### Tasks
1. RED (2 tests below)
2. GREEN swap
3. CHANGELOG

#### TDD
```
RED:     gauge_accent_follows_token() — provider theme={{ accent: "magenta" }} around <ContextWindowBar usedTokens={10_000} limitTokens={128_000} width={40}/>; expect(frame).toContain("[35m") (sub-warning fill uses the token)
RED:     chart_accent_follows_token() — provider theme={{ accent: "magenta" }} around <TokenUsageChart usage={{ input: 100 }}/>; expect(frame).toContain("[35m")
GREEN:   Swap both; delete constants
REFACTOR: None expected
VERIFY:  pnpm vitest run src/context-window-bar.test.tsx src/token-usage-chart.test.tsx && pnpm test (zero snapshot diffs)
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suites exit 0; `pnpm test` green with ZERO snapshot changes
- [ ] `grep -rc ACCENT_COLOR src/ | grep -v ":0"` outputs nothing

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 3: Robustness + degrade matrix

**Objective:** The composer defect fixed and the full DoD-2/DoD-3 evidence landed.

### T3.1 — Composer visible-cursor fallback under the no-color theme

#### Objective
`ChatComposer` renders a `▏` cursor marker when `theme.name === "no-color"` (D8);
colored-mode bytes unchanged.

#### Why this step (action + reasoning)

1. **What:** RED — in-process tests under `theme="no-color"`: marker present at the
   cursor position (empty + non-empty text), colored mode unchanged (existing suite);
   then the fix.
2. **Why now:** The one real degrade DEFECT — DoD-2's "every primitive renders
   (degraded)" is false while the cursor is invisible.

#### Evidence
- Defect site: `src/chat-composer.tsx:190-207` (`<Text inverse>` cursor + inverse
  placeholder cell); Q2 evidence: level 0 strips ALL attributes.

#### Files to edit
```
src/chat-composer.test.tsx — extend: no-color cursor tests
src/chat-composer.tsx      — theme.name-driven marker
CHANGELOG.md — Fixed entry
```

#### Deep Dives
- Marker `▏` inserted BEFORE `atCursor` when `theme.name === "no-color" && isFocused`;
  the placeholder-branch cursor cell becomes `▏` under the same condition; inverse
  styling retained otherwise (identical colored bytes).
- The component already consumes `useTheoTheme()` — reading `name` adds no hook.

#### Tasks
1. RED (3 tests below)
2. GREEN fix
3. CHANGELOG

#### TDD
```
RED:     no_color_focused_cursor_shows_marker() — provider theme="no-color" around a focused composer; type "hi" via the existing stdin typing harness (src/chat-composer.test.tsx idiom — NO initialText prop exists, EC-4); const plain = frame; expect(plain).toContain("▏") (frame is already unstyled under the no-color theme)
RED:     no_color_placeholder_cursor_visible() — provider theme="no-color", empty composer focused with placeholder "type…"; expect(frame).toContain("▏"); expect(frame).toContain("type…")
RED:     colored_mode_bytes_unchanged() — default provider focused composer; expect(frame).not.toContain("▏") (marker is no-color-only; the existing inverse assertions + suite stay green)
GREEN:   Implement the theme.name-driven marker
REFACTOR: None expected
VERIFY:  pnpm vitest run src/chat-composer.test.tsx && pnpm test (zero snapshot diffs)
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suite exits 0; `pnpm test` green with ZERO snapshot changes
- [ ] Pass: quality — `pnpm lint` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T3.2 — Degrade matrix + invariance test + light composite + canary + example

#### Objective
The full DoD-2/DoD-3 evidence: 3-spawn probe matrix, theme-invariance test, ONE light
composite snapshot, downsample canary, `examples/themes.tsx` + smoke.

#### Why this step (action + reasoning)

1. **What:** RED — the new `tests/degrade-matrix.integration.test.tsx` (3 spawn
   tests + equality invariant), invariance test, light scene snapshot (anchored),
   canary, example smoke; fixture gains composer + code-block; the NO_COLOR block
   MOVES from `src/chat-message.test.tsx` (assertions preserved verbatim + new
   marker/code asserts); then wiring.
2. **Why now:** Validates every upstream task end-to-end; closes DoD-2/DoD-3.

#### Evidence
- One-fixture-multi-scene: `tests/fixtures/no-color-probe.tsx` lineage; deterministic
  pin recipe + `CI=""`-counts-as-CI hazard: blueprint Corner 2/Q2 (empirical).

#### Files to edit
```
tests/degrade-matrix.integration.test.tsx — (NEW) 3 spawns + equality + canary
tests/fixtures/no-color-probe.tsx — extend: ChatComposer (focused) + CodeBlock scenes
src/chat-message.test.tsx — REMOVE the probe test (moved; forced-color canary test stays)
tests/public-api.integration.test.tsx — extend: invariance test + light composite snapshot
examples/themes.tsx — (NEW) same scene under dark then light (static, piped-clean)
tests/example-themes.integration.test.ts — (NEW) subprocess smoke
package.json — "example:themes" script
CHANGELOG.md — Added entry
```

#### Deep Dives
- Probe fixture additions (EC-2/EC-4/EC-9 amended): the WHOLE scene wraps in
  `<TheoTUIProvider>` — without it `useTheoTheme` returns the static defaultTheme and
  the NO_COLOR swap NEVER executes in the probe (the vacuous-coverage trap D4 exists
  to kill; the `▏` marker is the only-our-swap-can-produce oracle); composer joins as
  the EMPTY focused + placeholder shape (the marker renders with zero typing — typed
  text would need stdin writes whose ~50ms settle breaks the 0ms-tick spinner
  determinism; the mid-text `▏` oracle lives in-process in T3.1); `CodeBlock` joins
  with TEXT-ONLY asserts (lowlight resolves in the subprocess — the plain frame is a
  load race, NOT the absent path; `code-block-absent.test.tsx` remains the absent
  oracle).
- Scene envs: NO_COLOR `{PATH, HOME, NO_COLOR: "1"}` (existing); dumb
  `{PATH, HOME, TERM: "dumb"}`; bare-pipe `{PATH, HOME}` (nothing — the pipe itself
  forces level 0; `CI` NOT set — ink-testing-library's debug mode in the fixture
  bypasses the is-in-ci branch, and the probe writes lastFrame explicitly).
- Equality invariant (EC-1 amended): the NO_COLOR scene carries the composer `▏`
  marker (our theme swap) while the dumb/bare-pipe scenes resolve the DARK theme at
  chalk level 0 (no marker) — byte equality is asserted AFTER normalizing the marker:
  `expect(outDumb).toBe(outNoColor.replaceAll("▏", ""))`-shaped comparison (exact
  normalization locked in the test with a comment); the marker itself is asserted
  ONLY in the NO_COLOR scene.
- Invariance test (in-process): a representative scene (message + tool card + gauge
  + code block plain — NO focused composer: its `▏` marker is a DELIBERATE no-color
  layout delta, EC-1) rendered under dark vs light vs no-color; expect
  stripAnsi-equality pairwise (layout/text never change with theme).
- Canary: spawn `node -e` with `TERM=dumb FORCE_COLOR=2` printing
  `chalk.hex("#ff8800")("x")` via the INSTALLED chalk (resolve from ink's tree);
  expect stdout contains `38;5;214` (the deterministic pin recipe — immune to GH
  Actions).
- Example: static two-theme showcase; smoke asserts both theme names' distinctive
  bytes (e.g. `[36m` dark accent vs `[34m` light accent) + exit 0.

#### Tasks
1. RED (7 tests below)
2. GREEN fixture + scenes + example
3. CHANGELOG

#### TDD
```
RED:     no_color_scene_degrades_readably() — spawn the PROVIDER-WRAPPED fixture (EC-2) with NO_COLOR=1; ALL existing assertion lines preserved verbatim (glyphs, stderr label, diff signs, fold indicator, █/░, % left, ~$) PLUS expect(out).toContain("▏") (composer marker — T3.1 end-to-end) and expect(out).toContain("const scene") (code block); expect(out).not.toContain("[")
RED:     term_dumb_scene_matches_no_color_bytes_modulo_marker() — spawn with TERM=dumb; run the same core asserts (MINUS the `▏` marker — dark theme at level 0, no marker by design); const normalized = outNoColor.replaceAll("▏", ""); const same = outDumb === normalized; expect(same).toBe(true) (EC-1 normalized invariant)
RED:     bare_pipe_degrades_without_env() — spawn with minimal env only; expect(out).not.toContain("["); expect(out).toContain("plain text probe") (pipe detection proves itself)
RED:     theme_swap_preserves_text_layout() — in-process: for themeName of ["light", "no-color"]: const themed = stripAnsi(await renderScene(themeName)); const dark = stripAnsi(await renderScene("dark")); expect(themed).toBe(dark) (theming changes ONLY color bytes)
RED:     light_composite_scene_matches_snapshot() — scene under theme="light" in <Box width={60}>; anchor first: expect(frame).toContain("[34m") (light accent blue) and stripAnsi content anchors; then toMatchSnapshot("light-theme-scene") (the ONE new composite — ≤3 budget)
RED:     chalk_downsample_canary() — spawn node -e with TERM=dumb FORCE_COLOR=2 printing installed-chalk hex("#ff8800")("x"); expect(out).toContain("38;5;214") (deterministic pin recipe)
RED:     themes_example_renders_both_palettes() — execFileSync tsx examples/themes.tsx (timeout 30000, minimal env + FORCE_COLOR=1); expect(out).toContain("[36m"); expect(out).toContain("[34m"); exit 0
GREEN:   Wire fixture + scenes + example
REFACTOR: None expected
VERIFY:  pnpm vitest run tests/degrade-matrix.integration.test.tsx tests/public-api.integration.test.tsx tests/example-themes.integration.test.ts
```

#### Concurrency tests

(none — single-threaded) — spawns are sequential.

#### Acceptance Criteria
- [ ] All suites exit 0; snapshots stable across two consecutive `pnpm test` runs
- [ ] Total NEW snapshots ≤ 3 (`git diff --stat` on `__snapshots__` shows only additions within budget)
- [ ] Subprocess spawn count ≤ 10 suite-wide (3 probe + 1 canary + 6 example smokes: agent/chat/code/metrics/tools + NEW themes — EC-3 corrected arithmetic)
- [ ] `pnpm example:themes | cat` exits 0 with both palettes

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | Theme system: tokens + adaptive palette (ROADMAP M6 DoD-1) | T1.1, T1.2 | Semantic growth + named-ANSI-16 built-ins (adaptive = chalk downsampling + level-independent names) |
| 2 | `TheoTUIProvider` finalized + ThemeProvider-equivalent (DoD-1) | T1.2 | Union prop (name/base+override/M0) with explicit base + memoized resolve |
| 3 | ≥ 2 built-in themes (DoD-1) | T1.2 | dark + light (+ no-color) exported as `themes` |
| 4 | NO_COLOR respected by every primitive (DoD-2) | T1.2, T3.2 | OUR theme-layer swap (the chain has none — Q2) + probe scene proving it end-to-end |
| 5 | FORCE_COLOR/TERM=dumb respected (DoD-2) | T3.2 | dumb scene + canary (FORCE_COLOR floor semantics documented; the pin recipe) |
| 6 | Non-TTY/pipe degraded render (DoD-2) | T3.2 | bare-pipe scene (color-absence + content asserts) |
| 7 | Composer cursor invisible at level 0 (DoD-2 "every primitive" — the found defect) | T3.1, T3.2 | theme.name-driven `▏` marker + probe assert |
| 8 | Snapshot matrix primitive × levels (DoD-3) | T3.2 | Diagonal = existing 21; light composite; invariance test = off-diagonal; probe matrix = level rows |
| 9 | Roadmap risk 1 — combinatorial surface | T3.2 | ≤ 3 new snapshots (O(primitives + levels)) |
| 10 | Roadmap risk 2 — capability edge cases | T1.2, T3.2 | Empirical precedence chain consumed; NO_COLOR-empty pin test; canary; deterministic spawn envs |
| 11 | Debt migration ACCENT/HLJS/STATUS_VISUALS (blueprint D5) | T2.1, T2.2, T2.3 | Byte-identical token swaps; constants deleted |
| 12 | Zero-churn migration criterion (blueprint D5) | T2.1, T2.2, T2.3, T3.1 | "ZERO snapshot changes" in every AC; invariance test enforces continuously |
| 13 | Performance evidence without a fake bench (blueprint D7) | T3.2 | Final-Phase 6-bench re-run table M6-vs-M5 + recorded justification (executed at Final Phase; T3.2 lands the last render-path change the re-run guards) |
| 14 | Wiring triad (`rules/cycle-implement.md`) | T1.2, T2.x, T3.2 | Components consume tokens (callers); integration scenes + example + probe (tests); bench re-run (runtime evidence) |
| 15 | CHANGELOG discipline (Rule 6) | T1.1, T1.2, T2.1, T2.2, T2.3, T3.1, T3.2 | [Unreleased] per task |
| 16 | Zero-new-deps verdict (deps-audit golden rule) | T3.2 | Rule 9 table (Dependencies §); /deps-audit PASS 2026-07-07 (0 vulns, both auditors); T3.2 is the only manifest touch (`example:themes` script) |
| 17 | Edge-case review MUST-FIX EC-1..EC-4 + SHOULD EC-5..EC-10 (review 2026-07-07) | T1.2, T2.1, T3.1, T3.2 | Absorbed: marker-normalized equality invariant, provider-wrapped fixture, spawn arithmetic ≤10, empty-focused composer shape, union-prop negatives, name-semantics pins, full-swap NO_COLOR semantics, pending-decoupling CHANGELOG line, text-only code asserts, provider-required NO_COLOR doc + 4 new Drawbacks rows |

**Coverage: 17/17 gaps covered (100%)**

## Global Definition of Done

- [ ] All phases completed
- [ ] All tests passing — `pnpm test` green (M0-M5 suites + ~33 new M6 tests)
- [ ] Zero type errors — `pnpm typecheck`; zero lint warnings — `pnpm lint`; format clean — `pnpm format:check`
- [ ] Build green — `pnpm build` produces `dist/index.js` + `dist/index.d.ts`
- [ ] Coverage ≥ 90% on `src/**` — `pnpm test:coverage` exits 0 (critical paths § above: 100% lines)
- [ ] File-size budget — `wc -l` <= 500 per changed source file
- [ ] CHANGELOG `[Unreleased]` updated per task (Rule 6; the TheoTheme type growth declared)
- [ ] Backward compatibility — every M0-M5 `theme={...}` call site compiles + behaves identically (T1.1 `m0_override_calls_unchanged` + zero snapshot churn are the proof)
- [ ] **Snapshot budget** — ≤ 3 new snapshots; ZERO existing snapshots changed
- [ ] **Bench regression evidence** — full `pnpm bench` re-run committed (6 baselines refreshed on a quiet machine); no bench regresses beyond run-to-run variance vs the M5 numbers; the comparison table + no-new-bench justification in the implementation log
- [ ] CI green on develop (node 20 + 22, 7 steps) — NOTE: GitHub Actions billing-blocked (human action pending); all steps mirrored locally until resolved
- [ ] **Plan archived** — after `/review` READY_TO_MERGE AND the release PR merges, move to `knowledge-base/plans/completed/`

## Failure scenarios (when I/O external)

(none — no external I/O touched; `process.env` reads at provider-mount are
configuration, and the subprocess spawns are test harness, not product I/O)

## Final Phase: Integration Validation (MANDATORY)

**Objective:** Prove the M6 surface as a composed workload + the regression evidence.

### Execution

```
pnpm gates                    # format:check → lint → typecheck → test → build
pnpm test:coverage            # >= 90% src/**
pnpm bench                    # full run on a QUIET machine (load < ~9) — all six baselines refreshed; commit diffs; record the M6-vs-M5 comparison table in the implementation log (D7)
pnpm example:themes | cat     # non-TTY smoke
pnpm vitest run               # second consecutive full run (stability)
```

### Acceptance Criteria

- [ ] `pnpm gates` exits 0; `pnpm test:coverage` exits 0
- [ ] Two consecutive `pnpm vitest run` green
- [ ] `pnpm example:themes | cat` exits 0 with both palettes
- [ ] All committed baselines pinned-env + self-consistent; M6-vs-M5 table shows no regression beyond run-to-run variance (else investigate before completion — D7 flip condition)
- [ ] Failure scenarios — skipped ("(none — no external I/O touched)")

### If Validation Fails

1. All failures are plan-caused — fix before declaring complete; re-run the chain
2. Document environment quirks in the PR description
