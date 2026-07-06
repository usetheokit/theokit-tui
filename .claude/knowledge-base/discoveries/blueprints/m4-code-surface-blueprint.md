# Blueprint: M4 Code surface — DiffViewer/CodeBlock

> **Version 1.0** — Synthesizes the deep research over `gemini-cli` (DiffRenderer +
> CodeColorizer/lowlight + MaxSizedBox), `assistant-ui/react-ink` (diff primitive family +
> react-ink-markdown's optional-peer shiki pattern) and `codex` (diff_model/diff_render,
> wrap contract, highlight compute caps) into the locked M4 decisions: patch-text input
> parsed with `parse-diff`, unified-only rendering (split = VERIFIED ABSENCE in every
> terminal analog), wrap-never-truncate code lines, maxLines + contextLines bounding,
> lowlight as an OPTIONAL peer with plain-text degrade, and the growing-diff bench. All 6
> research questions answered; 0 blocked.

**Slug:** `m4-code-surface`
**Source plan:** `.claude/knowledge-base/discoveries/plans/m4-code-surface-plan.md`
**Owner:** paulohenriquevn + Claude (assisted)
**Generated:** 2026-07-06 via `/discover-execute`
**Confidence verdict:** SHIPPABLE (98.3/100 — 2026-07-06, zero caps)

## Context

Inherited from the discovery plan: `ROADMAP.md § M4` — DiffViewer (unified/split, +/-
coloring, NO_COLOR degrade), CodeBlock with opt-in syntax highlight, wide lines, large
diffs, snapshots. Risks: highlight dep weight/ESM interop; diff layout at narrow widths.

## Objective

Enable `/to-plan` to write the M4 plan with zero unresolved design questions.

---

## Coverage Corner 1 — Integration Tests

*(Answers Q4.)*

- **Fixture shape:** inline template-literal unified diffs (both references converge) —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.test.tsx:29-37`,
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/DiffView.test.tsx:45-55`;
  typed line builders for parser-layer exact-equality tests (`DiffView.test.tsx:18-39,200-226`).
- **Highlight decoupling:** gemini spies on `colorizeCode` and asserts the LANGUAGE ARGUMENT
  per filename, never highlighted pixels — `DiffRenderer.test.tsx:16,51-63,89-101`; its own
  colored assertion is an SVG snapshot (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.test.tsx:51-81`).
- **Height/width cases:** `it.each` width/height matrix + hidden-lines banner oracles —
  `DiffRenderer.test.tsx:299-332`; react-ink `maxLines`/`contextLines` fold oracles —
  `DiffView.test.tsx:337-363,464-500`.
- **Parser negatives (portable byte-exact):** CRLF strip, `\ No newline` markers, blank
  add/del lines — `DiffView.test.tsx:190-259,273-309`.
- **Verified GAPS in both references:** no malformed-patch test, no binary-diff test —
  our error-handling rule demands both.
- **Our kit mapping:** colored snapshots (existing convention, FORCE_COLOR pin) paired with
  line-anchored stripAnsi oracles (`/^\+ new line/m`); **text-invariance oracle** for
  highlight on/off (`stripAnsi(highlighted) === stripAnsi(plain)`); ≤ 2 highlighted
  snapshots total (drift budget); module-absent test via `vi.mock` throwing
  ERR_MODULE_NOT_FOUND; width invariant `every stripAnsi line length <= W`; NO_COLOR probe
  scene asserting `/^\+ /m`+`/^- /m` (gutter chars are the color-independent mechanism —
  verified unconditional in gemini `DiffRenderer.tsx:312-333,350-354`).

---

## Coverage Corner 2 — Dependencies

*(Answers Q5.)*

- **Highlight verdict: `lowlight` (+ its `highlight.js` engine) as an OPTIONAL peer.**
  Production-proven in Ink by gemini (`lowlight 3.3.0`/`highlight.js 11.11.1` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json:51,56`; consumed
  only via lowlight — `CodeColorizer.tsx:9,28`); SYNC API (fits Ink render, deterministic
  first paint); ESM-native (our package is ESM-only).
