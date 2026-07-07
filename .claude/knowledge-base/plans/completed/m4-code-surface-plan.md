---
slug: m4-code-surface
milestone_id: M4
created_at: 2026-07-06
goal: Ship the M4 code surface (DiffViewer unified renderer with parse-diff model, maxLines+contextLines bounding and typed failure semantics; CodeBlock with lowlight as an optional peer and plain-text degrade) with all gates green in CI and a committed diff-viewer benchmark baseline.
---

# Plan: M4 Code surface — DiffViewer + CodeBlock

> **Version 1.0** — Implements `ROADMAP.md § M4` on top of M3: `DiffViewer` (unified-only —
> split is a VERIFIED ABSENCE in every terminal analog, deferred with rationale; patch-text
> input parsed by `parse-diff`; +/- sign gutter as the NO_COLOR mechanism; wrap-never-
> truncate; `maxLines` cap + `contextLines` folding; typed malformed-patch error; binary
> row), `CodeBlock` (lowlight OPTIONAL peer via dynamic import + `ensureHighlighter()`;
> per-line highlight with the gemini fallback ladder; explicit `language` only), the test
> kit the analogs lack (malformed/binary negatives, text-invariance highlight oracle,
> module-absent test, width invariants) and the growing-diff benchmark with committed
> baseline. All design decisions locked by the m4-code-surface blueprint (SHIPPABLE 98.3).

## Goal

Enable TypeScript agent-CLI developers to render unified diffs and syntax-highlighted code
blocks from the built `@theokit/tui` package — including large diffs bounded by
maxLines/contextLines and graceful plain-text degrade without the optional highlighter —
measured by the CI gate chain (format → lint → typecheck → test → coverage → build → bench
smoke) exiting 0 on `develop`.

## Context

M0-M3 shipped chat, tool and agent surfaces. `ROADMAP.md § M4` requires code-rendering
primitives: DiffViewer (unified/split, +/- coloring, NO_COLOR degrade) and CodeBlock with
opt-in syntax highlight; wide lines (wrap/truncate) + large diffs (windowing); snapshots
added/removed/context + highlight on/off. Risks: (1) highlight dep weight/ESM interop —
resolved: lowlight optional peer, sync engine, ESM-native, dynamic import with plain
degrade (Blueprint §"D2"); (2) diff layout at narrow widths — resolved: wrap-never-truncate
+ pinned gutter + width-invariant tests (Blueprint §"D4"/§"D8"). Split view: verified
absence in all analogs → unified-only with recorded deferral (Blueprint §"D3"). The
DISCOVER cycle produced a SHIPPABLE blueprint (98.3) locking nine ADRs.

## Baseline Context (deep review of current state)

### Files that will be touched

| File | LoC today | Last commit (sha) | Why it exists today | Invariants to preserve |
|---|---|---|---|---|
| `src/index.ts` | 40 | `c6207e3` | Composition root | Existing exports unchanged; `VERSION === package.json.version` |
| `src/diff-model.ts` (NEW) | 0 | — | parse-diff wrapper + typed model + fold/cap math (pure) | — |
| `src/diff-model.test.ts` (NEW) | 0 | — | parser-layer exact-equality tests | — |
| `src/diff-viewer.tsx` (NEW) | 0 | — | unified renderer | — |
| `src/diff-viewer.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `src/code-block.tsx` (NEW) | 0 | — | CodeBlock + highlighter loader + hast→Text | — |
| `src/code-block.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `src/code-block-absent.test.tsx` (NEW) | 0 | — | module-absent suite (isolated vi.mock file) | — |
| `tests/export-surface.test.ts` | 86 | `c6207e3` | public-entry contract | grows; manifest test gains parse-diff in dependencies + lowlight optional peer |
| `tests/public-api.integration.test.tsx` | ~200 | `eb611f9` | integration via composition root | grows: diff + code scene |
| `tests/fixtures/no-color-probe.tsx` | ~55 | `eb611f9` | NO_COLOR subprocess probe | gains a diff scene (`/^\+ /m`, `/^- /m`) |
| `src/chat-message.test.tsx` | ~185 | `eb611f9` | NO_COLOR assertions | extends: diff sign asserts |
| `benchmarks/diff-viewer.bench.tsx` (NEW) | 0 | — | M4 benchmark | — |
| `docs/benchmarks/m4-diff-viewer-baseline.json` (NEW) | 0 | — | committed baseline | M0-M3 baselines refreshed only at Final Phase (policy) |
| `tests/bench-baseline.test.ts` | 326 | `eb611f9` | baseline schema oracles | gains M4 block (M3-parity: mode matrix + finiteness + recomputes + workload asserts) |
| `examples/code.tsx` (NEW) | 0 | — | diff+code demo (TTFATT caller) | existing examples untouched |
| `tests/example-code.integration.test.ts` (NEW) | 0 | — | subprocess smoke (timeout + minimal env) | — |
| `package.json` | 75 | `83a12d5` | manifest | + `parse-diff` dependency; + `lowlight` optional peer; + `example:code` script |
| `CHANGELOG.md` | — | `eb611f9` | M3 entries under Unreleased | every task appends |

### Current callers / dependents

- **No existing production symbol is modified.** New symbols gain first callers inside this
  plan: `examples/code.tsx`, `benchmarks/diff-viewer.bench.tsx`, integration/probe tests.
- **Symbols consumed (additive):** `useTheoTheme` (`src/theme.tsx` — status.success/error,
  role.system.prefix); the M2 truncation IDIOM (indicator wording style) informs D5 copy
  but no code is shared (diff bounding works on the parsed model, not strings).
- **Manifest contract test impact:** `tests/export-surface.test.ts:56-59` asserts
  `dependencies === ["ink", "ink-spinner"]` — T1.1 updates it to include `parse-diff` and
  adds the optional-peer assertion (`peerDependencies` gains `lowlight`;
  `peerDependenciesMeta.lowlight.optional === true`; react peer unchanged).
- External: v0.2.0+M2+M3 public API — M4 is purely additive.

### Domain glossary

- **parsed diff model** — `DiffFile { oldName?, newName?, lines, additions, deletions }`
  with `DiffLine { kind: "add" | "del" | "context", oldLine?, newLine?, text }` — produced
  by `parseUnifiedDiff` (parse-diff wrapper), consumed by the renderer and exported for
  M7/later split renderers.
- **sign column** — unconditional `+`/`-`/` ` gutter char; THE color-independent (NO_COLOR)
  mechanism (verified in gemini).
- **fold** — a run of unchanged context collapsed to `--- N lines hidden ---` when
  `contextLines` is set (react-ink `foldContext` shape).
- **cap** — `maxLines` slice with `… (+N more lines)` trailer (react-ink `DiffContent`
  shape).
- **optional highlighter** — lowlight loaded via module-scope cached dynamic `import()`;
  absent → plain text forever + one debug hint; `ensureHighlighter()` (exported-internal)
  lets tests await readiness deterministically.
- **fallback ladder** — per-line: unloaded/unknown-language/highlight-throw → raw line;
  whole-block catch → plain block (gemini CodeColorizer contract).
- **indicator wording (EC-24)** — three coexisting truncation strings are INTENTIONAL
  provenance: M2 `… +N lines hidden` (stream tail), M4 cap `… (+N more lines)` (document
  head, react-ink), fold `--- N lines hidden ---` (react-ink) — unification is an M6
  theming/copy candidate.

