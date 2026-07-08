# Implementation: m13-markdown-renderer

**Date:** 2026-07-08
**Plan:** `plans/m13-markdown-renderer-plan.md` (SHIPPABLE 98.8; T3.1 re-scoped mid-cycle via plan amendment — see DV-2)
**Blueprint:** `discoveries/blueprints/m13-markdown-renderer-blueprint.md` (SHIPPABLE)
**Verdict:** IMPLEMENTATION_COMPLETE · validation exit 0 · code-quality PASS · 510/510 tests

## Task ledger

| Task | Commit | Delivered |
|---|---|---|
| T1.1 model | `3c2fbc0` + `49933ac` (complexity fixup) | `markdown-model.ts` — pure block scanner (headings/ul/ol/hr/fences with length-matched close + EOF streaming safety) + inline tokenizer (bold/italic/bold-italic/strike/verbatim code spans via BACKREFERENCE — fixes gemini's double-backtick mis-split/links/bare URLs); 14 grammar oracles incl. negative + pathological-input linearity; 100% lines |
| T2.1 render | `0691171` | `MarkdownText` (theme tokens; heading tone ladder; fences → CodeBlock; exhaustiveness guard) + `ChatMessage.markdown` opt-in (string-children TypeError; default path byte-identical) + entry export; 2 anchored snapshots (rich + monochrome) |
| T3.1 wiring | `d3c4266` | `ChatThreadMessage.markdown?` routed via Row; markdown-rich `examples/chat.tsx` + rendered-shape smoke (3× green); chat-message bench `markdown` mode + baseline re-record |

## Wiring triad

- **Caller:** `examples/chat.tsx` — the assistant reply is markdown-rich
  (heading + bold + fence) through the REAL ChatThread route.
- **Integration tests:** smoke pins rendered SHAPES (no `**`/fence markers;
  fence content present); thread routing oracle; export-surface assert.
- **Runtime observability:** rendered output IS the observable; the bench
  quantifies the per-frame parse cost (below).

## Bench evidence (markdown mode — the M9 flip condition fired)

Re-record at load **0.83** (`load_1min_at_start` in the JSON), FORCE_COLOR=1,
1 warmup + 5 runs per mode, identical token cadence both modes:

| Mode | mean ms/frame | peak ms/frame | Reading |
|---|---|---|---|
| plain | 32.107 ± 1.743 | 78.352 ± 11.116 | the pre-M13 workload (top-level runs/aggregate keep this shape — contract compatibility) |
| markdown | 42.026 ± 2.052 | 118.530 ± 57.395 | +9.9 ms/frame (+31%) — CITABLE CAUSE: the tail message re-parses (block+inline) AND renders RICHER content (MD_PREFIX heading+bold+fence with CodeBlock) on every streaming repaint — the delta measures parse + content together, not the flag in isolation (r1-F1). Peak σ 57 reflects highlight warm-up on early frames. |

Delta > 1σ ⇒ cause row required and given (plan T3.1 AC).

## Deviations (logged)

- **DV-1 — T1.1 committed with a red lint gate** (complexity 28/23 > 10) —
  the `gates; commit` chaining mistake AGAIN (M12 DV-1 repeat); fixed in the
  immediate next commit (`49933ac`, table-driven refactor, gates green).
  Rule going forward: gate exit GUARDS the commit command — never `;`.
- **DV-2 — T3.1 re-scoped via plan amendment.** The plan's example needed a
  thread-level markdown route that `ChatThread` didn't have; per
  cycle-implement ("return to /to-plan"), the plan was amended
  (ChatThreadMessage.markdown? + routing oracle), re-scored SHIPPABLE, then
  implemented — no silent scope drift.
- **DV-3 — model LoC 287 vs plan budget 260.** The complexity≤10 lint
  contract forced helper extraction (+27 lines of signatures/docblocks).
  Logged, not silently absorbed.
- **DV-4 — T2.1 RED not executed before GREEN.** Suite and component were
  written together; the RED was conceptual (suite fails without the
  module), not run. T1.1/T3.1 ran true REDs.

## Review outcome

(recorded post-review in `reviews/m13-markdown-renderer-review-2026-07-08.md`)