- **cli-highlight: ZERO adoption across all 7 reference clones (verified absence)** — emits
  ANSI strings, clashing with `<Text color>` + theming. **shiki: Ink precedent exists but
  ASYNC** (react-ink-markdown optional peer — plain-then-pop rendering + WASM weight;
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink-markdown/src/useShikiHighlighter.ts:13-111`).
- **Opt-in mechanism (EC-2, verified shipping pattern):** `peerDependencies` +
  `peerDependenciesMeta.optional: true` + runtime dynamic `import()` cached at module
  scope + plain-text degrade (react-ink-markdown's exact shape); our delta: a one-time
  debug hint naming the missing peer instead of the fully-silent catch.
- **Diff parsing: `parse-diff ^0.12` (hard dep, tiny).** Q1×Q5 tension resolved AGAINST
  hand-rolling: gemini's regex parser is the cautionary tale (duplicated-parse bug
  `DiffRenderer.tsx:35-36`, silent line drops `:46-52`, single-file assumption, fragile
  new-file heuristic `:204-214`); react-ink — the LIBRARY analog — ships `parse-diff`
  (`react-ink/package.json:47`, `diff/diff-utils.ts:1-2`); CLAUDE.md Rule 9 explicitly
  bans hand-rolling parsers for spec'd formats. **jsdiff NOT adopted at M4** (old/new
  computation + intra-line emphasis deferred — no consumer; additive later).

---

## Coverage Corner 3 — Tools

*(Answers Q6.)*

- Height budgets in gemini: `MaxSizedBox maxHeight` + hidden-lines banners
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/shared/MaxSizedBox.tsx:88-167`),
  budget arithmetic (`toolLayoutUtils.ts:18-65`); codex treats large diffs as a COMPUTE
  hazard: highlight skipped above 512 KiB / 10k lines
  (`.claude/knowledge-base/references/codex/codex-rs/tui/src/render/highlight.rs:567-577`,
  `diff_render.rs:582-589`) and highlights per-hunk blocks (`diff_render.rs:23-28`).
- **M4 bench (`benchmarks/diff-viewer.bench.tsx`):** M3 harness verbatim; workload = diff
  GROWING during the loop (mount 10 hunks, +1 hunk × 40 steps × 30 lines ≈ 1500 lines);
  wide-line hunk (30×500 chars) at an APPEND-RANGE index with a fail-fast self-check (the
  M3 dom-testing-1 lesson); modes `windowed` vs `full`; highlight on/off as a second
  dimension ONLY if M4 ships highlighting in the diff (else dropped — YAGNI); EC-15
  per-run guard; `peak_ms_per_frame` headline; <1σ deltas declared inconclusive;
  baseline `docs/benchmarks/m4-diff-viewer-baseline.json`.

---

## Coverage Corner 4 — Techniques

*(Answers Q1, Q2, Q3.)*

### Q1 — Input contract + model + render anatomy