### Architecture boundaries affected

Per `rules/architecture.md § 1-3`: `src/diff-model.ts` is PURE (no ink import — parser +
fold/cap math unit-testable and reusable); `src/diff-viewer.tsx` and `src/code-block.tsx`
are interface-layer consuming theme via `useTheoTheme()` only (DIP); the lowlight seam is
isolated inside `code-block.tsx` (module-scope loader — the only dynamic-import site);
`src/index.ts` remains the only public surface. No external I/O (dynamic import of an
installed module is module resolution, not I/O — the absent path is a first-class state).

## Prior Art & Related Work

- **Internal blueprint:** `knowledge-base/discoveries/blueprints/m4-code-surface-blueprint.md` —
  ADRs D1–D9 consumed verbatim (§ ADRs restates condensed); Corners 1–4 carry the evidence.
- **Patterns skills:** (none exist).
- **Reference projects** (key anchors):
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/types.ts:1-28` — line/file model.
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/diff-utils.ts:10-149` — parse normalization (CRLF, no-newline) + foldContext.
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/DiffContent.tsx:44-72` — maxLines trailer.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx:24-94,231-235,312-386` — hand-parser cautionary tale; tabs; sign/gutter/wrap anatomy.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:28-113,179-213,247-298` — lowlight pipeline + fallback ladder + line numbers.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:439-574` — hljs→semantic bucketing table (palette source).
  - `knowledge-base/references/assistant-ui/packages/react-ink-markdown/src/useShikiHighlighter.ts:13-111` — optional-peer dynamic-import degrade pattern.
  - `knowledge-base/references/codex/codex-rs/tui/src/diff_render.rs:23-32,594-605,894-960` — wrap contract, `⋮` hunk gaps, per-hunk highlight rationale.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.test.tsx:16,51-63,299-332` — spy decoupling + width/height matrix idioms.
- **External literature:** none beyond the above.

## Objective

- [ ] `parseUnifiedDiff` produces the typed multi-file model (CRLF stripped, `\ No newline` suppressed, renames, binary = zero-chunk file) with typed malformed-patch error
- [ ] `DiffViewer` renders unified diffs: sign column, line numbers, header (names + rename arrow + stats), `⋮` hunk gaps, wrap-never-truncate, `maxLines` + `contextLines` bounding
- [ ] `CodeBlock` renders plain immediately and highlighted once lowlight loads; module absent → plain forever + one debug hint; explicit `language` only
- [ ] Roadmap snapshots exist: added/removed/context lines; highlight on/off (text-invariance oracle + ≤ 2 colored highlight snapshots)
- [ ] NO_COLOR probe proves `+`/`-` signs readable without color
- [ ] `benchmarks/diff-viewer.bench.tsx` baseline committed (windowed|full matrix, ≥ 3 runs, pinned env, peak headline)
- [ ] All gates green locally and in CI (node 20 + 22); coverage ≥ 90% on `src/**` (critical paths 100% lines)

## Dependencies

> Contract for `/deps-audit`. One new tiny hard dep + one optional peer (Blueprint §"D1"/§"D2").

### Existing — use as-is

| Package | Version | Ecosystem | Why |
|---|---|---|---|
| `ink` | `^5.2.0` | npm | Box/Text primitives |
| `ink-spinner` | `^5.0.0` | npm | (unchanged — not used by M4) |
| `react` | `^18.0.0 \|\| ^19.0.0` (peer) | npm | component model |

### New — to be introduced

| Package | Version | Ecosystem | Rule 9 rationale (libs evaluated) | Why this one |
|---|---|---|---|---|
| `parse-diff` | `^0.12.0` | npm (dependency) | Evaluated: hand-rolled ~50-line hunk parser (rejected — gemini's shipped real bugs: duplicated parse, silent line drops, single-file assumption; CLAUDE.md Rule 9 anti-pattern list literally includes parsers for spec'd formats); jsdiff `parsePatch` (rejected — heavier, we don't need diff COMPUTATION) | The library analog (react-ink) ships it; tiny (~zero transitive deps expected — /deps-audit verifies); handles CRLF/no-newline/renames/multi-file |
| `lowlight` | `^3.0.0` | npm (OPTIONAL peerDependency + devDependency for tests) | Evaluated: cli-highlight (rejected — ZERO adoption in all 7 reference clones, ANSI-string output clashes with `<Text color>`); shiki (rejected at M4 — async createHighlighter → plain-then-pop + WASM weight; Ink precedent exists but shows the complexity price); hand-rolled (rejected — grammars with a spec) | Production-proven in Ink by gemini (sync API, deterministic first paint); ESM-native; `common` grammar bundle bounded. OPT-IN: consumers without it get plain text |

### Removed

| Package | Last version | Why removed |
|---|---|---|
| (none) | | |

## ADRs

> D1–D9 originate in the blueprint (Blueprint §"ADRs" carries the evidence); restated
> condensed and self-contained. D10 is plan-local.

### D1 — DiffViewer input: `patch: string` parsed by `parse-diff`; exported multi-file model

**Decision:** `DiffViewer({ patch, showLineNumbers = true, maxLines?, contextLines? })`
consumes unified-diff TEXT. `src/diff-model.ts` (PURE) wraps parse-diff into
`DiffFile[]`/`DiffLine` (kinds `add | del | context`; `oldLine?/newLine?`; per-file
`oldName?/newName?/additions/deletions`), strips CRLF, suppresses `\ No newline` markers,
maps `/dev/null` to absent names. Model + parser exported from the entry (M7 adapters,
future split renderer). Old/new-pair input and intra-line emphasis DEFERRED (no jsdiff).

**Rationale:** Every agent upstream emits patch text; hand-parsing is the gemini cautionary
tale + Rule 9 anti-pattern; react-ink (library analog) ships parse-diff.

**Alternatives considered:** hand-rolled parser (rejected: evidence of shipped bugs);
dual patch/old-new now (rejected: YAGNI); codex FileChange enum (rejected: M7 adapter
concern).

**Consequences:** One tiny hard dep; parsed model is the seam for later split/old-new.

**Edge-case addenda (EC-1/7/20/21/22):** parse-diff is LENIENT — trailing garbage after a
valid file is DROPPED (accepted + documented in the JSDoc; pinned by test — detecting
partial-parse reliably is not possible with the lenient parser, honesty over theater).
Model `text` PRESERVES tabs (`\t` — render layers expand); the typed parse error is
prefixed `parseUnifiedDiff:` (the parser is a standalone public export — naming DiffViewer
in its error would mislead M7 consumers; DiffViewer propagates it as-is). Windows-style
backslash paths and octal-quoted unicode filenames pass through verbatim (pinned).

### D2 — CodeBlock highlight: lowlight OPTIONAL peer, cached dynamic import, plain degrade, explicit language

**Decision:** `package.json`: `peerDependencies.lowlight: "^3"` +
`peerDependenciesMeta.lowlight.optional: true` (+ lowlight as devDependency so OUR tests
exercise the loaded path). `src/code-block.tsx` holds a module-scope
`let highlighterPromise` — first CodeBlock mount triggers `import("lowlight")`,
`createLowlight(common)` cached; `ensureHighlighter()` exported-internal (tests await it;
NOT on the public entry). Module absent → catch → permanent plain + ONE `console.warn`
naming the peer and install command (never a throw, never fully silent). `language` prop
EXPLICIT; unknown/unregistered language → plain (NO highlightAuto — determinism).

**Rationale:** The only verified shipping opt-in pattern (react-ink-markdown); lowlight is
the Ink-proven SYNC engine; cli-highlight has zero adoption (verified absence).

**Alternatives considered:** cli-highlight / shiki / hard dep (all rejected — blueprint
D2 evidence); silent catch (rejected: fail-clear).

**Consequences:** deps-audit checks lowlight@3 + parse-diff registry facts; module-absent
is a tested first-class state (D8).

### D3 — Unified-only at M4; split deferred with recorded absence

**Decision:** DiffViewer renders unified only. Split view is DEFERRED (post-M4, gated on
demand); the parse/render separation (exported model) keeps a split renderer additive.
The CHANGELOG entry and this ADR record the position explicitly.

**Rationale:** VERIFIED ABSENCE of split in every terminal analog (repo-wide greps
recorded in the blueprint); split halves content columns exactly where analogs fight for
width; the ecosystem escalates to richer surfaces instead (gemini→IDE, codex→pager).

**Alternatives considered:** building split from first principles (rejected: zero prior
art at the weakest surface).

**Consequences:** ROADMAP DoD's "unified/split" is satisfied by an explicit, evidenced
position.

### D4 — Render anatomy: wrap-never-truncate; pinned gutter; fg-only colors; unconditional sign column

**Decision:** Diff lines `wrap="wrap"` (content), gutter Box (line number + sign)
`flexShrink={0}`; tabs→spaces (tabWidth 4) before render; add lines `theme.status.success`
fg, del lines `theme.status.error` fg, context default; sign `+`/`-`/` ` rendered
UNCONDITIONALLY; single line-number column (del→oldLine, else newLine (add) / oldLine
(context)), right-aligned dim, `showLineNumbers` default true; hunk gaps = dim `⋮` row;
header per file: `oldName → newName` (rename) or single name + `+N` green / `-M` red
stats.

**Rationale:** Unanimous wrap contract (three analogs); sign column is the verified
NO_COLOR mechanism; fg-only matches our theme tokens (bg tints = M6).

**Alternatives considered:** horizontal truncation (rejected: no analog); bg tints now
(rejected: theme lacks bg tokens).

**Consequences:** M6 may add bg tint tokens; wrapped continuations inherit Ink flex under
the pinned gutter.

### D5 — Bounding: `maxLines` cap + `contextLines` folding, opt-in, on LOGICAL lines

**Decision:** `contextLines?: number` (≥ 0) folds unchanged runs beyond ±contextLines
around changes into ONE dim `--- N lines hidden ---` row per run (pure `foldDiffLines` in
diff-model.ts); `maxLines?: number` (integer ≥ 1) then slices the RENDERED rows and
appends dim `… (+N more lines)`; both `undefined` = unbounded; invalid values → TypeError
at the boundary (before hooks — F10 idiom): maxLines mirrors the M2 truncateLines guard
message shape; contextLines requires integer ≥ 0.

**Rationale:** The two orthogonal bounding axes from evidence; logical-line bounding is
deterministic; agent diffs have long context runs.

**Alternatives considered:** visual-row MaxSizedBox cap (deferred: measurement machinery —
M6); no bounding (rejected: roadmap "large diffs").

**Consequences:** Bench modes: windowed = maxLines+contextLines; full = neither.

**Edge-case addenda (EC-3/4/5/10, review 2026-07-06):** the cap is GLOBAL across files and
counts EVERY rendered row (headers, fold rows, degenerate rows included) — predictable
budget; retention is HEAD (first rows survive, trailer at the bottom — react-ink shape;
the file header must never be capped away). ORDER: fold first, then cap; the trailer's N
counts post-fold rendered rows dropped; a fold row SUPPRESSES the `⋮` gap for that jump.
Runs of ≤ 1 hidden context line are NOT folded (a `--- 1 lines hidden ---` row saves
nothing). Retention-direction rule of thumb recorded: streams truncate TAIL-retained (M2
ToolResult — recent output wins); documents truncate HEAD-retained (DiffViewer/CodeBlock —
the beginning is the anchor).

### D6 — CodeBlock anatomy: per-line highlight, hast→Text inheritance, module-local palette, 4-level fallback

**Decision:** `CodeBlock({ code, language?, showLineNumbers = false, maxLines? })` —
per-LINE lowlight (`highlight(language, line)` only when registered); hast→Text mapping:
color inherited down, `<Text>` at leaves only, Fragments for elements, empty root → raw
line; per-line try/catch → raw line; outer catch → whole-block plain; module-local
`HLJS_COLOR_MAP` (~10 buckets from gemini's bucketing table → ink named colors: keyword/
literal→blue, built_in/type→cyan, number/class→green, string→yellow, regexp→red,
comment/quote→gray, variable→magenta, default→undefined) documented as an M6 theming
candidate; `maxLines` reuses the M2-style tail cap on code lines (integer ≥ 1 guard);
line numbers optional, dim, hidden-count-aware padding. DiffViewer does NOT highlight at
M4 (codex compute-cap warning; gemini spy-decoupling precedent).

**Rationale:** The only Ink production colorizer, ported; per-line enables cheap
truncation + future streaming; NO_COLOR needs zero branches (chalk level 0 renders named
colors unstyled — all our components already rely on this).

**Alternatives considered:** whole-block highlight (rejected: kills line fallbacks);
theme-token indirection now (rejected: theme has no code tokens — M6; M2 glyph precedent).

**Consequences:** M6 replaces the palette with tokens; a DiffViewer `highlight` prop is
deferred.

**Edge-case addenda (EC-5/7/14/15/16/25/26):** CodeBlock cap retention is HEAD (documents
rule — D5 addenda); tabs expand to 4 spaces at render (model-free component — input string
is the model); input is `stripAnsi`'d before highlighting AND rendering (gemini parity —
agent output embeds escapes; pinned by test); `ensureHighlighter()` is single-flight (one
module-scope promise — identity-pinned); unmount before the promise resolves must not
setState (mounted guard; console.error spy test); language change after load rerenders
with identical stripAnsi text; whitespace-only code renders one (whitespace) row.

### D7 — Failure semantics: typed malformed-patch error; explicit degenerate rows

**Decision:** Non-empty, non-whitespace `patch` parsing to ZERO files →
`TypeError: parseUnifiedDiff: patch did not parse as a unified diff` (thrown by the model — EC-20 — propagated unchanged by DiffViewer; boundary, before hooks).
Empty/whitespace patch → dim `(no changes)` row. File with zero chunks → dim
`binary or metadata change` row (with its header). `\ No newline` suppressed; CRLF
stripped (model layer).

**Rationale:** codex fails SILENT on unparsable patches — `rules/error-handling.md § 2`
forbids that; empty diff is a VALID agent outcome (friendly state, not error); binary is
unhandled by ALL analogs (we close the gap).

**Alternatives considered:** silent empty render (rejected: swallowed error); throwing on
empty (rejected: valid outcome).

**Consequences:** Negative tests the references lack become ours (D8).

### D8 — Test strategy: text-invariance; ≤2 highlighted snapshots; module-absent suite; width invariant

**Decision:** (1) Roadmap snapshots via `renderFrame` in `<Box width={60}>` paired with
line-anchored stripAnsi oracles (`/^\+ /m` etc.); (2) highlight on/off primary oracle =
TEXT INVARIANCE (`stripAnsi(highlighted) === stripAnsi(plain)`), ≤ 2 colored highlighted
snapshots total (drift budget; deps-audit pins exact dev version); (3) highlighted tests
`await ensureHighlighter()` BEFORE renderFrame (deterministic); (4) module-absent suite in
a SEPARATE test file (`vi.mock("lowlight", …throw ERR_MODULE_NOT_FOUND)`) asserting plain
render + the one-time warn + no crash; (5) width matrix {60,30,20} with the mechanical
invariant `every stripAnsi(line).length <= W`; (6) parser-layer exact-equality tests
(CRLF, no-newline, blank add/del, multi-file, rename, binary zero-chunk, malformed);
(7) NO_COLOR probe diff scene (`/^\+ /m`, `/^- /m`, fold/cap indicators); (8) invalid
maxLines/contextLines typed negatives.

**Rationale:** Corner 1 evidence + our kit conventions + the gaps both references have.

**Alternatives considered:** gemini's SVG snapshot matcher (rejected: new harness
machinery).

**Consequences:** `ensureHighlighter` exported from code-block.tsx (module-level), NOT
re-exported from the entry (export-surface asserts absence — D7/EC-10 precedent).

**Edge-case addenda (EC-6/13/19):** the module-absent suite is ONE sequential test
asserting all three facts (plain render → warn exactly once across a second render →
ensureHighlighter resolves undefined) — module-scope cache + warn-once flag make separate
tests order-dependent (`testing.md § 3`); a comment pins the vitest per-file isolation
assumption for the loaded/absent pair. The width invariant (`stripAnsi length <= W`) is
honestly scoped to narrow characters (EAW-wide chars count 2 columns — comment in the
test; M6 may adopt string-width). The NO_COLOR probe diff scene asserts the fold indicator
(`lines hidden`) in addition to signs.

### D9 — Bench: growing multi-hunk diff, windowed|full matrix, wide-line hunk in append range

**Decision:** `benchmarks/diff-viewer.bench.tsx` on the M3 harness: mount = DiffViewer
with 10 hunks (30 lines each); 40 measured steps, each APPENDS one hunk to the patch
(regenerated string → new parse → rerender); a WIDE-LINE hunk (30 lines × 500 chars) at an
append-range step index with a fail-fast self-check (M3 dom-testing-1 lesson: measured
work must land INSIDE the sampled window); modes `windowed` (maxLines=80,
contextLines=2) vs `full`; NO highlight dimension (D6 — diff never highlights at M4);
EC-15 per-run stdout-frames guard; 1 warmup + 5 measured; population std dev;
`peak_ms_per_frame` headline; <1σ deltas declared inconclusive; baseline
`docs/benchmarks/m4-diff-viewer-baseline.json` with full workload block.

**Rationale:** Corner 3; windowed-vs-full is the roadmap's "large diffs" claim under test.

**Alternatives considered:** highlight on/off dimension (rejected with D6 — never bench
speculative features).

**Consequences:** Roadmap risk 2 carries real numbers in the DoD.

**Edge-case addenda (EC-17/18):** ALL 41 patch strings are PRE-GENERATED before the
measured loop (string regeneration is fixture noise; parsing stays inside the render —
that IS the component cost); the hunk template declares its line mix (10 context / 15
add / 5 del per 30-line hunk) so the fold axis is active from mount; baseline `workload`
gains `context_lines_per_hunk`; a self-check asserts windowed rendered rows < full at
mount (cap+fold active).

### D10 — diff-model.ts is the single pure home for parse + fold + cap math

**Decision:** `parseUnifiedDiff(patch)`, `foldDiffLines(lines, contextLines)` and the
row-cap arithmetic live in `src/diff-model.ts` (no ink import); `diff-viewer.tsx` only
maps model rows to Text. Exported from the entry: `parseUnifiedDiff` + the model types
(`DiffFile`, `DiffLine`, `DiffLineKind`); fold/cap helpers stay module-internal
(truncateLines/D7-M2 precedent).

**Rationale:** M1 text-buffer / M2 truncateLines precedent — pure critical-path math gets
the tight TDD loop; the exported parser is the M7 seam.

**Alternatives considered:** parsing inside the component (rejected: forces every parser
edge through render tests); exporting the fold helpers (rejected: no consumer — internal).

**Consequences:** M4+ split renderer reuses the model without touching the viewer.

**Edge-case addendum (EC-12):** DiffViewer memoizes `parseUnifiedDiff(patch)` on `[patch]`
and the folded rows on `[model, contextLines]` — same-string rerenders never reparse; the
bench measures the new-string path deliberately.

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| lowlight/highlight.js version drift breaks the ≤2 highlighted snapshots | Medium | Exact-pin the devDependency; text-invariance is the primary oracle; drift budget bounded by design (D8) | implement |
| Dynamic-import async hop: first CodeBlock frame is PLAIN, tests forgetting `ensureHighlighter()` capture it | Medium | `ensureHighlighter()` awaited in every highlighted test (D8); the plain-first behavior is DOCUMENTED (JSDoc) and pinned by its own test | implement |
| parse-diff behavior on exotic inputs (mode changes, submodules) unknown until exercised | Medium | Parser-layer exact-equality suite incl. binary/malformed; zero-chunk files render the D7 explicit row — unknown shapes degrade to that path | implement |
| Wide-line wrap inside `<Static>`-less DiffViewer could be slow for pathological single lines | Low | The M2 20k char-cap precedent NOT applied at M4 (diff lines come from real files); bench's wide-line hunk measures the real cost; M6 revisits if peak explodes | implement |
| `vi.mock`-based module-absent test simulates resolution failure, not a truly uninstalled package | Low | Documented caveat (Q4 honesty note); the catch path is identical code; subprocess variant documented as escalation if it ever proves untrustworthy | implement |

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D9 + plan D10.)

## Critical paths

For `/code-quality` D4 when enabled: `src/diff-model.ts` (parse wrapper + fold/cap math),
`src/code-block.tsx` (fallback ladder + hast mapping).

## Dependency Graph

```
Phase 1 (diff-model + DiffViewer) ──▶ Phase 2 (CodeBlock) ──▶ Phase 3 (integration + example + bench)
                                                                    │
                                                                    ▼
                                                          Final Phase (integration validation)
```

Sequential — one vertical slice; the example and bench compose both components.

---

## Phase 1: diff model + DiffViewer

**Objective:** The pure parsed model and the unified renderer, oracle-covered.

### T1.1 — diff-model.ts: parseUnifiedDiff + typed model (+ parse-diff dependency)

#### Objective
Pure parser wrapper with normalization + typed failure; `parse-diff` installed; model
types exported.

#### Why this step (action + reasoning)

1. **What:** RED parser-layer exact-equality suite (multi-file, renames, CRLF,
   no-newline, blank add/del, binary zero-chunk, malformed → TypeError, empty → []) then
   the minimal wrapper per D1/D7/D10.
2. **Why now:** Everything renders FROM this model; pure tests are the fastest loop.

#### Evidence
- Model shape + normalization: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/types.ts:1-28`,
  `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/diff-utils.ts:10-78`.
- Hand-parser cautionary tale: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx:24-94`.

#### Files to edit
```
src/diff-model.test.ts — (NEW) RED suite
src/diff-model.ts      — (NEW) parseUnifiedDiff + types + fold/cap helpers
src/index.ts           — export parseUnifiedDiff + DiffFile/DiffLine/DiffLineKind types
tests/export-surface.test.ts — extend (+ manifest: dependencies gains parse-diff)
package.json           — + parse-diff dependency
CHANGELOG.md           — Added entry
```

#### Deep file dependency analysis
- `src/diff-model.ts`: imports ONLY `parse-diff` (default export `parseDiff`). No ink, no
  react — pure module (D10).
- Manifest test update: `dependencies` sorted = `["ink", "ink-spinner", "parse-diff"]`.

#### Deep Dives
- Normalization per line: strip trailing `\r`; skip `\ No newline at end of file` marker
  lines; map parse-diff `normal|add|del` → `context|add|del`; line numbers from
  `ln1/ln2/ln` fields; names from `from/to` with `/dev/null` → undefined.
- Malformed detection: `patch.trim() !== "" && files.length === 0` → TypeError (D7).
- `foldDiffLines(lines, contextLines)` returns `(DiffLine | Fold)[]` where
  `Fold = { kind: "fold", hidden: number }` — keeps ±contextLines around every add/del
  run (react-ink foldContext arithmetic; guard: integer ≥ 0 else TypeError).
- Edge cases: empty patch → `[]`; hunk starting at line 1; file with zero chunks
  (`binary: true`-like) → `lines: []` preserved with names+stats.

#### Tasks
1. RED suite (19 tests below; `PATCH_BASIC` fixture DEFINED here — EC-23) — fails (module absent)
2. `pnpm add parse-diff` + GREEN minimal
3. Exports + manifest-test update + CHANGELOG

#### TDD
```
RED:     parses_single_hunk_with_line_numbers() — const files = parseUnifiedDiff(PATCH_BASIC); expect(files).toHaveLength(1); expect(files[0]!.lines[0]).toEqual({ kind: "context", oldLine: 1, newLine: 1, text: "line one" })
RED:     parses_add_and_del_kinds_with_counters() — expect(del).toEqual({ kind: "del", oldLine: 2, text: "old two" }); expect(add).toEqual({ kind: "add", newLine: 2, text: "new two" }); expect(files[0]!.additions).toBe(1); expect(files[0]!.deletions).toBe(1)
RED:     parses_multi_file_patch() — 2-file patch; expect(files).toHaveLength(2); expect(files[1]!.newName).toBe("b/second.ts")
RED:     maps_dev_null_to_absent_names() — new-file patch (--- /dev/null); expect(files[0]!.oldName).toBeUndefined()
RED:     detects_rename_names() — from a/old.ts to b/new.ts; expect(files[0]!.oldName).toBe("a/old.ts"); expect(files[0]!.newName).toBe("b/new.ts")
RED:     strips_crlf_from_lines() — patch with \r\n; expect(files[0]!.lines.every((l) => !l.text.includes("\r"))).toBe(true)
RED:     suppresses_no_newline_marker() — patch ending "\\ No newline at end of file"; expect(frame-model has no line containing "No newline")
RED:     preserves_blank_add_and_del_lines() — "+" and "-" with empty text; expect(add.text).toBe(""); expect(del.text).toBe("")
RED:     empty_patch_returns_empty_array() — expect(parseUnifiedDiff("")).toEqual([]); expect(parseUnifiedDiff("  \n")).toEqual([])
RED:     malformed_patch_throws_typed_error() — const call = () => parseUnifiedDiff("this is not a diff at all"); expect(call).toThrow(TypeError); expect(call).toThrow("parseUnifiedDiff: patch did not parse as a unified diff") (EC-20)
RED:     binary_file_yields_zero_lines_with_names() — git binary patch header; expect(files[0]!.lines).toHaveLength(0)
RED:     fold_keeps_context_window_and_counts_hidden() — 20 context + 1 add + 20 context, contextLines 2; folded = foldDiffLines(lines, 2); expect(folded.filter((r) => r.kind === "fold")).toHaveLength(2); expect(folded.find((r) => r.kind === "fold")!.hidden).toBe(18); expect(() => foldDiffLines(lines, -1)).toThrow(TypeError)
RED:     trailing_garbage_after_valid_file_is_pinned() — parseUnifiedDiff(PATCH_BASIC + garbage tail); expect(files).toHaveLength(1) — lenient drop, documented (EC-1)
RED:     fold_overlapping_and_small_runs_never_fold() — 1 add + 3 context + 1 add @ contextLines 2 → zero folds; 1 add + 5 context + 1 add → zero folds (run of 1 hidden NOT folded — D5 addenda); 1 add + 6 context + 1 add → one fold, hidden === 2 (EC-2/EC-10)
RED:     fold_at_file_edges_emits_no_empty_folds() — change at line 1 and at last line, contextLines 2; no leading/trailing fold when the run fits the window (EC-2)
RED:     fold_context_lines_zero_folds_all_context() — foldDiffLines(lines, 0); only add/del + folds; sum(hidden) === total context (EC-9)
RED:     preserves_tabs_in_model_text() — "+\tindented"; expect(add.text).toBe("\tindented") (EC-7)
RED:     mode_change_only_patch_yields_zero_lines() — mode headers, no hunks; lines [] + names preserved (EC-8)
RED:     windows_paths_and_quoted_unicode_names_pass_verbatim() — no throw; names verbatim (EC-21/22)
GREEN:   Implement diff-model.ts until all pass
REFACTOR: Keep pure (no ink imports)
VERIFY:  pnpm vitest run src/diff-model.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/diff-model.test.ts` exits 0 (19 tests)
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0 with 0 warnings
- [ ] `pnpm audit` exits 0 (no new HIGH/CRITICAL after parse-diff)
- [ ] CHANGELOG updated — `grep -q "parseUnifiedDiff" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T1.2 — DiffViewer unified renderer

#### Objective
`src/diff-viewer.tsx` per D4/D5/D7: header, gutter, signs, gaps, bounding, degenerate rows.

#### Why this step (action + reasoning)

1. **What:** RED render suite (sign/color rows, line numbers, header+stats, rename arrow,
   `⋮` gap, fold row, cap trailer, empty state, binary row, boundary guards, width
   invariant) then the renderer mapping model rows to Text.
2. **Why now:** The roadmap's central component; example/bench/probe consume it.

#### Evidence
- Anatomy: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/DiffView.tsx:34-119`,
  `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx:312-386`.
- Gap `⋮`: `knowledge-base/references/codex/codex-rs/tui/src/diff_render.rs:594-605`.

#### Files to edit
```
src/diff-viewer.test.tsx — (NEW) RED suite
src/diff-viewer.tsx      — (NEW) renderer
src/index.ts             — export DiffViewer (+ props type)
tests/export-surface.test.ts — extend
CHANGELOG.md             — Added entry (grouped with T1.1)
```

#### Deep Dives
- Boundary guards FIRST (before hooks — F10): parse (malformed TypeError propagates from
  the model), maxLines integer ≥ 1, contextLines integer ≥ 0.
- Row pipeline per file: header row (bold name(s), rename `old → new`, stats `+N` success
  / `-M` error) → lines through `foldDiffLines` (when contextLines set) → `⋮` dim row
  between hunks (line-number jump > 1 without fold) → cap slice (maxLines) + dim
  `… (+N more lines)` trailer.
- Line row: `<Box>` gutter Box flexShrink={0} (dim right-aligned number + sign colored) +
  `<Text wrap="wrap">` content (tabs→4 spaces); add/del rows colored fg whole-line.
- Degenerate: empty model → dim `(no changes)`; zero-chunk file → header + dim
  `binary or metadata change`.
- Edge cases: width 20 (wrap, gutter pinned); multi-file spacing.

#### Tasks
1. RED (18 tests below)
2. GREEN renderer
3. Exports + CHANGELOG

#### TDD
```
RED:     renders_add_del_context_with_signs() — const frame = await renderFrame(<DiffViewer patch={PATCH_BASIC}/>); const plain = stripAnsi(frame); expect(plain).toMatch(/^\s*\d+ \+ new two$/m); expect(plain).toMatch(/^\s*\d+ - old two$/m); expect(plain).toMatch(/^\s*\d+   line one$/m)
RED:     add_and_del_lines_carry_status_colors() — expect(frame).toContain("[32m"); expect(frame).toContain("[31m") (green add / red del under FORCE_COLOR)
RED:     header_shows_name_and_stats() — expect(plain).toContain("basic.ts"); expect(plain).toMatch(/\+1/); expect(plain).toMatch(/-1/)
RED:     rename_shows_arrow() — rename patch; expect(plain).toContain("a/old.ts → b/new.ts")
RED:     line_numbers_toggle_off() — showLineNumbers={false}; expect(plain).not.toMatch(/^\s*\d+ /m)
RED:     hunk_gap_renders_ellipsis_row() — 2-hunk patch with a jump; expect(plain).toMatch(/^\s*⋮\s*$/m)
RED:     context_lines_fold_hides_runs() — contextLines={2} over long context; expect(plain).toContain("--- 18 lines hidden ---"); expect(plain).toContain("changed line")
RED:     max_lines_caps_with_trailer() — maxLines={5} over a 30-row diff; expect(stripAnsi(frame).split("\n").length).toBeLessThanOrEqual(7); expect(plain).toContain("… (+")
RED:     empty_patch_renders_no_changes_row() — patch=""; expect(plain.trim()).toBe("(no changes)")
RED:     binary_file_renders_explicit_row() — expect(plain).toContain("binary or metadata change")
RED:     invalid_max_lines_throws_typed_error() — const call = () => DiffViewer({ patch: PATCH_BASIC, maxLines: 0 }); expect(call).toThrow(TypeError); expect(call).toThrow("maxLines must be an integer >= 1")
RED:     invalid_context_lines_throws_typed_error() — contextLines: -1 direct call; expect(call).toThrow(TypeError)
RED:     width_matrix_lines_fit() — for W of [60, 30, 20]: render in <Box width={W}>; every stripAnsi(frame).split("\n") row has length <= W (fixture includes a tab line; invariant scoped to narrow chars — D8 addenda, EC-13)
RED:     fold_then_cap_compose_deterministically() — contextLines 2 + maxLines 6; rows <= 6 + trailer; trailer N counts post-fold dropped rows; fold row present, NO ⋮ for the folded jump (EC-3)
RED:     max_lines_scope_is_global_across_files() — 2-file patch, maxLines 5; total rendered rows incl. headers <= 5 + one trailer (EC-4)
RED:     cap_retention_is_head() — maxLines 5; header + FIRST content rows present; LAST content row absent (documents rule — D5 addenda, EC-5)
RED:     tab_renders_as_four_spaces() — "+\tx"; expect(stripAnsi(frame)).toContain("    x"); expect(frame).not.toContain("\t") (EC-7)
GREEN:   Implement diff-viewer.tsx until all pass
REFACTOR: Extract row-builder helpers if complexity > 10
VERIFY:  pnpm vitest run src/diff-viewer.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/diff-viewer.test.tsx` exits 0 (18 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/diff-viewer.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 2: CodeBlock

**Objective:** Highlighted code rendering with the optional-peer degrade.

### T2.1 — CodeBlock + highlighter loader + fallback ladder

#### Objective
`src/code-block.tsx` per D2/D6; lowlight devDependency + optional peer wired.

#### Why this step (action + reasoning)

1. **What:** RED — plain-immediate render, highlighted-after-ensure (text invariance +
   ONE colored snapshot), unknown language plain, maxLines cap, line numbers, invalid
   maxLines negative; separate module-absent suite; then the component.
2. **Why now:** Completes the roadmap pair; example/bench scenes need it.

#### Evidence
- Pipeline + ladder: `knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:28-113,179-213,247-298`.
- Optional-peer pattern: `knowledge-base/references/assistant-ui/packages/react-ink-markdown/src/useShikiHighlighter.ts:13-111`.
- Palette buckets: `knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:439-574`.

#### Files to edit
```
src/code-block.test.tsx — (NEW) RED suite (loaded path)
src/code-block-absent.test.tsx — (NEW) module-absent suite (isolated vi.mock)
src/code-block.tsx      — (NEW) CodeBlock + ensureHighlighter + hast→Text
src/index.ts            — export CodeBlock (+ props type)
tests/export-surface.test.ts — extend (+ peer assertions: lowlight optional)
package.json            — + lowlight devDependency + optional peerDependency
CHANGELOG.md            — Added entry
```

#### Deep Dives
- Loader: module-scope `highlighterPromise: Promise<Lowlight | undefined> | undefined`;
  `ensureHighlighter()` starts/returns it; catch → warn once
  (`CodeBlock: optional peer "lowlight" not installed — code renders unhighlighted. pnpm add lowlight`)
  → resolves undefined. Component: `useState/useEffect` re-render when resolved.
- Render: guard maxLines (before hooks); split code lines (CRLF-safe); when highlighter
  ready AND `language` registered → per-line `highlight()` → `renderHast` (color
  inheritance, leaves only); else raw line; per-line try/catch raw; maxLines tail cap
  with dim `… (+N more lines)`; optional dim line numbers (hidden-count-aware pad).
- Edge cases: empty code (renders nothing); code with trailing newline (no phantom row —
  M2 EC-7 parity); unknown language (plain, no warn — valid state).

#### Tasks
1. RED both suites (16 + 1 tests below)
2. `pnpm add -D lowlight` + peer entries + GREEN
3. Exports + CHANGELOG

#### TDD
```
RED:     renders_plain_before_highlighter_loads() — fresh render without awaiting; expect(stripAnsi(frame)).toContain("const x = 1;")
RED:     highlight_preserves_text_exactly() — await ensureHighlighter(); const hi = await renderFrame(<CodeBlock code={SNIPPET} language="typescript"/>); const plain = await renderFrame(<CodeBlock code={SNIPPET}/>); expect(stripAnsi(hi)).toBe(stripAnsi(plain)) (D8 text invariance)
RED:     highlighted_snapshot_is_stable() — await ensureHighlighter(); 3-line ts snippet in <Box width={60}>; expect(frame).toMatchSnapshot("code-block-highlighted") (1 of ≤2 colored budget)
RED:     highlighted_frame_contains_color_bytes() — await ensureHighlighter(); expect(frame).toMatch(/\[3[0-9]m/)
RED:     unknown_language_renders_plain() — language="nope-lang"; await ensureHighlighter(); expect(frame).toBe(plain-equivalent frame)
RED:     no_language_renders_plain() — no language prop; identical to plain
RED:     max_lines_caps_code_head_retained() — 12 lines maxLines 5; expect(plain).toContain("… (+"); expect(plain).toContain("line-0"); expect(plain).not.toContain("line-11") (HEAD — documents rule, EC-5)
RED:     capped_head_line_numbers_stay_original() — 12 lines maxLines 5 showLineNumbers; expect(stripAnsi(frame)).toMatch(/^ *1 line-0/m) (EC-11)
RED:     line_numbers_render_dim_right_aligned() — showLineNumbers; expect(stripAnsi(frame)).toMatch(/^ *1 const/m)
RED:     trailing_newline_adds_no_phantom_row() — code "a\nb\n"; expect(stripAnsi(frame).split("\n")).toHaveLength(2)
RED:     empty_code_renders_nothing() — code=""; expect(frame).toBe("")
RED:     invalid_max_lines_throws_typed_error() — direct call maxLines 0; expect(call).toThrow(TypeError); expect(call).toThrow("maxLines must be an integer >= 1")
RED:     code_with_ansi_is_sanitized() — code embedding ESC[31m; stripped before highlight/render (D6 addenda, EC-16)
RED:     ensure_highlighter_is_single_flight() — expect(ensureHighlighter()).toBe(ensureHighlighter()) (EC-15)
RED:     unmount_before_load_does_not_set_state() — spy console.error; render + immediate unmount; await ensureHighlighter(); expect no error (EC-14)
RED:     language_change_after_load_keeps_text_invariant() — rerender js→python; stripAnsi identical (EC-25)
RED:     whitespace_only_code_renders_one_row() — code " "; one whitespace row (EC-26)
--- src/code-block-absent.test.tsx (isolated file, vi.mock lowlight → ERR_MODULE_NOT_FOUND; ONE sequential test — module-scope cache + warn-once make separate tests order-dependent, EC-6; comment pins vitest per-file isolation) ---
RED:     absent_module_degrades_plain_warns_once_and_resolves_undefined() — spy console.warn BEFORE first render; render → plain text visible; second render → warn called exactly once naming "lowlight"; await ensureHighlighter() → undefined (EC-6)
GREEN:   Implement code-block.tsx until all pass
REFACTOR: Extract renderHast helper; keep complexity <= 10
VERIFY:  pnpm vitest run src/code-block.test.tsx src/code-block-absent.test.tsx
```

#### Concurrency tests

(none — single-threaded) — the loader promise is awaited sequentially in tests.

#### Acceptance Criteria
- [ ] Both suites exit 0 (17 tests)
- [ ] `pnpm audit` exits 0 after lowlight devDep
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/code-block.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 3: Integration + example + bench

**Objective:** Wiring closure + evidence artifacts.

### T3.1 — Composition scene, NO_COLOR diff scene, roadmap snapshots

#### Objective
Public-entry scene (DiffViewer + CodeBlock), probe diff scene, the roadmap snapshot set.

#### Why this step (action + reasoning)

1. **What:** Integration scene via `src/index.js`; NO_COLOR probe gains a small diff
   (sign readability + fold indicator); the added/removed/context snapshot lives in the
   T1.2 suite — this task adds the composed scene snapshot; extended no_color asserts.
2. **Why now:** Wiring pillar (b) + DoD-3 in-milestone (M1 F-wire-1 lesson).

#### Evidence
- Probe conventions: `tests/fixtures/no-color-probe.tsx` header lineage; sign
  unconditionality verified in gemini (`DiffRenderer.tsx:312-333`).

#### Files to edit
```
tests/public-api.integration.test.tsx — extend: code scene via src/index.js
tests/fixtures/no-color-probe.tsx — extend: diff scene
src/chat-message.test.tsx — extend no_color assertions (+/- signs, hidden indicator)
CHANGELOG.md — entry (grouped with T3.2)
```

#### Deep Dives
- Scene: provider + DiffViewer (2-file patch w/ rename + fold) + CodeBlock (highlighted
  after ensure) — asserts compose cleanly in one tree.
- Probe additions: 3-line diff; assert `/^\+ /m`, `/^- /m`, no ANSI.

#### Tasks
1. RED (3 tests below)
2. GREEN (wiring only)
3. CHANGELOG

#### TDD
```
RED:     public_entry_composes_code_surface() — import { DiffViewer, CodeBlock, parseUnifiedDiff } from "../src/index.js"; scene render; expect(plain).toContain("→"); expect(plain).toMatch(/^\s*\d+ \+ /m); expect(typeof parseUnifiedDiff).toBe("function")
RED:     composed_scene_matches_snapshot() — <Box width={60}> scene toMatchSnapshot("code-surface-scene")
RED:     no_color_render_contains_diff_signs() — probe out: expect(out).toMatch(/^\+ ?.*new probe line/m); expect(out).toMatch(/^- ?.*old probe line/m); expect(out).toContain("lines hidden") (EC-19); expect(out).not.toContain("[")
GREEN:   Wire the scenes
REFACTOR: None expected
VERIFY:  pnpm vitest run tests/public-api.integration.test.tsx src/chat-message.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suites exit 0; snapshots stable across two consecutive `pnpm test` runs
- [ ] `pnpm vitest run src/chat-message.test.tsx -t no_color` exits 0 with the extended asserts

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T3.2 — Example + diff-viewer benchmark + committed baseline

#### Objective
`examples/code.tsx` demo + `benchmarks/diff-viewer.bench.tsx` +
`docs/benchmarks/m4-diff-viewer-baseline.json`.

#### Why this step (action + reasoning)

1. **What:** RED — M4 baseline schema block (M3-parity + workload asserts) + example
   smoke; then the demo (diff + highlighted code block; piped = static final scene) and
   the bench per D9; full `pnpm bench` run; commit baseline.
2. **Why now:** Wiring pillars (a)+(c); cycle owner requires benchmark data.

#### Evidence
- Harness: `benchmarks/sampling.ts` + M3 bench lessons (append-range self-check, EC-15
  per-run, honest deltas).

#### Files to edit
```
tests/bench-baseline.test.ts — extend: M4 block (M3-parity: mode matrix, finiteness, recomputes, workload fields incl. wide_line_chars)
tests/example-code.integration.test.ts — (NEW) subprocess smoke (execFileSync timeout + minimal env)
benchmarks/diff-viewer.bench.tsx — (NEW) workload per D9
docs/benchmarks/m4-diff-viewer-baseline.json — (NEW) generated via pnpm bench, committed
examples/code.tsx — (NEW) demo
package.json — "example:code" script
CHANGELOG.md — Added entry
```

#### Deep Dives
- Bench: ALL 41 patch strings PRE-GENERATED before the measured loop (EC-17 — string
  concat is fixture noise; parsing stays inside render — that IS the component cost);
  hunk template = 10 context / 15 add / 5 del per 30-line hunk (fold axis active — EC-18);
  `WIDE_HUNK_STEP` in the measured range with `assertWideHunkInAppendRange` self-check +
  mount self-check `windowed rendered rows < full`; modes windowed (maxLines 80 +
  contextLines 2) vs full; per-run EC-15; baseline workload gains `context_lines_per_hunk`.
- Example: non-TTY → final scene once (diff + highlighted code after
  `await ensureHighlighter()`), exit 0; TTY → brief scripted reveal.
- Baseline JSON: M3 shape (modes) + `workload {mount_hunks, steps, hunk_lines,
  wide_line_chars, event? no — hunks}`.

#### Tasks
1. RED schema + smoke tests
2. Implement bench + example; `pnpm bench` full run; commit baseline
3. CHANGELOG

#### TDD
```
RED:     m4_diff_viewer_baseline_exists_with_mode_matrix() — parse docs/benchmarks/m4-diff-viewer-baseline.json; expect(modes sorted).toEqual(["full", "windowed"]); protocol.measured_runs >= 3; warmup_runs >= 1; color_env.FORCE_COLOR === "1"; per mode: runs.length === measured_runs, every frames > 0, every metric Number.isFinite (incl. aggregate std_dev + frames_mean), recompute mean/peak/frames_mean within 0.01, std_dev >= 0; workload.mount_hunks > 0; workload.steps > 0; workload.hunk_lines > 0; workload.wide_line_chars > 0; methodology contains "peak_ms_per_frame"
RED:     code_example_renders_and_exits_cleanly_when_piped() — execFileSync tsx examples/code.tsx (timeout: 30000, minimal env PATH/HOME/FORCE_COLOR); expect(out).toMatch(/^\s*\d+ \+ /m); expect(out).toContain("const"); exit 0
GREEN:   Implement bench + example; run pnpm bench; commit baseline
REFACTOR: None expected (harness shared)
VERIFY:  pnpm vitest run tests/bench-baseline.test.ts tests/example-code.integration.test.ts && pnpm bench --smoke
```

#### Concurrency tests

(none — single-threaded) — sequential awaited rerender loop.

#### Acceptance Criteria
- [ ] `pnpm bench` exits 0 in < 12 min; baseline committed with both modes, ≥ 3 finite self-consistent runs each + pinned env
- [ ] `pnpm bench --smoke` exits 0 in < 240s
- [ ] `pnpm example:code | cat` exits 0 with a `+` diff row and code content
- [ ] Pass: quality — `pnpm lint` exits 0 on benchmarks/ and examples/

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0; real measured numbers committed

---

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | DiffViewer unified + +/- coloring + NO_COLOR degrade (ROADMAP M4 DoD-1) | T1.1, T1.2, T3.1 | Model + renderer + probe scene; sign column = color-independent mechanism |
| 2 | "unified/split" wording (DoD-1) | T1.2 | Unified-only with VERIFIED-ABSENCE deferral recorded (D3) — CHANGELOG names the position |
| 3 | CodeBlock + opt-in highlight dep (DoD-1) | T2.1 | lowlight optional peer + dynamic import + plain degrade + ensureHighlighter |
| 4 | Wide lines (wrap/truncate) (DoD-2) | T1.2 | wrap-never-truncate + pinned gutter + width-matrix invariant tests |
| 5 | Large diffs windowing (DoD-2) | T1.1, T1.2, T3.2 | contextLines folding + maxLines cap + windowed|full bench with real numbers |
| 6 | Snapshots added/removed/context + highlight on/off (DoD-3) | T1.2, T2.1, T3.1 | Sign-row oracles + snapshot; text-invariance + ≤2 colored highlight snapshots |
| 7 | Roadmap risk 1 — highlight dep weight/ESM | T2.1 | Optional peer (zero weight for non-users); ESM-native lowlight; module-absent suite |
| 8 | Roadmap risk 2 — narrow widths | T1.2 | Width matrix {60,30,20} + mechanical length<=W invariant |
| 9 | Benchmark data with statistical protocol (cycle owner) | T3.2 | Committed baseline, pinned env, M3-parity oracle |
| 10 | Wiring triad (`rules/cycle-implement.md`) | T3.1, T3.2 | Integration scene + example + bench callers; baseline = runtime evidence |
| 11 | CHANGELOG discipline (Rule 6) | T1.1, T1.2, T2.1, T3.1, T3.2 | [Unreleased] per task |
| 12 | New-dep audits (deps-audit golden rule) | T1.1, T2.1 | parse-diff + lowlight Rule 9 tables; registry facts at /deps-audit |
| 13 | Edge-case review MUST-FIX EC-1..EC-7 + SHOULD EC-8..EC-20 (review 2026-07-06) | T1.1, T1.2, T2.1, T3.1, T3.2 | Absorbed: ADR addenda (D1/D5/D6/D8/D9/D10) + 20 added RED oracles + glossary EC-24 |

**Coverage: 13/13 gaps covered (100%)**

## Global Definition of Done

- [ ] All phases completed
- [ ] All tests passing — `pnpm test` green (M0-M3 suites + ~60 new M4 tests)
- [ ] Zero type errors — `pnpm typecheck`; zero lint warnings — `pnpm lint`; format clean — `pnpm format:check`
- [ ] Build green — `pnpm build` produces `dist/index.js` + `dist/index.d.ts`
- [ ] Coverage ≥ 90% on `src/**` — `pnpm test:coverage` exits 0 (critical paths § above: 100% lines)
- [ ] File-size budget — `wc -l` <= 500 per changed source file
- [ ] CHANGELOG `[Unreleased]` updated per task (Rule 6)
- [ ] Backward compatibility — existing API unchanged (M4 purely additive)
- [ ] **Benchmark proof** — `docs/benchmarks/m4-diff-viewer-baseline.json` committed with real numbers (2 modes × ≥ 3 runs, mean ± std dev, finite, self-consistent, `color_env.FORCE_COLOR === "1"`)
- [ ] CI green on develop (node 20 + 22, 7 steps)
- [ ] **Plan archived** — after `/review` READY_TO_MERGE AND the release PR merges, move to `knowledge-base/plans/completed/`

## Failure scenarios (when I/O external)

(none — no external I/O touched; the optional-module-absent path is a first-class tested
state, not an I/O failure)

## Final Phase: Integration Validation (MANDATORY)

**Objective:** Prove the M4 surface as a composed workload.

### Execution

```
pnpm gates                    # format:check → lint → typecheck → test → build
pnpm test:coverage            # >= 90% src/**
pnpm bench                    # full run — all five baselines refreshed under pinned env; commit diffs (per-milestone refresh policy, M3 review disposition)
pnpm example:code | cat       # non-TTY smoke
pnpm vitest run               # second consecutive full run (stability)
```

### Acceptance Criteria

- [ ] `pnpm gates` exits 0; `pnpm test:coverage` exits 0
- [ ] Two consecutive `pnpm vitest run` green
- [ ] `pnpm example:code | cat` exits 0 with the diff + code scene
- [ ] All committed baselines pinned-env + self-consistent; refresh diffs committed
- [ ] Failure scenarios — skipped ("(none — no external I/O touched)")

### If Validation Fails

1. All failures are plan-caused — fix before declaring complete; re-run the chain
2. Document environment quirks in the PR description
