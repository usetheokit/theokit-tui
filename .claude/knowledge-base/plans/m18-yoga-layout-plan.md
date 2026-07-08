---
slug: m18-yoga-layout
milestone_id: M18
created_at: 2026-07-08
goal: Add Yoga flexbox layout to the M17 renderer so our Box/Text render byte-compatible with Ink, gated on the existing snapshot corpus.
---

# Plan: m18-yoga-layout

## Goal

Replace the M17 renderer's naive `assembleLines` line-walk with real **Yoga
flexbox layout** — driving the *same* `yoga-layout@3.2.1` WASM engine Ink uses,
with the same setter/getter sequence — so our own `Box`/`Text` primitives render
**byte-compatible with Ink**, gated on the existing 40-snapshot corpus (≥ 90 %
pass unchanged, ≤ 4 documented divergences). This is a **port** of Ink's layout
core (`dom.js` / `styles.js` / `render-node-to-output.js` / `output.js` /
`render-border.js`), not an invention: parity is guaranteed by construction.

The M17 seams are preserved untouched — `host-config.ts` mutation hooks gain a
yoga tree, `renderer.ts` `requestRender`/microtask coalescing stays, the
`OutputEngine` differential paint (`output-engine.ts`) and `Terminal` DIP
(`terminal.ts`) are unchanged downstream consumers of `string[]`.

## Baseline Context

### Files that will be touched