- **Inputs per analog:** gemini consumes PATCH TEXT, hand-parsed —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx:24-94`
  — produced upstream by jsdiff `createPatch` —
  `.claude/knowledge-base/references/gemini-cli/packages/core/src/tools/edit.ts:816-823`;
  react-ink accepts BOTH patch text (parse-diff) and old/new pair (jsdiff), normalized to
  one `ParsedLine[]` —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/DiffView.tsx:19-26`,
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/DiffView.tsx:186-217`,
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/types.ts:1-28`,
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/diff-utils.ts:30-111`;
  codex models `FileChange{Add,Delete,Update}` with patch text parsed lazily —
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/diff_model.rs:10-21`,
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/diff_render.rs:549`.
- **Line model convergence:** kinds add/del/context (+ markers), `oldLine?/newLine?` per
  line, per-file `{oldName, newName, lines, additions, deletions}` (react-ink
  `types.ts:1-28`); stats +N −M green/red (react-ink `DiffStats.tsx:14-19`; codex
  `diff_render.rs:390-419`); renames `old → new` with `/dev/null` = absent
  (`DiffHeader.tsx:15-20`; codex `diff_render.rs:406-410`).
- **Gutter anatomy:** single line-number column (del→old, add→new, context→old),
  right-aligned, dim; `+`/`-`/` ` sign column; fg green/red coloring (react-ink
  `DiffView.tsx:34-38,64,91-114`; gemini adds bg tints `DiffRenderer.tsx:342-386`; codex
  theme-aware `diff_render.rs:1200-1260`).
- **Intra-line emphasis:** react-ink only — positional equal-length run pairing + jsdiff
  words (`intra-line-utils.ts:21-77`) — DEFERRED (needs jsdiff; heuristic; enhancement).
- **Edge cases the model must carry (Q1 warnings):** `\ No newline` suppression
  (`diff-utils.ts:10-19`), CRLF strip (`diff-utils.ts:12-27`), empty diff friendly state
  (`DiffView.tsx:133-134`; gemini `DiffRenderer.tsx:126-132`), binary = file with zero
  chunks (UNHANDLED by all analogs — we render an explicit row), malformed patch (codex
  fails SILENT `diff_render.rs:765-780` — we fail TYPED instead).

### Q2 — Wrap/widths/large diffs

- **Unanimous: code lines WRAP, never horizontally truncate** — gemini `wrap="wrap"`:
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx:376` and
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx:386`;
  codex hard-wraps with unicode width + empty-gutter continuations —
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/diff_render.rs:30-32` and
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/diff_render.rs:894-960`;
  react-ink Ink-default wrap —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/diff/DiffLine.tsx:34-39`.
  Gutter pinned `flexShrink={0}` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx:364-372`;
  tabs→spaces before width math —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/DiffRenderer.tsx:231-235`.
- **Bounding axes:** (a) context folding between changes — react-ink `foldContext` →
  `--- N lines hidden ---` (`diff-utils.ts:113-149`, `DiffContent.tsx:34-63`); gemini
  gap-rule when line numbers jump > 5 (`DiffRenderer.tsx:278-309`); codex dim `⋮`
  (`diff_render.rs:594-605`); (b) line cap with counter — react-ink `maxLines` →
  `... (N more lines)` (`DiffContent.tsx:44-48,72`).
- **Split view: VERIFIED ABSENCE** — no terminal analog ships side-by-side diff (repo-wide
  greps recorded); gemini escalates to VS Code for rich diffs
  (`packages/vscode-ide-companion/src/diff-manager.ts:80-102`); codex's full-view is a
  unified pager (`app/event_dispatch.rs:2030-2038`).

### Q3 — CodeBlock + highlight pipeline

- gemini pipeline (portable near-verbatim): `createLowlight(common)` once —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:28`;
  PER-LINE highlight enabling skip-offscreen —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:104-106` and
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:179-197`;
  hast→Text with color inherited down, `<Text>` only at leaves, Fragments for elements —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:30-94`;
  ~30 hljs classes bucketed into ~10 semantic slots —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:439-574`
  (color map builder `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme.ts:362-386`);
  4-level fallback ladder ending in plain text —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:101-113` and
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:247-298`;
  line-number gutter with hidden-count-aware padding —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/CodeColorizer.tsx:192-213`;
  explicit language first, `highlightAuto` fallback — a DETERMINISM hazard we drop.
- **NO_COLOR as a THEME, not branches:** gemini swaps in a theme whose every color is `""` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/theme-manager.ts:317-319`,
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/builtin/no-color.ts:10-29`
  — the render path has zero color branches.
- gemini's `highlight.ts` is composer-input tokenization, NOT the syntax pipeline (plan
  assumption corrected — honesty note).

## Cross-cutting Comparison

| Dimension | gemini | react-ink | codex |
|---|---|---|---|
| Diff input | patch text, hand-parsed (buggy) | patch XOR old/new via parse-diff+jsdiff | structured + lazy patch parse |
| Code lines | wrap (`:376,386`) | wrap (Ink default) | hard-wrap + empty-gutter continuation |
| Large diffs | MaxSizedBox height cap + banners | maxLines + contextLines folding | unbounded scrollback + highlight compute cap |
| Split view | NO (delegates to IDE) | NO | NO (unified pager) |
| Highlight | lowlight sync, per-line, optional-by-theme | none in diff; shiki optional peer in markdown pkg | syntect, per-hunk, size cutoffs |
| NO_COLOR | empty-color theme | consumer-styled | ANSI-16 degrade |

