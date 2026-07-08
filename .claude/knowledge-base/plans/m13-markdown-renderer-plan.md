---
slug: m13-markdown-renderer
milestone_id: M13
created_at: 2026-07-08
goal: MarkdownText renders the AI-chat markdown subset (gemini-proven hand-rolled grammar, zero new deps) with fences routed to CodeBlock and theme-token inline styles; ChatMessage gains an opt-in markdown prop with default-off byte-identity; markdown bench mode lands (per-frame parse path).
---

# Plan: m13-markdown-renderer

## Goal

Ship `MarkdownText` per blueprint
`.claude/knowledge-base/discoveries/blueprints/m13-markdown-renderer-blueprint.md`
(D1 hand-rolled subset parser, D2 nested-Text theme tokens, D3 bench mode):
block subset (headings 1–4, ul/ol, hr, paragraphs, fences → existing
`CodeBlock`), inline subset (bold/italic/bold-italic/strikethrough/
inline-code/links/bare-URLs), streaming-safe (EOF closes an open fence),
degrade-ladder clean. `ChatMessage` gains `markdown?: boolean`
(default false — every existing call site byte-identical). Release
(0.14.0) follows READY_TO_MERGE — NEVER a plan task (M10 DV-1 rule).

## Baseline Context

Repo state: develop @ v0.13.0 published (ink 7.1.0 / react 19.2.7;
483/483 green after the M12 batch).

### Files that will be touched

| File | LoC | Role |
|---|---|---|
| `src/markdown-model.ts` | new (~220) | PURE parser: block scanner + inline tokenizer → typed nodes/segments (no ink import) |
| `src/markdown-model.test.ts` | new (~260) | grammar unit oracles (block + inline + partial) |
| `src/markdown-text.tsx` | new (~130) | `MarkdownText`: nodes → ink tree (theme tokens; fences → CodeBlock) |
| `src/markdown-text.test.tsx` | new (~200) | render oracles + ≤ 2 snapshots |
| `src/chat-message.tsx` | ~120 | `markdown?: boolean` opt-in routing assistant/user content |
| `src/chat-message.test.tsx` | ~250 | default-off byte-identity + opt-in scene |
| `src/index.ts` | — | export `MarkdownText` + types |
| `tests/export-surface.test.ts` | — | entry assert |
| `examples/chat.tsx` + `tests/example-chat.integration.test.ts` | — | markdown-rich assistant message + rendered-shape asserts |
| `benchmarks/chat-message.bench.tsx` | ~180 | `markdown` mode + baseline re-record |
| `CHANGELOG.md` | — | per task |

### Current callers / dependents

- `ChatMessage` consumers: ChatThread rows, examples, scenes, benches —
  new prop optional, default false ⇒ zero behavior change unopted.
- `CodeBlock` gains one internal caller (`MarkdownText`) — its public
  contract is untouched.

### Domain glossary

- **block scanner** = line loop with the gemini regexes (heading/fence/
  ul/ol/hr) + `inCodeBlock` state; EOF with an open fence still emits the
  code block (streaming safety).
- **inline segment** = `{text, styles}` produced by the alternated-regex
  tokenizer; code spans are VERBATIM (no nested styling inside backticks).
- **default-off byte-identity** = `ChatMessage` without `markdown` renders
  the exact same bytes as v0.13.0 — pinned by live-render comparison.

### Architecture boundaries affected

None new — `markdown-model.ts` is pure domain (no ink), `markdown-text.tsx`
is the render adapter over it (mirrors `diff-model.ts`/`diff-viewer.tsx`,
the house M4 split).

## Prior Art

- Blueprint Corners 1–4 + ADRs D1–D3 (consumed verbatim); grammar citations
  live there (gemini `MarkdownDisplay.tsx` / `markdownParsingUtils.ts`).
- House model/render split precedent: `src/diff-model.ts` + `src/diff-viewer.tsx`.
- Test discipline per `.claude/rules/testing.md` (§ 4.1 negative cases;
  § 6 determinism).

## ADRs

### D1 — Pure model module + render adapter split

**Decision:** parser in `src/markdown-model.ts` (typed `MarkdownNode[]` +
`InlineSegment[]`, zero ink imports); `MarkdownText` consumes it.
**Rationale:** grammar is unit-testable in milliseconds without render
overhead (the M4 diff-model precedent); the bench then isolates parse vs
render honestly.
**Alternatives considered:** parse inline inside the component (gemini's
shape; rejected: their 456-line component mixes concerns — our house split
is stricter); a class-based parser (rejected: functions + data suffice,
KISS).
**Consequences:** two files, each under budget; model exports stay
internal (not on the package entry) until a consumer demands them.

