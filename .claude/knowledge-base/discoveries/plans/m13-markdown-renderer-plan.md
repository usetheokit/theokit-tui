---
slug: m13-markdown-renderer
milestone_id: M13
created_at: 2026-07-08
question: How do production Ink agent CLIs render assistant Markdown (block + inline + fences) without a parser dependency, and how does that stay theme-driven, streaming-safe and deterministic under our degrade ladder?
---

# Discovery Plan: m13-markdown-renderer

## Context

M13 adds `MarkdownText` + a `ChatMessage` `markdown` opt-in (ROADMAP § M13).
Fase A findings: gemini-cli renders Markdown with a HAND-ROLLED line-scanner
+ inline tokenizer (`MarkdownDisplay.tsx` 456 lines,
`markdownParsingUtils.ts` 255 lines, `InlineMarkdownRenderer.tsx` 27 lines —
zero parser dep; lowlight for fences, which is ALREADY our CodeBlock dep);
mastracode uses `marked@15` + cli-highlight/shiki (dep-heavy). Our house
facts: `CodeBlock` (276 LoC, lowlight) ships since M4; theme is DATA-driven
(monochrome tokens), never env-driven; ink7 pipe = one final frame.

## Objective

Blueprint locking: parser strategy (hand-rolled subset vs marked), the block
grammar subset, the inline strategy (ANSI strings à la gemini vs nested
`<Text>` theme tokens), streaming-partial behavior (unclosed fence), the
oracle set and the evidence plan.

## In-Scope / Out-of-Scope

**In:** block subset (headings, ul/ol lists, hr, paragraphs, fenced code),
inline subset (bold, italic, inline-code, strikethrough, links), fence →
CodeBlock routing, `ChatMessage` opt-in, degrade ladder.
**Out:** tables (gemini has TableRenderer — defer, known-gap), LaTeX→Unicode
(gemini issue-#25656 machinery — YAGNI), raw-markdown passthrough mode,
images, footnotes, nested blockquotes.

## ADRs

### D1 — Hand-rolled subset parser, zero new deps (preliminary)

**Decision shape:** gemini-proven line-scanner (regex per block kind, state
machine for fences) + inline tokenizer; no marked/micromark.
**Alternatives:** `marked@15` (mastracode path — new dep + CVE surface +
lexer AST we'd mostly discard); micromark (same).
**Consequences:** Q1 must extract the exact grammar regexes + the
fence-state machine; Q2 the inline tokenizer contract.

### D2 — Inline styles as nested ink `<Text>` with theme tokens (preliminary)

**Decision shape:** tokenizer → segment array `{text, styles}` → nested
`<Text bold/italic/...>` children colored by THEME tokens — never chalk
strings (gemini uses chalk→ANSI, but their color system is env/config-
driven; ours is data-driven monochrome-aware).
**Alternatives:** chalk ANSI strings (gemini; rejected shape: bypasses our
theme contract + NO_COLOR data-driven degrade).
**Consequences:** Q2 verifies ink nested-Text style composition; Q3 pins
degrade behavior (bold/dim SGR under monochrome themes).

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | gemini block grammar: the exact header/fence/ul/ol/hr regexes, the fence state machine (open/close matching, EOF-closes-open-fence for streaming partials), empty-line spacer collapsing, list indentation model | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/MarkdownDisplay.tsx` | Grep `Regex\|inCodeBlock` | Read end-to-end (done in Fase A — 456 lines) | Grammar table + state machine — citations |
| Q2 | gemini inline tokenizer: marker set (`**`/`*`/`_`/`~~`/backticks/`<u>`/links), nesting/precedence rules, code-span masking, the plain-text early return; and our ink nested-Text composition check (bold inside colored Text) | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/markdownParsingUtils.ts`, our `src/chat-message.tsx` | Grep `MARKER_LENGTH\|tokenize` | Read the tokenizer loop end-to-end | Inline contract + precedence — citations |
| Q3 | Oracle set: block-kind coverage (each grammar rule ≥ 1 test), inline nesting cases, streaming partial (unclosed fence renders as code), degrade matrix (monochrome/NO_COLOR/pipe scenes), width behavior (long lines wrap), ChatMessage opt-in default-off pin; snapshot budget | tests | our `src/chat-message.test.tsx`, `src/code-block.test.tsx` idioms, `tests/degrade-matrix.integration.test.tsx`, gemini `MarkdownDisplay.test.tsx` | Grep gemini's test cases | Read their oracle shapes; design ours | Oracle set + budget — citations |
| Q4 | Deps verdict: confirm zero new deps (lowlight already ours via CodeBlock; no chalk — theme tokens); confirm mastracode's marked path is strictly worse for a LIB (dep weight + license fine, but CVE surface + AST discard) | deps | our `package.json`, `.claude/knowledge-base/references/mastra/mastracode/package.json`, gemini's cli `package.json` | Grep dep manifests (done Fase A) | Confirm the composition surface | Rule 9 verdict — citations |
| Q5 | Evidence: bench decision (markdown parse runs per message render — per-frame path when streaming? M9 flip condition analysis), example (`examples/chat.tsx` gains a markdown assistant message) + smoke asserts, CodeBlock routing proof (fence language reaches lowlight) | tools | our `benchmarks/chat-message.bench.tsx`, `examples/chat.tsx`, `tests/example-chat.integration.test.ts` | Map the bench + example surface | Decide bench mode + example shape | Evidence plan — citations |

## Edge-case annotations (MUST-FIX absorbed)

- **MUST-FIX EC-1 (→ Q1/Q3):** streaming partial — an UNCLOSED fence at
  text end must render as code (gemini EOF branch,
  `MarkdownDisplay.tsx:287-300`); a naive parser drops the tail.
- **MUST-FIX EC-2 (→ Q2/Q3):** inline-code spans are VERBATIM — `**` inside
  backticks must not bold (gemini masks code spans; our tokenizer must
  order code-span extraction first).
- **MUST-FIX EC-3 (→ Q3):** default OFF — `ChatMessage` without `markdown`
  renders byte-identical to today (regression guard over the whole
  existing suite).
- **MUST-FIX EC-4 (→ Q3):** degrade — monochrome theme keeps bold/italic
  SGR legal (they are not colors) but drops color tokens; pipe scene
  byte-stable.
- **MUST-FIX EC-5 (→ Q5):** if MarkdownText re-parses on every streaming
  repaint, that IS a per-frame path → the M9 flip condition fires and the
  bench must measure parse+render per frame.

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q3 | Covered |
| Dependencies | Q4 | Covered |
| Tools | Q5 | Covered |
| Techniques | Q1, Q2 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

- Q1/Q2 done: grammar + inline verdicts with citations.
- Q3/Q4/Q5 done: oracle set + deps verdict + evidence plan.
- Blueprint: 4 corners, ADRs final.

## Acceptance Criteria

- Every question `done`; citations resolve; blueprint ≥ SHIPPABLE_WITH_CAVEATS.

## Global Definition of Done

- Blueprint at `discoveries/blueprints/m13-markdown-renderer-blueprint.md`
  consumable task-by-task by the M13 plan.