## ADRs

### D1 — DiffViewer input: `patch: string` parsed with `parse-diff`; multi-file model

**Decision:** `DiffViewer({ patch, ... })` consumes unified-diff TEXT (the shape every
agent upstream emits — gemini `fileDiff` strings, codex `unified_diff`); parsed once with
`parse-diff ^0.12` into `{oldName, newName, lines[{kind, oldLine?, newLine?, text}],
additions, deletions}[]` (multi-file supported). Old/new-pair computation and intra-line
emphasis DEFERRED (would add jsdiff — no consumer at M4; additive later).

**Rationale:** M7 adapters get patch text from tools; hand-parsing is the gemini
cautionary tale (real shipped bugs) and a Rule 9 anti-pattern (parsers for spec'd
formats); react-ink — the library analog — ships parse-diff. Parsing edge cases (CRLF,
`\ No newline`, renames, multi-file) come handled.

**Alternatives considered:** hand-rolled ~50-line parser (rejected: Rule 9 + gemini bug
evidence); dual patch/old-new contract now (rejected: YAGNI — second input arrives with a
consumer); codex FileChange enum (rejected: protocol-specific — M7 adapter concern).

**Consequences:** ONE new tiny hard dep (deps-audit: registry/CVE/transitives); the parsed
model is exported so a later split renderer/old-new entry reuses it.

### D2 — Highlight: `lowlight` OPTIONAL peer, dynamic import, plain-text degrade, explicit language only

**Decision:** `peerDependencies: { lowlight: "^3" }` + `peerDependenciesMeta.lowlight
.optional: true`; module-scope cached `import("lowlight")`; exported-internal
`ensureHighlighter()` awaited by tests; CodeBlock renders PLAIN until loaded, highlighted
after; module absent → permanent plain + ONE debug hint naming the peer (never a throw,
never silent-forever); `language` prop EXPLICIT — no `highlightAuto` (determinism).

**Rationale:** Roadmap's "opt-in dep" materialized via the ONLY verified shipping pattern
(react-ink-markdown); lowlight is the Ink-proven sync engine (gemini) vs shiki's
async/WASM cost; cli-highlight has zero adoption (verified absence) and fights the
`<Text color>` model.

**Alternatives considered:** cli-highlight (rejected: unadopted, ANSI-string output);
shiki (rejected at M4: async plain-then-pop + weight; the theme seam leaves room);
hard dependency (rejected: roadmap says opt-in; grammar weight on every consumer).

**Consequences:** deps-audit checks lowlight@3 registry facts; the module-absent path is a
FIRST-CLASS tested state.

### D3 — Unified-only at M4; split view deferred with recorded absence

**Decision:** DiffViewer renders unified only. The roadmap's "unified/split" is resolved:
split is DEFERRED to a post-M4 milestone gated on real demand, with the parse/render
separation (parsed model exported, Row-level rendering) keeping a later split renderer
additive.

**Rationale:** VERIFIED ABSENCE of split in every terminal analog; split halves content
columns exactly where analogs already fight for width (< 80); the ecosystem escalates to
richer surfaces instead (gemini→IDE, codex→pager).

**Alternatives considered:** building split from first principles (rejected: inventing at
the weakest surface, zero prior art).

**Consequences:** ROADMAP DoD wording is satisfied by an explicit, evidenced position —
recorded in the plan and the M4 CHANGELOG.

### D4 — Render anatomy: wrap-never-truncate; pinned gutter; fg-only colors; sign column is the NO_COLOR mechanism

**Decision:** Code/diff lines `wrap="wrap"`; gutter (line number + sign) `flexShrink={0}`;
tabs→spaces (tabWidth default 4) before render; colors = `theme.status.success`/`error`
FOREGROUND on the whole line (react-ink shape; bg tints deferred to M6 theming); sign
column `+`/`-`/` ` rendered UNCONDITIONALLY (color-independent readability); single
line-number column (del→old, else→new/old per react-ink), right-aligned dim, toggle
`showLineNumbers` default true; hunk gaps = dim `⋮` row (codex idiom); renames
`old → new`; stats `+N` `-M` in the header.