### D2 — Inline segments → nested `<Text>` theme tokens

**Decision:** segments render as nested `<Text bold/italic/strikethrough>`
children; inline-code takes `theme.accent`; links render `text (url)` with
the url in accent.
**Rationale:** blueprint D2 — the theme contract is data-driven
(monochrome tokens); chalk strings would bypass it.
**Alternatives considered:** chalk ANSI strings (gemini; rejected — theme
bypass + new coupling); OSC-8 hyperlinks (rejected: terminal support
matrix is a swamp, YAGNI).
**Consequences:** bold/italic SGR survive monochrome themes (attributes,
not colors — the M10 ToolCall precedent).

### D3 — Evidence: markdown mode on the chat-message bench

**Decision:** `benchmarks/chat-message.bench.tsx` gains a `markdown` mode
(streaming-append workload over a markdown-rich message: heading + bold +
list + fence); baseline re-recorded with all modes, `load_1min_at_start`
recorded (M12 convention).
**Rationale:** the parse re-runs on every streaming repaint — per-frame
path, the recorded M9 flip condition fires.
**Alternatives considered:** own bench file (rejected: the workload IS the
chat-message streaming workload — a mode, not a new harness); no bench
(rejected: recorded contract).
**Consequences:** existing modes re-recorded in the same round (fair
same-session comparison).

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| ink `Text`/`Box` | existing ^7.1.0 | no | platform primitives |
| `CodeBlock` (internal) | — | no | fence rendering reuses the M4 surface |
| lowlight | existing ^3.0.0 | no | transitively via CodeBlock only |

**NEW packages: (none).** Manifest untouched (pinned by existing tests).

## Critical paths

- `src/markdown-model.ts` scanner + tokenizer branches — 100% line
  coverage.
- `src/markdown-text.tsx` node-kind dispatch — 100% line coverage.

## Phase 1: The model

### T1.1 — markdown-model: block scanner + inline tokenizer (pure)

#### Objective

The typed parser with full grammar oracles.

#### Why this step (action + reasoning)

1. **What:** RED — grammar unit oracles (below); GREEN — the gemini-shape
   scanner/tokenizer emitting typed nodes.
2. **Why now:** everything downstream consumes the model; a proven-pure
   grammar makes the render layer trivial.

#### Evidence

- Blueprint Corner 4 (grammar + state machine + tokenizer contract with
  gemini citations).

#### Files to edit

```
src/markdown-model.ts / src/markdown-model.test.ts / CHANGELOG.md
```

#### TDD

```
RED:     parses_each_block_kind() — parseMarkdown("# H1\n## H2\n### H3\n#### H4\n- a\n1. b\n---\npara") node kinds; const kinds = nodes.map(pick kind); expect(kinds).toEqual(["heading","heading","heading","heading","list-item","list-item","hr","paragraph"])
RED:     fence_accumulates_verbatim_and_matches_close_length() — "```ts\ncode **not bold**\n````\nafter" (close longer than open is valid per gemini :91-116); const fence = nodes[0]; expect(fence.kind).toBe("code"); expect(fence.language).toBe("ts"); expect(fence.lines.join("")).toContain("**not bold**")
RED:     unclosed_fence_at_eof_still_emits_code() — "before\n```js\ntail" ends inside the fence; const last = nodes.at(-1); expect(last.kind).toBe("code") (EC-1 streaming safety)
RED:     inline_bold_italic_nesting_and_boundaries() — segments("**b** *i* ***bi*** intra*word*stays") styles; expect(seg bold).toBe(true) for "b"; bold+italic both true for "bi"; the intra-word asterisk run stays literal text (gemini word-boundary guards :168-180)
RED:     inline_code_is_verbatim() — segments("`**x**` and ``a`b``") — the code segment text is "**x**" with code=true and bold undefined; double-backtick span preserves the inner backtick (EC-2)
RED:     link_and_bare_url_segments() — segments("[t](https://u) and https://w") — link segment {text:"t", url:"https://u"}; bare url segment flagged link
RED:     consecutive_blank_lines_collapse() — parseMarkdown("a\n\n\n\nb") — exactly one spacer node between the two paragraphs (gemini :268-274)
RED:     malformed_markers_fall_through_as_literal() — segments("**unclosed and ~~half") — no styled segment; the text survives verbatim (negative case per testing.md § 4.1)
VERIFY:  pnpm vitest run src/markdown-model.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] Suite exits 0; model file 100% lines (`pnpm test:coverage` report)
- [ ] `wc -l src/markdown-model.ts` ≤ 260
- [ ] A suite test asserts `readFileSync(src/markdown-model.ts)` has zero matches for `/from "ink"/` (model purity pin)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 2: The render layer