| File | LoC (approx) | Role | Change |
|---|---|---|---|
| `src/renderer/host-config.ts` | 163 | reconciler hooks | attach/detach/free yoga nodes; measure func; `isInsideText` context; `applyStyles` on create/update |
| `src/renderer/yoga-style.ts` | NEW | style→yoga | port of Ink `styles.js` — `applyStyles(yogaNode, style)` (full prop set) |
| `src/renderer/text-measure.ts` | NEW | text sizing | `measureTextNode`, `squashTextNodes`, wrap modes (over Ink's libs) |
| `src/renderer/output-grid.ts` | NEW | cell grid | port of Ink `output.js` — `Output` class (`write`/`clip`/`get`) |
| `src/renderer/render-node.ts` | NEW | tree→grid | port of `render-node-to-output.js` + `render-border.js` |
| `src/renderer/renderer.ts` | 119 | orchestration | `paint()` = setWidth→calculateLayout→renderNodeToOutput→OutputEngine; delete `assembleLines`/`textContent` |
| `src/renderer/index.ts` | 9 | barrel | export `Box`/`Text`? (TBD — see Unresolved) |
| `package.json` | — | deps | promote `yoga-layout` to direct dep + text libs |

### Current callers / dependents

- `src/renderer/renderer.ts` `assembleLines` is the ONLY layout producer today; it is deleted and replaced. `createRenderer` public API (`render`/`unmount`/`stats`) is unchanged.
- The 16 Ink components under `src/` import `Box`/`Text` from `"ink"` directly — M18 does NOT change them; it makes our renderer render THOSE components correctly.
- The 40-snapshot corpus (`src/__snapshots__/*.snap` ×15 + `tests/__snapshots__/public-api.integration.test.tsx.snap`) is the parity gate.

### Domain glossary

- **yoga node** — a WASM flexbox node; `Yoga.Node.create()`, `insertChild`, `calculateLayout`, `getComputedLeft/Top/Width/Height`, `freeRecursive`.
- **measure func** — a JS callback yoga invokes to size a text node during `calculateLayout`.
- **squashTextNodes** — concat a text node's descendants applying each SGR `internal_transform` inline.
- **cell grid (`Output`)** — a `height×width` buffer of styled chars; `get()` collapses it to `\n`-joined rows with `trimEnd()`.
- **transformers** — per-line SGR functions applied at write time (color/bold/dim).

### Architecture boundaries affected

- `src/renderer/` island stays Ink-component-free (island purity — M17 AC). It gains `yoga-layout` + text libs as deps, but imports NO code from `src/*.tsx` (the components).
- The layout layer (yoga-style / text-measure / output-grid / render-node) sits between the reconciler (host-config) and the paint engine (output-engine). One-directional: host-config → renderer → render-node → output-grid → OutputEngine → Terminal.

## Prior Art

- **Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m18-yoga-layout-blueprint.md` (SHIPPABLE_WITH_CAVEATS) — the line-by-line Ink map + ADRs D1–D5.
- **Ink source (MIT, studied):** `node_modules/ink/build/{dom,styles,render-node-to-output,output,render-border,get-max-width,measure-text,wrap-text,squash-text-nodes}.js`.
- **opentui (MIT):** confirms the yoga-tree-mirror + measure-registry patterns (native FFI, non-portable).
- **M17 plan/impl:** `.claude/knowledge-base/plans/m17-renderer-skeleton-plan.md` — the seams this builds on.

## ADRs

### D1 — yoga-layout@3.2.1 (WASM), driven with Ink's exact call sequence

Parity by construction. **Alternatives:** hand-rolled flexbox (reinvents Yoga, breaks parity — Rule 9); opentui's native Zig-FFI yoga (non-portable substrate, native build). Chosen: the same WASM dep Ink ships, top-level-await sync-on-import.

### D2 — Port Ink's cell-grid `Output`; delete M17's `assembleLines`

**Alternatives:** extend the naive line-walk to absolute positioning (cannot preserve trailing padding rows, overlapping writes, wide chars, clips — all needed for borders/CJK). Chosen: the cell grid feeds `string[]` to the untouched `OutputEngine`.

### D3 — Reuse Ink's text libs (wrap-ansi / cli-truncate / widest-line / string-width / @alcalzone/ansi-tokenize / chalk / cli-boxes)

**Alternatives:** reimplement wrap/measure/SGR (wide-char + ANSI-aware wrapping is a parity minefield — Rule 9). Chosen: a thin port over the same primitives Ink runs, at matching versions.

### D4 — Port `styles.js` wholesale (full prop set), gate against the corpus subset

**Alternatives:** implement only the ~12 corpus props (near-zero savings, reintroduces "prop we didn't implement" regressions at M20's 100 % bar). Chosen: full setter port (KISS at the setter layer), corpus-prioritized tests (YAGNI at the test layer).

### D5 — Parity via `@xterm/headless` final-screen comparison, not raw-stream diff

**Alternatives:** diff raw ANSI streams (SGR-ordering noise → false failures). Chosen: compare rendered screens via the M17 `VirtualTerminal` oracle; a NO_COLOR plain-text pass first isolates layout from SGR.

## Dependencies

| Package | Version (resolved in Ink's tree, verified 2026-07-08) | Rule 9 justification |
|---|---|---|
| `yoga-layout` | `3.2.1` | the WASM flexbox engine Ink uses — promote transitive→direct; parity by construction |
| `wrap-ansi` | `10.0.0` | ANSI-aware word wrapping (`wrap` mode) |
| `cli-truncate` | `6.1.0` | truncate-end/start/middle |
| `widest-line` | `5.0.0` | text width measurement |
| `string-width` | `7.2.0` | wide-char (CJK) width |
| `@alcalzone/ansi-tokenize` | `0.1.3` | cell-accurate SGR tokenization in `output.get()` |
| `cli-boxes` | `4.0.1` | border glyphs (WelcomeBanner) |
| `chalk` | `5.6.2` | SGR transforms (color/bold/dim) |
| `indent-string` | `5.0.0` | padding-to-text offset |

All MIT, all already in Ink's resolved tree (zero new download risk). **deps-audit
2026-07-08: `pnpm audit --prod` → "No known vulnerabilities found".** Pin each to
the version above (Ink's exact resolution) so layout + wrap + SGR are byte-parity.

## Critical paths

- `src/renderer/yoga-style.ts` — the style→yoga setter map (mutation testing target).
- `src/renderer/text-measure.ts` — the measure func + wrap (the hard-10 % parity risk).
- `src/renderer/output-grid.ts` — the cell grid `get()` (trailing-space/wide-char correctness).
- `src/renderer/render-node.ts` — the tree→grid walk + borders.

## Phase 1: Yoga tree + style port

### T1.1 — yoga-style.ts (style→yoga setter port) + host-config yoga tree

#### Objective

Port Ink's `styles.js` into `applyStyles(yogaNode, style)` (full prop set) and wire the yoga tree through host-config's create/append/insert/remove/commit hooks (attach, detach, free), with the `isInsideText` host context.

#### Why this step (action + reasoning)

1. **What:** RED — `applyStyles` sets the yoga node's flex/padding/width/border per prop (assert via getters); host-config attaches/frees yoga nodes on mutation. GREEN — port `styles.js` + wire the hooks.
2. **Why now:** layout cannot be computed until every node has a correctly-configured yoga node; this is the foundation the measure/grid phases build on.

#### Evidence

Blueprint § 1 (host-config changes), § 4 (props table), ADR D1/D4; Ink `dom.js:5-68`, `styles.js:47-280`, `reconciler.js:52-55,120-146,223-252`.

#### Files to edit

```
src/renderer/yoga-style.ts (NEW) / src/renderer/yoga-style.test.ts (NEW)
src/renderer/host-config.ts / src/renderer/host-config.test.ts (NEW or extend)
package.json (yoga-layout direct dep) / CHANGELOG.md
```

#### TDD

```
RED:  apply_styles_sets_flex_direction() — applyStyles(node, {flexDirection:"row"}); expect(node.getFlexDirection()) === Yoga.FLEX_DIRECTION_ROW
RED:  apply_styles_sets_padding_and_width() — {paddingLeft:2, width:20}; expect getComputedPadding(EDGE_LEFT) via a laid-out parent AND getWidth()==20
RED:  apply_styles_sets_flex_grow_shrink() — {flexGrow:1, flexShrink:0}; assert getFlexGrow()==1, getFlexShrink()==0
RED:  apply_styles_reserves_border() — {borderStyle:"round"}; expect getBorder(EDGE_TOP)==1
RED:  host_config_attaches_yoga_child_on_append() — createInstance ink-box parent + child; append; expect parent.yogaNode.getChildCount()==1
RED:  host_config_frees_yoga_node_on_remove() — spy freeRecursive called on removeChild final removal (no leak)
RED:  text_inside_text_has_no_yoga_node() — <Text> in <Text> (isInsideText) → virtual-text node, yogaNode undefined
VERIFY: pnpm vitest run src/renderer/yoga-style.test.ts src/renderer/host-config.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/renderer/yoga-style.test.ts src/renderer/host-config.test.ts` exits 0; yoga-style.ts at 100 % lines
- [ ] `pnpm vitest run ...` exits NON-ZERO before yoga-style.ts exists (RED exit recorded in the progress notes)
- [ ] `yoga-layout` is a direct `dependencies` entry pinned `~3.2.1`; `pnpm exec publint` clean
- [ ] Zero Ink-component-path imports in `src/renderer/` (island purity preserved)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 2: Text measurement + cell-grid output

### T2.1 — text-measure.ts + output-grid.ts

#### Objective

Port the text measure func (squash + measure + 3 wrap modes over Ink's libs) and the cell-grid `Output` (`write`/`clip`/`get` with wide-char + trimEnd), so a laid-out tree can be rasterized to `string[]`.

#### Why this step (action + reasoning)

1. **What:** RED — measure func sizes text (fit / wrap / truncate, CJK, `<1px` guard); Output grid writes chars at (x,y), preserves padding rows, trims trailing space. GREEN — port `measure-text.js`/`wrap-text.js`/`squash-text-nodes.js` + `output.js`.
2. **Why now:** yoga needs the measure func to size text nodes during `calculateLayout`; the grid is what turns computed layout into byte-parity output.

#### Evidence

Blueprint § 2 (measure + wrap), § 3 (output model), ADR D2/D3; Ink `dom.js:91-124`, `measure-text.js:3-19`, `wrap-text.js:4-36`, `output.js:37-207`.

#### Files to edit

```
src/renderer/text-measure.ts (NEW) / src/renderer/text-measure.test.ts (NEW)
src/renderer/output-grid.ts (NEW) / src/renderer/output-grid.test.ts (NEW)
package.json (wrap-ansi, cli-truncate, widest-line, string-width, @alcalzone/ansi-tokenize) / CHANGELOG.md
```

#### TDD

```
RED:  measure_text_returns_widest_line_and_height() — "ab\ncde" → {width:3, height:2}
RED:  measure_wraps_when_over_width() — long line, width 5, wrap → height grows, width<=5
RED:  measure_truncate_end_and_start() — "hello world" width 5 truncate-end → "hell…"; truncate-start → "…orld"
RED:  measure_cjk_wide_char_counts_two() — "你好" → width 4
RED:  measure_sub_cell_guard() — width 0<w<1 returns intrinsic (dom.js:100 guard)
RED:  grid_writes_char_at_position() — output.write(2,1,"x"); get() row 1 has "x" at col 2
RED:  grid_preserves_trailing_padding_rows() — a 3-tall write into a 5-tall grid yields 5 rows (2 blank)
RED:  grid_trims_trailing_space_per_row() — write "ab   " → row is "ab"
RED:  grid_wide_char_occupies_two_cells() — write "你" then "x" at col+2, not col+1
VERIFY: pnpm vitest run src/renderer/text-measure.test.ts src/renderer/output-grid.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/renderer/text-measure.test.ts src/renderer/output-grid.test.ts` exits 0; both files at 100 % lines
- [ ] RED exit recorded in the progress notes (before each module exists)
- [ ] measure func handles wrap/truncate-end/truncate-start/CJK/`<1px` — each an asserted test

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 3: render-node walk + borders + parity gate + bench

### T3.1 — render-node.ts (tree→grid + borders) + renderer paint rewrite + parity corpus gate + bench

#### Objective

Port `render-node-to-output.js` + `render-border.js`, rewrite `renderer.ts` `paint()` to setWidth→calculateLayout→renderNodeToOutput→OutputEngine (delete `assembleLines`), gate on the existing snapshot corpus via a `@xterm/headless` adapter, and bench layout+render vs Ink.

#### Why this step (action + reasoning)

1. **What:** RED — the corpus parity gate (existing snapshots rendered through our renderer match Ink, ≤4 documented divergences) + the layout scenes (flexDirection/padding/border/grow). GREEN — the render-node walk + border render + paint rewrite; the bench + baseline; the divergence report.
2. **Why now:** terminal integration step — this is where the port becomes an observable, gated capability. Release follows review, not here.

#### Evidence

Blueprint § 3 (render-node + borders), § 5 (parity strategy), § 7 (bench), ADR D5; Ink `render-node-to-output.js:71-145`, `render-border.js:12-82`, `get-max-width.js:2-8`.

#### Files to edit

```
src/renderer/render-node.ts (NEW) / src/renderer/render-node.test.tsx (NEW)
src/renderer/renderer.ts (paint rewrite; delete assembleLines/textContent)
tests/renderer/parity-corpus.test.tsx (NEW — the corpus gate)
benchmarks/renderer-layout.bench.tsx (NEW) / docs/benchmarks/m18-renderer-layout-baseline.json (NEW)
docs/renderer/m18-parity-report.md (NEW) / CHANGELOG.md
```

#### TDD

```
RED:  renders_flex_column_and_row_scenes() — <Box column>/<Box row> laid out via yoga match expected screen rows
RED:  renders_padding_offsets_content() — paddingLeft:2 → content indented 2 cols
RED:  renders_border_box() — <Box borderStyle="round"> draws the 4 edges with cli-boxes glyphs
RED:  renders_flex_grow_distributes_width() — two grow:1 children split the row width
RED:  parity_corpus_matches_ink_within_budget() — for each of N corpus scenes: render via ink (baseline) AND ours (VirtualTerminal); assert equal OR the divergence is listed in m18-parity-report.md; total divergences <= 4
RED:  m18_layout_baseline_contract() — baseline JSON: modes [ink, own], load<4, ms/frame finite
VERIFY: pnpm vitest run src/renderer/render-node.test.tsx tests/renderer/parity-corpus.test.tsx tests/bench-banner-baseline.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/renderer/render-node.test.tsx tests/renderer/parity-corpus.test.tsx` exits 0; render-node.ts at 100 % lines
- [ ] **≥ 90 % of the corpus scenes pass byte-identical vs Ink** (≤ 4 divergences), each documented per-diff in `docs/renderer/m18-parity-report.md`
- [ ] `renderer.ts` no longer contains `assembleLines`/`textContent` (grep shows zero); the paint path is yoga-driven
- [ ] Baseline JSON `load_1min_at_start` < 4; ink-vs-own layout+render ms table stated in the implementation log

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Edge cases absorbed

(EC-1 yoga node leak → T1.1 freeRecursive test; EC-2 text-inside-text no yoga node → T1.1; EC-3 CJK wide-char measure → T2.1; EC-4 `<1px` sub-cell guard → T2.1; EC-5 trailing padding rows preserved → T2.1 grid; EC-6 SGR/border divergence budget → T3.1 parity report; EC-7 WASM init timing in tests → T1.1 warmup)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M18 DoD-1: Yoga-wasm layout (flexDirection/grow/shrink/padding/width/borders) (ROADMAP § M18) | T1.1, T3.1 | applyStyles full port + render-node walk |
| 2 | M18 DoD-2: Box/Text (wrap modes, SGR, borders) byte-compatible (ROADMAP § M18) | T2.1, T3.1 | measure+wrap + render-node + border port |
| 3 | M18 DoD-3: ≥ 90 % snapshot corpus passes unchanged (ROADMAP § M18) | T3.1 | parity-corpus gate + divergence report |
| 4 | M18 DoD-4: bench layout+render vs Ink on M1 thread workload (ROADMAP § M18) | T3.1 | renderer-layout bench + baseline |
| 5 | M18 DoD-5: gates/coverage/CHANGELOG (ROADMAP § M18) | T1.1–T3.1 | per-task gates + CHANGELOG entries |
| 6 | M18 risk-1: text-measurement parity (blueprint risk 1) | T2.1 | measure-func unit tests (CJK/wrap/guard) over Ink's exact libs |
| 7 | M18 risk-2: SGR/border byte-parity (blueprint risk 2) | T3.1 | @alcalzone/ansi-tokenize + divergence budget; NO_COLOR pass first |
| 8 | Deps: new prod deps CVE pass (blueprint § 6) | (deps-audit gate) | yoga-layout + text libs audited before implement |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Text-measurement parity is the hard 10 % | High | pin Ink's exact lib versions; focused measure-func tests before wiring components | implement |
| SGR/border serialization diffs from Ink | Medium | @alcalzone/ansi-tokenize + chalk at matching versions; ≤ 4 divergence budget; NO_COLOR pass isolates layout | implement |
| WASM yoga node leaks across long sessions | Medium | mirror Ink's freeRecursive on removal; leak assertion | implement |
| WASM top-level-await init timing in tests | Low | Node ≥ 22 supports TLA; adapter warmup via `await import()` verified in T1.1 | implement |
| Scope creep into input/images | Low | text+layout only; input=M19, images=M21 (blueprint Out) | implement |

## Failure scenarios (when I/O external)

(none — the renderer writes to a Terminal interface; no network/DB/queue. yoga-layout is in-process WASM; the WASM instantiation is a module-load concern, covered by the init-timing risk above, not a runtime I/O failure.)

## Unresolved Questions

- Should `src/renderer/index.ts` re-export `Box`/`Text` (own primitives) or keep consumers on Ink's `Box`/`Text` as intrinsic sources? Leaning: keep Ink's for M18 (they emit `ink-box`/`ink-text` our host receives); a native `Box`/`Text` export is an M20 API-surface decision.
- Add a `ChatThread` snapshot in M18 to harden the parity gate, or defer to M20's 100 % bar? Leaning: defer (integration scenes cover it transitively).

## Test Plan

Yoga-style setter oracles (getter asserts) + measure-func unit tests (fit/wrap/truncate/CJK/guard) + cell-grid oracles (position/padding/trim/wide-char) + render-node scene tests (flex/padding/border/grow) + the corpus parity gate (Ink vs ours via VirtualTerminal, ≤ 4 divergences) + baseline contract. Discipline per `.claude/rules/testing.md` (§ 4.1 negatives — over-width wrap, sub-cell guard, leak-on-remove; § 6 determinism — the emulator + WASM are deterministic, no timers). Two consecutive full runs green.

## Global Definition of Done

- [ ] All tasks committed gates-gated (1 task = 1 commit, `gates && commit` with the FULL `pnpm gates`)
- [ ] Existing corpus ≥ 90 % pass on the new renderer; divergences documented per-diff
- [ ] `assembleLines` deleted; paint path is yoga-driven
- [ ] Bench baseline committed (layout+render ms, load < 4); parity report present
- [ ] Plan archived post-release