**Rationale:** Unanimous wrap contract; gutter pinning from gemini; fg-only matches our
theme tokens today; the sign column is the verified NO_COLOR mechanism.

**Alternatives considered:** horizontal truncation of code (rejected: no analog does it);
gemini bg tints now (rejected: theme lacks bg tokens — M6).

**Consequences:** M6 may add bg tint tokens; wrapped continuation rows inherit Ink flex
behavior under the pinned gutter (gemini-equivalent).

### D5 — Bounding: `maxLines` cap + `contextLines` folding, both opt-in, on LOGICAL lines

**Decision:** `maxLines?: number` slices rendered rows and appends dim
`… (+N more lines)`; `contextLines?: number` folds unchanged runs into dim
`--- N lines hidden ---` (fold computed on the parsed model, react-ink `foldContext`
shape); `undefined` = unbounded (codex scrollback stance); both validated (integer ≥ 1 /
≥ 0) with typed errors at the boundary.

**Rationale:** The two orthogonal bounding axes found in evidence; logical-line bounding
is deterministic (visual-row MaxSizedBox measurement deferred — heavyweight, M6
robustness); agent diffs have long context runs → folding is the high-value axis.

**Alternatives considered:** MaxSizedBox-style visual-row cap (rejected at M4:
ResizeObserver-style measurement machinery); no bounding (rejected: roadmap DoD
"large diffs (windowing)").

**Consequences:** The bench's `windowed` mode = maxLines+contextLines; `full` = neither.

### D6 — CodeBlock anatomy: per-line lowlight, hast→Text color inheritance, module-local hljs palette, 4-level fallback

**Decision:** `CodeBlock({ code, language?, showLineNumbers = false, maxLines? })` —
per-line highlight (gemini pipeline port: color inherited down, `<Text>` at leaves,
Fragment elements, root-empty → raw line, per-line try/catch → stripped raw line, outer
catch → whole-block plain); module-local `HLJS_COLOR_MAP` (~10 buckets → ink named colors,
gemini `theme.ts:439-574` bucketing table) documented as an M6 theming candidate (M2
glyph precedent); unknown/absent language or unloaded module → plain text; `maxLines`
reuses the D5 cap.

**Rationale:** gemini is the only Ink production colorizer — port the proven shape;
per-line enables cheap truncation and streaming later; NO_COLOR needs zero branches
(chalk renders named colors unstyled at level 0 — same as all our components).

**Alternatives considered:** whole-block highlighting (rejected: kills skip-offscreen and
line-level fallbacks); theme-token indirection now (rejected: theme has no code tokens —
M6; map is module-local like M2 glyphs).

**Consequences:** M6 replaces the palette with theme tokens; DiffViewer does NOT highlight
code at M4 (gemini's spy-decoupling precedent; codex's compute-cap warning) — a
`highlight` prop on DiffViewer is deferred.

### D7 — Failure semantics: typed errors for malformed input; explicit rows for degenerate diffs

**Decision:** `patch` that parses to zero files while non-empty/non-whitespace →
`TypeError: DiffViewer: patch did not parse as a unified diff` (boundary, before hooks —
F10 idiom). Empty/whitespace patch → friendly dim `(no changes)` row. File with zero
chunks (binary/mode-change) → dim `binary or metadata change` row. `\ No newline` markers
suppressed. CRLF stripped.

**Rationale:** codex fails SILENT on unparsable patches — our `rules/error-handling.md § 2`
forbids that; both references render explicit empty states; binary is unhandled by ALL
analogs (we close the gap).

**Alternatives considered:** silent empty render (rejected: swallowed error); throwing on
empty patch (rejected: empty diff is a VALID agent outcome).

**Consequences:** Negative tests the references lack (malformed, binary) become ours.

### D8 — Test strategy: text-invariance for highlight; ≤2 colored highlight snapshots; spy decoupling; width invariant

