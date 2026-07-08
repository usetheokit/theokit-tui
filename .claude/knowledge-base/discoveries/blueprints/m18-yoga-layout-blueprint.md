---
question: How do we add Yoga flexbox layout to the M17 custom react-reconciler renderer so our Box/Text primitives render byte-compatible with Ink, gated on the existing snapshot corpus?
milestone_id: M18
created_at: 2026-07-08
verdict: SHIPPABLE_WITH_CAVEATS
---

# M18 Blueprint — Yoga (flexbox) layout in the custom react-reconciler renderer

**Goal:** Add real Yoga-based flexbox layout to the M17 text-only renderer (`src/renderer/`) so our 20+ Ink components render byte-compatible with Ink, gated on the existing snapshot corpus. **Parity by construction:** we use the *same* yoga package + version + call sequence Ink uses.

## 0. The load-bearing fact (parity by construction)

Ink imports Yoga as `import Yoga from 'yoga-layout'` in every layout file (`node_modules/ink/build/dom.js:1`, `styles.js:1`, `render-node-to-output.js:3`, `reconciler.js:5`, `render-border.js`, `get-max-width.js:1`). It depends on `yoga-layout ~3.2.1` (`node_modules/ink/package.json`). We already have **`yoga-layout@3.2.1`** resolved transitively via Ink. If we depend on the **same version** and drive it with the **same setter/getter sequence** (`styles.js` + `render-node-to-output.js`), layout is byte-identical — literally the same WASM engine producing the same `getComputedLeft/Top/Width/Height`. The 10% risk is NOT layout — it's text measurement + border/SGR rendering, which live in our code.

## 1. Yoga integration map — host-config changes

M17's node (`src/renderer/host-config.ts:13-21`): `{ type, props, children, text?, parent? }`. M18 adds a `yogaNode` field wired through the mutation hooks, mirroring Ink's `dom.js`.

- **createInstance / createTextInstance** (`host-config.ts:91-96`): create a yoga node for box/text/root (`Yoga.Node.create()`); `ink-text` gets `setMeasureFunc(measureTextNode.bind(null,node))` (`dom.js:16-18`); `#text` gets NO yoga node (`dom.js:80-89`). Apply `props.style` immediately via `applyStyles(yogaNode, style)`. Add `isInsideText` host context — a `<Text>` inside `<Text>` → virtual-text, no yoga node (`reconciler.js:120-135`); `<Box>` inside `<Text>` throws (`reconciler.js:130-132`).
- **append / insert / detach** (`host-config.ts:43-58,108-114`): also mutate the yoga tree — `insertChild`/`removeChild` at the computed index (`dom.js:27-59`), mark text dirty. On final removal: `unsetMeasureFunc(); freeRecursive()` (`reconciler.js:52-55`) — **mandatory**, WASM nodes are not GC'd.
- **commitUpdate** (`host-config.ts:117-119`): diff old/new `style`; if changed, `applyStyles(node.yogaNode, styleDiff, newProps.style)` (`reconciler.js:249-251`). `commitTextUpdate` marks the closest yoga node dirty.
- **resetAfterCommit → paint** replaces `assembleLines` (`renderer.ts:45-56`): (1) `root.yogaNode.setWidth(terminal.columns); root.yogaNode.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR)` (`ink.js:319-323`, height=auto); (2) `new Output({width,height})` cell grid (`renderer.js:22-25`); (3) `renderNodeToOutput(node, output, {offsetX,offsetY,transformers})` port (`render-node-to-output.js:71-145`); (4) `output.get().output.split('\n')` → **existing** `OutputEngine.render(string[])` untouched. M17 `requestRender`/microtask coalescing + `OutputEngine` differential paint stay as-is; only string production changes.

## 2. Text measurement + wrap modes