### T2.1 — MarkdownText component + ChatMessage opt-in

#### Objective

Nodes → ink tree with theme tokens; fences → CodeBlock; the opt-in prop.

#### Why this step (action + reasoning)

1. **What:** RED — render oracles + default-off byte-identity; GREEN —
   `MarkdownText` dispatch + `ChatMessage` `markdown` routing.
2. **Why now:** the model is proven; the render layer is a thin adapter.

#### Evidence

- Blueprint Corner 1 oracles (d)/(e)/(f) + Corner 4 theme/degrade rules.

#### Files to edit

```
src/markdown-text.tsx / src/markdown-text.test.tsx
src/chat-message.tsx / src/chat-message.test.tsx
src/index.ts / tests/export-surface.test.ts / CHANGELOG.md
```

#### TDD

```
RED:     renders_heading_bold_and_fence_scene() — render <MarkdownText text={rich}/> at width 60; const frame = lastFrame(); expect(frame).not.toContain("**"); expect(frame).not.toContain("```"); expect(frame).toContain("const x = 1"); expect(frame).toMatchSnapshot("markdown-rich-scene") (snapshot 1 of ≤ 2, anchored)
RED:     inline_code_takes_accent_and_stays_verbatim() — themed render of "run `pnpm **test**`"; const frame = lastFrame(); expect(frame).toContain("pnpm **test**") (verbatim); accent SGR present around the span
RED:     monochrome_theme_drops_color_keeps_attributes() — TheoTUIProvider no-color theme; frame has zero color-class SGR (house no_color idiom) but bold SGR ([1m) present; expect(frame).toMatchSnapshot("markdown-monochrome") (snapshot 2 of ≤ 2)
RED:     chat_message_default_off_is_byte_identical() — const a = render(<ChatMessage role="assistant" content={md}/>); const b = render(same WITHOUT markdown prop v0.13.0 shape); const identical = a.lastFrame() === b.lastFrame(); expect(identical).toBe(true) — plus the raw "**" visible when off (EC-3)
RED:     chat_message_markdown_opt_in_renders_styled() — <ChatMessage markdown .../>; expect(lastFrame()).not.toContain("**")
RED:     entry_exports_markdown_text() — import { MarkdownText } from "../src/index.js" resolves; expect(typeof MarkdownText).toBe("function")
VERIFY:  pnpm vitest run src/markdown-text.test.tsx src/chat-message.test.tsx tests/export-surface.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] Suites exit 0; ≤ 2 new snapshots TOTAL for M13 (insertions-only diff)
- [ ] `wc -l src/markdown-text.tsx` ≤ 160
- [ ] `git diff v0.13.0..HEAD -- src/chat-message.test.tsx` shows zero deletions on pre-existing tests AND `pnpm vitest run src/chat-message.test.tsx` exits 0

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 3: Wiring + evidence

### T3.1 — Example + smoke + degrade + bench mode

#### Objective

Wiring pillars + the D3 bench evidence.

#### Why this step (action + reasoning)

1. **What:** RED — smoke asserts (rendered shapes) + bench-baseline
   contract extension; GREEN — markdown-rich assistant message in
   `examples/chat.tsx`, degrade scene delta if any, the `markdown` bench
   mode + one load-gated re-record of the chat-message baseline.
2. **Why now:** terminal evidence step (release follows review, NOT here).

#### Evidence

- Blueprint Corner 3 (bench decision + example/smoke shapes).

#### Files to edit

```
src/chat-thread.tsx / src/chat-thread.test.tsx (ChatThreadMessage.markdown? routed to the row's ChatMessage — the thread-level wiring the example needs)
examples/chat.tsx / tests/example-chat.integration.test.ts
benchmarks/chat-message.bench.tsx / docs/benchmarks/m0-chat-message-baseline.json
tests/bench-baseline.test.ts (or the banner-baseline suite file if budget) / CHANGELOG.md
```

#### TDD

