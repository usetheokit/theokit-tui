---
slug: m16-tool-card-variants
milestone_id: M16
created_at: 2026-07-08
question: How do production agent CLIs render tool results by kind (diff for edits, output box for shells, capped preview for reads) on one card surface, and what is the minimal discriminated-union API over our existing DiffViewer/ToolResult primitives?
---

# Discovery Plan: m16-tool-card-variants

## Context

M16 ships per-kind tool cards (ROADMAP § M16) as PURE composition of
existing primitives. Fase A findings: gemini `ToolResultDisplay.tsx`
(308 lines) dispatches by result SHAPE — string → MarkdownDisplay/plain,
`fileDiff` in object → DiffRenderer, array → AnsiOutputText, structured
→ summary (:100-175); `ShellToolMessage.tsx` (222 lines) is the bash
surface. Our surfaces: `ToolCallCard` (144-line file; header + indented
children, ADR D3 no borders), `ToolResult` (275 — shell envelope
stdout/stderr/exitCode aware, collapsed/expanded), `DiffViewer` (271 —
unified diff via `parseUnifiedDiff`), `CodeBlock`, `MarkdownText` (M13).

## Objective

Blueprint locking: the discriminated-union `result` API on ToolCallCard,
the per-kind render dispatch (diff/output/preview), cap semantics for
read previews, degrade behavior, oracle set + snapshot budget (≤ 3 per
DoD), and the evidence plan.

## In-Scope / Out-of-Scope

**In:** `ToolCallCardProps.result?` union — `{kind:"diff"}` (unified
patch → DiffViewer), `{kind:"output"}` (shell envelope → ToolResult),
`{kind:"preview"}` (text → capped CodeBlock/plain); coexistence rules
with `children`; degrade ladder.
**Out:** tool approval dialogs (mastracode machinery — app concern);
markdown tool output (gemini renderOutputAsMarkdown — consumers can
compose MarkdownText as children already); ANSI array output (gemini
AnsiOutputText — our ToolResult owns envelope rendering); image/binary
previews.

## ADRs

### D1 — Discriminated-union `result` prop; children remain the escape hatch (preliminary)

**Decision shape:** `result?: ToolCardResult` where `ToolCardResult =
{kind:"diff", patch, fileName?} | {kind:"output", stdout?, stderr?,
exitCode?} | {kind:"preview", text, language?, maxLines?}`; the card
renders the matching primitive as its body; `children` still accepted
(rendered AFTER the result body — or mutually exclusive? Q3 pins).
**Alternatives:** separate components (ToolDiffCard/ToolShellCard… —
export bloat); kind on ToolCall itself (conflates lifecycle with
result rendering).
**Consequences:** Q1 verifies gemini's shape-dispatch precedence; Q3
the children-coexistence contract.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad) | Fase B (deep) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | gemini dispatch precedence + width/height plumbing into DiffRenderer/AnsiOutput (:100-175 read); what the card passes down (childWidth, availableHeight) and what we need (our primitives are width-aware already) | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolResultDisplay.tsx` | done | re-read the dispatch chain + ShellToolMessage | Dispatch recipe — citations |
| Q2 | Our primitives' embedding contracts: ToolResult props (envelope, collapsed?), DiffViewer props (patch string, maxLines/contextLines), CodeBlock caps — what the union must forward (and what stays fixed, KISS) | techniques | our `src/tool-result.tsx`, `src/diff-viewer.tsx`, `src/code-block.tsx` | grep prop interfaces | read the three prop contracts | Forwarding table — citations |
| Q3 | Oracle set: per-kind render (diff rows inside the card indentation, output box envelope, preview capped with trailer), malformed patch (DiffViewer's typed error surfaces or degrades?), children+result coexistence, degrade scenes, snapshot budget ≤ 3 | tests | our `src/tool-call.test.tsx`, `src/diff-viewer.test.tsx` idioms | grep existing card tests | design oracles | Oracle set + budget — citations |
| Q4 | Deps: zero new (pure composition); confirm no new manifest lines | deps | our `package.json` | — | — | Rule 9 verdict |
| Q5 | Evidence: bench decision (the card body renders per status repaint during streaming — does the diff/preview re-render per frame? The card is typically static-once-complete; analyze honestly vs the M9 flip condition), example (`examples/agent.tsx` or stream gains per-kind cards), smoke asserts | tools | our `benchmarks/tool-cards.bench.tsx` (exists — M2), `examples/stream.tsx` | map the existing tool bench | decide mode addition vs re-run | Evidence plan — citations |

## Edge-case annotations (MUST-FIX absorbed)

- **MUST-FIX EC-1 (→ Q3):** malformed unified patch in `{kind:"diff"}` —
  DiffViewer throws a typed error by contract; the CARD must let it
  propagate (fail-fast, never a silent empty body) — pinned.
- **MUST-FIX EC-2 (→ Q3):** `{kind:"preview"}` with text longer than
  `maxLines` caps with the HEAD retained + dim trailer (CodeBlock's
  existing cap semantics — forward, don't reimplement).
- **MUST-FIX EC-3 (→ Q3):** `result` + `children` together — pin ONE
  contract (children render below the result body; both is legal — the
  card is a layout surface).
- **MUST-FIX EC-4 (→ Q5):** snapshot budget ≤ 3 TOTAL (DoD) across kind
  × theme — anchored, one per kind, monochrome covered by asserts not
  snapshots.

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q3 | Covered |
| Dependencies | Q4 | Covered |
| Tools | Q5 | Covered |
| Techniques | Q1, Q2 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

- Q1/Q2 done: dispatch + forwarding verdicts with citations.
- Q3/Q4/Q5 done: oracle set + deps verdict + evidence plan.
- Blueprint: 4 corners, ADRs final.

## Acceptance Criteria

- Every question `done`; citations resolve; blueprint ≥ SHIPPABLE_WITH_CAVEATS.

## Global Definition of Done

- Blueprint at `discoveries/blueprints/m16-tool-card-variants-blueprint.md`
  consumable task-by-task by the M16 plan.