`measureTextNode(node,width)` (port `dom.js:91-106`): `squashTextNodes` (concat children, apply `internal_transform` SGR, `dom.js`/`squash-text-nodes.js:8-33`) → `measureText` = `{width: widestLine, height: split('\n').length}` (`measure-text.js:3-19`); if fits, return; the `<1px` guard (`dom.js:100-101`); else `wrapText(text,width,textWrap)` then re-measure. `markDirty` on text/children change.

Wrap modes (`wrap-text.js:4-36`): `wrap`→`wrapAnsi({trim:false,hard:true})`, `truncate-end`→`cliTruncate({position:'end'})`, `truncate-start`→`{position:'start'}` (+ `hard`, `truncate-middle` free). Corpus needs `wrap`, `truncate-end`, `truncate-start`. **Import Ink's exact libs** (`wrap-ansi`, `cli-truncate`, `widest-line`, `string-width`) — Rule 9.

Render-time re-wrap (`render-node-to-output.js:90-103`): `maxWidth = computedWidth − paddingL/R − borderL/R` (`get-max-width.js`); re-wrap if over; `applyPaddingToText` offset; `output.write(x,y,text,{transformers})`.

## 3. Output model — cell grid (delete M17's assembleLines)

Port Ink's `Output` (`output.js:37-207`): `width/height/operations[]`, `write(x,y,text,{transformers})`, `clip`/`unclip`. `get()` (`output.js:71-206`) builds a `height×width` space-cell grid (preserves trailing padding rows), replays writes, applies transformers per line, tokenizes via `@alcalzone/ansi-tokenize`, places chars with wide-char (2-cell CJK) handling, joins rows with `trimEnd()`. `renderNodeToOutput` walks yoga-laid tree: `x=offsetX+getComputedLeft()`, `y=offsetY+getComputedTop()`; `ink-text` writes squashed+wrapped; `ink-box` renders background+border then recurses; `DISPLAY_NONE` short-circuits.

Borders (`render-border.js:12-82`): only WelcomeBanner uses them. Glyphs from `cli-boxes[borderStyle]`; yoga reserves 1-cell via `setBorder(EDGE_*, 1)` (`styles.js:266-280`). `renderBackground` not needed (no component uses Box `backgroundColor`).

## 4. Props coverage (corpus = 16 components, 40 snapshot exports)

**Box P0:** flexDirection (11/16), flexShrink (drives truncation), flexGrow. **P1:** minWidth, paddingLeft, width, height. **P2:** paddingX, marginTop, flexWrap, borderStyle, borderColor (WelcomeBanner only). **Text P0:** dimColor (14/16), color (12/16), wrap (9/16). **P1:** bold. **P2:** italic, inverse (composer cursor), strikethrough.

**Decision:** port `styles.js` wholesale (~300 lines, full prop set, parity guaranteed) but test/gate against the corpus-minimal subset — KISS at setter layer, YAGNI at test layer. Removes "prop we didn't implement" regressions at M20's 100% bar.

Most layout-heavy (parity risk): WelcomeBanner (border), ChatComposer (nested grow/shrink + inverse cursor), MarkdownText (row list items + strikethrough), ToolCallCard (paddingLeft indent).

## 5. Parity strategy

Corpus: 37 `toMatchSnapshot` → 40 exports across 16 `.snap` files. DoD ≥90% pass = ≤4 documented divergences. Build an itl-compatible adapter over `src/renderer` exposing `.lastFrame()` (reuse the M17 `@xterm/headless VirtualTerminal` oracle); run the corpus through Ink (baseline) and ours, diff. Layout matches (same yoga); residual diffs isolate to SGR emission + border glyphs. Budgeted divergences: SGR ordering/reset, `trimEnd()` trailing-space, border glyphs, highlighter determinism (`preloadHighlighter`). Plain-text (NO_COLOR) parity pass first, then colored.

## 6. Dependencies