```
RED:     thread_message_markdown_flag_routes_to_row() — render ChatThread with one message {markdown: true, content: "**b**"} and one without; const frame = lastFrame(); expect(frame).not.toContain("**"); expect(frame).toContain("b"); the unflagged message with markers renders them literally (per-message opt-in; default-off byte-identity holds for unflagged rows)
RED:     chat_example_markdown_asserts() — extend the smoke: expect(out).not.toContain("**"); expect(out).toContain("What ships in M1?"); const fenced = out.includes("npm install @theokit/tui"); expect(fenced).toBe(true) (the fence CONTENT renders; markers do not)
RED:     m13_baseline_contract() — baseline JSON gains a markdown mode entry; const modeNames = baseline.modes.map(pick mode); expect(modeNames).toContain("markdown"); load_1min_at_start finite (M12 convention)
GREEN:   example message rewritten as markdown-rich; bench mode added; ONE load-gated (< 4, FORCE_COLOR=1) re-record of all chat-message modes
VERIFY:  pnpm vitest run tests/example-chat.integration.test.ts tests/bench-baseline.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] 3 consecutive `pnpm vitest run tests/example-chat.integration.test.ts` invocations exit 0
- [ ] Baseline JSON field `load_1min_at_start` < 4; the implementation log
  contains a mode table where the markdown-mode mean_ms_per_frame delta vs
  the plain mode is ≤ 1σ OR carries a citable cause row

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Edge cases absorbed

(from the discovery plan MUST-FIX set: EC-1 unclosed fence → T1.1 oracle;
EC-2 verbatim code spans → T1.1/T2.1 oracles; EC-3 default-off
byte-identity → T2.1 oracle; EC-4 degrade → T2.1 monochrome snapshot;
EC-5 per-frame parse → T3.1 bench mode)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M13 DoD-1: MarkdownText AI-chat subset (ROADMAP § M13) | T1.1, T2.1 | grammar model + render dispatch |
| 2 | M13 DoD-2: fences → CodeBlock + degrade ladder (ROADMAP § M13) | T1.1, T2.1 | fence nodes routed; monochrome/pipe oracles |
| 3 | M13 DoD-3: ChatMessage opt-in, raw default (ROADMAP § M13) | T2.1 | default-off byte-identity oracle |
| 4 | M13 DoD-4: zero new deps OR audited dep (ROADMAP § M13) | T1.1 | hand-rolled (blueprint D1); manifest pinned |
| 5 | M13 DoD-5: example + smoke + bench + gates (ROADMAP § M13) | T3.1 | rendered-shape smoke; markdown bench mode |
| 6 | M13 risk-1: parser-dep vs hand-rolled tension (ROADMAP § M13) | T1.1 | resolved by blueprint D1 (gemini-proven grammar) |
| 7 | M13 risk-2: wrap/width under narrow columns (ROADMAP § M13) | T2.1 | width oracle (f) + CodeBlock's existing truncation |
| 8 | Streaming partial safety (blueprint EC-1) | T1.1 | unclosed-fence oracle |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Hand-rolled grammar drifts from CommonMark corner cases | Medium | scope is the AI-chat subset; malformed input falls through as literal (never crashes); gemini runs this shape in production | implement |
| Per-frame re-parse cost on long streaming messages | Medium | benched (T3.1); model is allocation-light; consumer may memoize | implement |
| Inline regex catastrophic backtracking on adversarial input | Low | gemini's alternation is linear-ish; add a length guard test with a pathological string | implement |
| Tables absent (peers render them) | Low | recorded known-gap; M-future when dogfood demands | roadmap |

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D3.)

## Test Plan

Grammar unit oracles (model) + render oracles + byte-identity + degrade +
smoke + bench contract; discipline per `.claude/rules/testing.md` (§ 4.1
negative cases — malformed markers; § 6 determinism — no timers involved).
Two consecutive full runs green.

## Final Phase: Integration Validation (MANDATORY)

- `run_validation.py m13-markdown-renderer` exit 0; `/code-quality` PASS;
  coverage: model + dispatch 100% lines.
- Review (multi-role) BEFORE any release — the release chain (0.14.0
  minor) runs only on READY_TO_MERGE (M10 DV-1 rule).

## Global Definition of Done

- [ ] All tasks committed gates-gated (1 task = 1 commit)
- [ ] 483+ tests green; zero weakened tests
- [ ] ≤ 2 new snapshots; manifest untouched
- [ ] Bench baseline re-recorded with the markdown mode; load recorded
- [ ] Plan archived post-release
