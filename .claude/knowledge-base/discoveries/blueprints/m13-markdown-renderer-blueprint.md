---
slug: m13-markdown-renderer
milestone_id: M13
created_at: 2026-07-08
discovery_plan: .claude/knowledge-base/discoveries/plans/m13-markdown-renderer-plan.md
question: How do production Ink agent CLIs render assistant Markdown without a parser dependency, theme-driven, streaming-safe and deterministic under our degrade ladder?
---

# Blueprint: m13-markdown-renderer

## Context

gemini-cli's full markdown pipeline read end-to-end (456+255+27 lines,
zero parser dep, lowlight fences); mastracode's `marked@15` path checked
and rejected for a lib. Q1–Q5 all `done`.

## Objective

Lock the parser strategy (hand-rolled subset), the grammar, the inline
segment model (theme tokens, not chalk), streaming-partial behavior, the
oracle set and the bench decision.

## Cross-cutting Comparison

| Aspect | gemini | mastracode | OURS |
|---|---|---|---|
| parser | hand-rolled line-scanner + inline regex (`MarkdownDisplay.tsx:62-69` block regexes; `markdownParsingUtils.ts:125-127` single alternated inline regex) | `marked@15` + cli-highlight/shiki (`mastracode/package.json`) | gemini shape — zero new deps (D1) |
| inline styling | chalk → ANSI string in ONE `<Text>` (`InlineMarkdownRenderer.tsx:17-25`) | terminal writes | segment array → nested `<Text>` with THEME tokens (D2 — our monochrome contract is data-driven) |
| fences | `colorizeCode` (lowlight) with pending-truncation (`MarkdownDisplay.tsx:327-398`) | shiki | route to our existing `CodeBlock` (lowlight already ours) |
| streaming partial | EOF closes an open fence — tail renders as code (`MarkdownDisplay.tsx:287-300`) | n/a | same EOF branch (EC-1) |
| tables / LaTeX | TableRenderer + latexToUnicode masking machinery | marked | OUT (YAGNI; known-gap recorded) |

## Recommendations

1. `MarkdownText` (new module `src/markdown-text.tsx`): block line-scanner
   (headings 1–4, ul/ol, hr, paragraph, fenced code with `` ``` ``/`~~~`
   open-close length matching) + inline tokenizer (bold/italic/bold-italic/
   strikethrough/inline-code/links/bare-URLs) → nested `<Text>` styled by
   theme tokens.
2. `ChatMessage` gains `markdown?: boolean` (default false — EC-3 pins
   byte-identity for every existing call site).
3. Fences render through the EXISTING `CodeBlock` (language forwarded).
4. Bench: the parse runs on every streaming repaint — per-frame path, the
   M9 flip condition FIRES → markdown mode added to the chat-message bench
   (or own bench) with a committed baseline.

## Coverage Corner 1 — Integration Tests

Oracle set: (a) block coverage — one test per grammar rule (h1–h4, ul, ol,
hr, paragraph, fence with/without language); (b) inline coverage — bold,
italic (incl. the word-boundary guards `markdownParsingUtils.ts:168-180`:
`intra*word` stays literal), bold-italic, strikethrough, inline-code
VERBATIM (`**` inside backticks not bolded — EC-2, gemini masks spans;
backtick-count spans `` `a` ``/``` ``a`` ```), link → "text (url)" shape
(`markdownParsingUtils.ts:215-227`), bare URL; (c) streaming partial —
unclosed fence at EOF renders as code (EC-1); (d) default-off byte-identity
— `ChatMessage` without `markdown` === today's output on a live render
(EC-3), full existing suite untouched; (e) degrade — monochrome theme
scene (bold/italic SGR legal, no color SGR), pipe scene stable (EC-4);
(f) width — long paragraph wraps, long code line hits CodeBlock's existing
truncation; (g) empty-line collapsing (consecutive blanks → one spacer,
`MarkdownDisplay.tsx:268-274`). Snapshot budget ≤ 2 (one rich composed
scene + one monochrome degrade), anchored.

## Coverage Corner 2 — Dependencies

**Zero new.** lowlight is already the CodeBlock dep; NO chalk (ink nested
`<Text>` + theme tokens); NO marked/micromark (D1 — mastracode's path
carries a lexer AST we'd discard + CVE surface). Rule 9 PASS: the wheel
being reused is gemini's PROVEN grammar, not a package.

## Coverage Corner 3 — Tools

**Bench (REQUIRED):** streaming repaint re-parses the message text every
frame — per-frame path ⇒ M9 flip condition. Add a `markdown` mode to
`benchmarks/chat-message.bench.tsx` (append-tokens workload over a
markdown-rich message) with baseline committed alongside the existing
modes; load-gated, FORCE_COLOR=1, stack provenance, `load_1min_at_start`
(M12 convention). **Example/smoke:** `examples/chat.tsx` — one assistant
message becomes markdown-rich (heading + bold + fence); smoke asserts the
RENDERED shapes (no literal `**`/```` ``` ```` in output; fence content
present) under the ink7 single-final-frame pipe contract.