Promote `yoga-layout@~3.2.1` to direct `dependencies` (already installed, MIT, WASM base64 top-level-await sync-on-import — `import Yoga from 'yoga-layout'` blocks until ready, no init call; ESM-only, matches us; Node ≥22 supports TLA). Keep external in tsup (runtime dep, do not bundle the WASM). Also depend on Ink's text/border libs at matching versions: `wrap-ansi`, `cli-truncate`, `widest-line`, `string-width`, `cli-boxes`, `chalk`, `@alcalzone/ansi-tokenize`, `indent-string`. Feed all to `/deps-audit`.

## 7. opentui cross-check

opentui (MIT) also uses Yoga (confirms the call) but via native Zig FFI, not the npm package — non-portable substrate. Reusable *patterns*: parallel yoga tree via insertChild/removeChild, single root calculateLayout + top-down computed-layout walk, JS measure-func registry, layout caching by frameId (optional perf idea). Ink's `yoga-layout` WASM path is the direct blueprint.

## ADRs

- **D1 — yoga-layout@3.2.1 (WASM), not hand-rolled/native-FFI.** Alts: hand-rolled flexbox (reinvents Yoga, breaks parity — Rule 9); opentui native FFI (non-portable, native build). Chosen: Ink's exact WASM dep — parity by construction, installed, MIT, ESM/TLA.
- **D2 — Port Ink's cell-grid Output; delete assembleLines.** Alts: extend naive line-walk (can't preserve padding rows / overlapping writes / wide chars / clips). Chosen: cell grid feeds string[] to the untouched OutputEngine.
- **D3 — Reuse Ink's text libs (wrap-ansi/cli-truncate/widest-line/string-width/@alcalzone/ansi-tokenize/chalk).** Alts: reimplement wrap/measure/SGR (parity minefield — Rule 9). Chosen: thin port over the same primitives.
- **D4 — Port styles.js wholesale; test against corpus subset.** Alts: corpus-minimal props (near-zero savings, M20 regression risk). Chosen: full port, corpus-prioritized tests.
- **D5 — Parity via @xterm/headless final-screen comparison, not raw-stream diff.** Alts: raw ANSI diff (SGR-ordering false failures). Chosen: rendered-screen compare (M17 oracle), matches DoD intent.

## Risks + open questions

1. **Text-measurement parity (hard 10%).** Version skew in widest-line/string-width shifts wrapped-text height. Mitigate: pin Ink's exact versions; measure-func unit test (CJK, emoji, multi-line, <1px guard) before wiring components.
2. **SGR/border byte-parity.** @alcalzone/ansi-tokenize re-serialization + trimEnd + chalk reset ordering. Mitigate: 4-slot budget; NO_COLOR pass first.
3. **WASM init timing in tests.** Top-level await settles the module graph; verify the first render occurs after settle (adapter warmup via `await import()`?).
4. **Yoga node leaks.** Missing freeRecursive on removal leaks WASM memory across the long chat session. Mirror Ink's cleanup; leak assertion in bench.
5. **Root height=auto.** Confirm OutputEngine tolerates variable frame heights (it handles deleted-tail already).
6. **ChatThread has no snapshot** — parity transitive via integration scenes + ChatMessage. Add a ChatThread snapshot in M18?
7. **Bench (DoD).** Layout+render vs Ink on the M1 thread workload; measure throttled + unthrottled.

**Bottom line:** a PORT, not an invention. Ink's `dom.js`/`styles.js`/`render-node-to-output.js`/`output.js`/`render-border.js` are the line-by-line blueprint (studied MIT, re-implemented in our TS). M17 seams (host-config hooks, requestRender, OutputEngine, terminal DIP) stay; only `assembleLines` is replaced by yoga-calculate → cell-grid → string[]. Parity guaranteed by the same yoga-layout@3.2.1 + text/SGR libs at matching versions; residual risk confined to text-measurement edges + SGR/border serialization, budgeted ≤4 divergences / 40 snapshots.