**Decision:** (1) roadmap snapshots (added/removed/context; highlight on/off) via
`renderFrame` in `<Box width={60}>`, paired with line-anchored stripAnsi oracles;
(2) highlight on/off primary oracle = TEXT INVARIANCE; ≤ 2 colored highlighted snapshots
(exact-pinned dep versions); (3) DiffViewer tests never render highlights (D6 —
no-highlight at M4); (4) module-absent via `vi.mock` throwing ERR_MODULE_NOT_FOUND +
plain-render assert; (5) width matrix {60,30,20} with the mechanical invariant
`every stripAnsi(line).length <= W`; (6) parser-layer exact-equality tests (CRLF,
no-newline, blank lines, multi-file, rename); (7) NO_COLOR probe diff scene
(`/^\+ /m`, `/^- /m`); (8) negatives: malformed TypeError, binary row, empty state,
invalid maxLines/contextLines.

**Rationale:** Corner 1 evidence + our kit conventions; drift budget bounds highlight.js
version churn (gemini pins exact versions for the same reason).

**Alternatives considered:** gemini's SVG snapshot matcher (rejected: new harness
machinery — our colored text snapshots already pin color bytes).

**Consequences:** `ensureHighlighter()` exported-internal for deterministic awaits.

### D9 — Bench: growing multi-hunk diff, windowed|full, wide-line hunk in append range

**Decision:** Per Corner 3: mount 10 hunks; 40 steps × append 1 hunk (30 lines);
wide-line hunk (30×500 chars) at an append-range index with fail-fast self-check; modes
windowed (maxLines+contextLines) vs full; NO highlight dimension (D6 — diff doesn't
highlight at M4); EC-15 per-run; 1+5 protocol; peak headline; <1σ inconclusive clause;
baseline `docs/benchmarks/m4-diff-viewer-baseline.json`.

**Rationale:** M3 lessons (measured work inside the sampled window; honest deltas);
windowed-vs-full is the roadmap's "large diffs" claim under test.

**Alternatives considered:** highlight on/off dimension (dropped with D6 — never bench
speculative features).

**Consequences:** Real numbers for roadmap risk 2 in the DoD.

## Recommendations for the project

| # | Recommendation | Linked to | Priority |
|---|---|---|---|
| 1 | Parsed-diff model + `parse-diff` dependency + typed failure semantics | Q1, D1, D7 | HIGH |
| 2 | DiffViewer unified renderer (gutter, signs, stats, renames, `⋮`, wrap contract) | Q1/Q2, D3, D4 | HIGH |
| 3 | maxLines + contextLines bounding | Q2, D5 | HIGH |
| 4 | CodeBlock + lowlight optional peer + ensureHighlighter + fallback ladder | Q3, D2, D6 | HIGH |
| 5 | Test kit per D8 (incl. the negatives all analogs lack) | Q4, D8 | HIGH |
| 6 | `benchmarks/diff-viewer.bench.tsx` + baseline | Q6, D9 | HIGH |
| 7 | Defer: split view, jsdiff old/new + intra-line, bg tints, visual-row height caps, highlightAuto | D3-D6 YAGNI | LOW |

## Blocked questions (if any)

(none — all 6 answered)

## Halt-loop progress (audit trail)

- Iterations used: 1 (inline — 4 parallel research agents + synthesis; Stop hook active)
- Questions answered: 6/6 · blocked: 0
- EC sampling honored: codex diff_render.rs (2534 L) sampled with recorded regions; all
  test files < 800 L read fully; plan misassumption (gemini highlight.ts = composer
  tokenizer, not syntax pipeline) CORRECTED honestly
- Citations verified: Step 7 path-existence sweep after synthesis

## Related

- Discovery plan: `.claude/knowledge-base/discoveries/plans/m4-code-surface-plan.md`
- Edge-case review: `.claude/knowledge-base/reviews/m4-code-surface-edge-cases-2026-07-06.md`
- Project rules linked: `.claude/rules/architecture.md`, `.claude/rules/testing.md`,
  `.claude/rules/error-handling.md`, `.claude/rules/parsimony-ladder.md`