## Coverage Corner 4 — Techniques

**Block grammar (gemini-proven, `MarkdownDisplay.tsx:62-69`):**
`^ *(#{1,4}) +(.*)` heading; `` ^ *(`{3,}|~{3,}) *(\w*?) *$ `` fence
(close requires same char AND ≥ open length, `:91-116`); `^([ \t]*)([-*+])
 +(.*)` ul; `^([ \t]*)(\d+)\. +(.*)` ol; `^ *([-*_] *){3,} *$` hr. State
machine: `inCodeBlock` accumulates verbatim lines; EOF with open fence
emits the code block anyway (streaming safety, `:287-300`); consecutive
empty lines collapse to one spacer Box (`:268-274`).

**Inline tokenizer (single alternated regex, `markdownParsingUtils.ts:125-127`):**
`***bold-italic***` → `**bold**` → `*italic*`/`_italic_` (with word-
boundary + path guards `:168-180`) → `~~strike~~` → `[t](u)` →
`` `+code`+ `` (backtick-count matching `:206-210`) → `<u>` (we DROP <u>
— not in our subset) → bare URL. Recursion inside markers for nesting;
unmatched/malformed falls through as literal text. OUR adaptation: emit
`{text, styles: {bold?, italic?, strikethrough?, code?, link?}}` segments
→ nested `<Text>`; code segments take the theme accent; links render
"text (url)" with url in accent (no OSC-8 — YAGNI).

**Theme/degrade:** all colors via `useTheoTheme` tokens; monochrome themes
zero the color axis while bold/italic/strikethrough SGR remain (attributes,
not colors — same contract the ToolCall dim styling pinned at M10).

**Streaming:** `MarkdownText` is a pure function of `text` — no state, no
memo requirement (memoization is the CONSUMER's option); re-parse per
repaint is the benched cost.

## ADRs

### D1 — Hand-rolled subset parser, zero new deps (FINAL)

Per Corner 4. **Alternatives:** marked@15 (rejected: new dep + CVE surface
+ AST discard — mastracode is an APP, deps are cheaper there); micromark
(same); porting gemini's chalk/LaTeX/table machinery wholesale (rejected:
YAGNI — our subset is the AI-chat 90%).

### D2 — Inline segments → nested `<Text>` theme tokens (FINAL)

Per Corner 4. **Alternatives:** chalk ANSI strings (gemini; rejected:
bypasses the data-driven theme/monochrome contract and adds a chalk
coupling the lib doesn't have today).

### D3 — Evidence: markdown bench mode + example/smoke (FINAL)

Per Corner 3. **Alternatives:** no bench claiming "parse is cheap"
(rejected: per-frame path is a recorded flip condition — measure, don't
assume).
