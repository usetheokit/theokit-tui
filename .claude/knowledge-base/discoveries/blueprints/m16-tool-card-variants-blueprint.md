---
slug: m16-tool-card-variants
milestone_id: M16
created_at: 2026-07-08
discovery_plan: .claude/knowledge-base/discoveries/plans/m16-tool-card-variants-plan.md
question: How do production agent CLIs render tool results by kind on one card surface, and what is the minimal discriminated-union API over our existing primitives?
---

# Blueprint: m16-tool-card-variants

## Context

gemini `ToolResultDisplay.tsx` dispatch read (:100-175): shape-based
precedence (JSON → subagent → string(markdown|plain) → structured →
`fileDiff` → array/ansi); `ShellToolMessage.tsx` (222) is the shell
surface. Our embedding contracts read: `ToolResult` (children/lines/
shell EXCLUSIVE + maxLines/expanded), `DiffViewer` (patch + maxLines +
contextLines, typed malformed-patch error), `CodeBlock` (code/language/
maxLines HEAD-retained cap). `ToolCallCard` renders header + indented
children (no borders, M2 D3). Q1–Q5 all `done`.

## Objective

Lock the union API, dispatch, forwarding table, coexistence contract,
oracle set (snapshot ≤ 3) and honest evidence plan.

## Cross-cutting Comparison

| Aspect | gemini | OURS |
|---|---|---|
| dispatch | by result SHAPE with implicit precedence (`ToolResultDisplay.tsx:100-175`) | EXPLICIT discriminated union `result.kind` (no shape sniffing — typed API, KISS) |
| diff | `fileDiff` key → DiffRenderer w/ width/height plumbing | `{kind:"diff", patch, fileName?}` → our DiffViewer (already width-aware; maxLines/contextLines forwarded) |
| shell | ShellToolMessage + AnsiOutputText | `{kind:"output", shell: ShellEnvelope, maxLines?, expanded?}` → our ToolResult (envelope mode) |
| read preview | string branch (markdown|plain) | `{kind:"preview", text, language?, maxLines?}` → our CodeBlock (language) or capped plain lines via ToolResult when no language |
| card body | width plumbing per child | children-indent surface REUSED — the result body renders exactly where children render today |

## Recommendations

1. `ToolCardResult` union type + `result?` on `ToolCallCardProps`;
   dispatch inside `ToolCallCard` (a small `ResultBody` internal).
2. Forwarding table (KISS — only what the union declares):
   diff → `patch`, `fileName` (rendered as a dim header line above the
   viewer — DiffViewer has per-file headers already; fileName is ONLY
   for patches lacking headers), `maxLines?`, `contextLines?`;
   output → `shell`, `maxLines?`, `expanded?`;
   preview → `text`, `language?`, `maxLines?` (CodeBlock cap semantics).
3. Coexistence (EC-3): `result` body renders FIRST, `children` BELOW it
   — both legal (the card is a layout surface).
4. Malformed patch (EC-1): DiffViewer's typed error PROPAGATES — the
   boundary validated the union kind, the payload contract belongs to
   the primitive (fail-fast, error-handling.md § 2).

## Coverage Corner 1 — Integration Tests

Oracle set: (a) diff kind — patch rows render inside the card indent
(indicator-width padding preserved), status header intact; (b) output
kind — envelope `stdout:`/`stderr:`/exit-code rows via ToolResult,
collapsed by default, `expanded` forwarded; (c) preview kind — language
routes to CodeBlock (plain-first, no highlight race — M13 snapshot
precedent), `maxLines` caps HEAD-retained with dim trailer; no language
→ plain lines; (d) coexistence — result + children: children below
(EC-3); (e) malformed patch throws DiffViewer's typed error (EC-1 —
`expect(...).toThrow(/DiffViewer|patch/)`); (f) unknown `kind` at the JS
boundary → TypeError naming ToolCallCard (exhaustiveness, negative
case); (g) degrade — monochrome asserts (no color SGR; diff signs/
envelope glyphs survive — they are the color-independent channel per
house degrade rules); (h) each kind under `status="running"` vs
`"success"` (header/status independence). Snapshots ≤ 3: one per kind,
anchored; monochrome via asserts only (EC-4).

## Coverage Corner 2 — Dependencies

**Zero new.** Pure composition of ToolResult/DiffViewer/CodeBlock —
all internal. Rule 9 PASS.

## Coverage Corner 3 — Tools

**Bench decision (honest):** the card body is STATIC once the result
arrives — results render once, not per streaming frame (unlike M13
markdown streaming). The M9 flip condition does NOT fire for a
render-once path; the EXISTING `tool-cards.bench.tsx` (M2) already
measures card churn under status flips. Evidence = ONE load-gated
re-run of the existing tool-cards bench vs its current baseline (the
M11 headerless-re-run precedent: benched file touched ⇒ re-run, not a
new mode) + a no-new-bench rationale recorded in the implementation
log. Flip condition: if a result kind ever animates (e.g. progressive
diff reveal), it gets its own mode.
**Example/smoke:** `examples/stream.tsx` tool events gain per-kind
results (one diff, one output, one preview) — smoke asserts the diff
`+`/`-` signs, the `stdout:` label and the preview cap trailer render
(deterministic under the pipe contract).

## Coverage Corner 4 — Techniques

**Union dispatch:** `switch (result.kind)` with an exhaustiveness
`never` guard throwing TypeError (the M13 v8-ignore precedent applies
only if unreachable — here the JS boundary makes it REACHABLE: validate
`kind` explicitly at the top instead, fail-fast, and keep the switch
total for TS).

**Indent surface reuse:** the card already indents children by the
indicator width — the result body mounts in the SAME slot (`ToolCallCard`
body Box), so per-kind bodies inherit alignment for free (Q1's gemini
width-plumbing is unnecessary — our primitives are width-aware).

**Preview language routing:** `language` present → CodeBlock (plain-
first render is deterministic — the M13 snapshot finding: lowlight's
dynamic import never resolves before the first frame); absent →
ToolResult `lines` mode (no highlight machinery for prose).

## ADRs

### D1 — Explicit discriminated union over shape sniffing (FINAL)

`{kind:"diff"|"output"|"preview"}` typed API. **Alternatives:** gemini's
shape detection (rejected: implicit precedence is exactly what a typed
lib API should NOT export); separate components per kind (rejected:
export bloat; the card IS the surface).

### D2 — Payload contracts stay with the primitives (FINAL)

The card validates `kind`; DiffViewer/ToolResult/CodeBlock keep their
own typed validation (malformed patch PROPAGATES — EC-1).
**Alternatives:** card-level payload validation (rejected: duplicates
tested contracts — DRY).

### D3 — Evidence: existing tool-cards bench re-run; no new mode (FINAL)

Render-once bodies are not a per-frame path — the honest analysis says
re-run, not new mode. **Alternatives:** a diff-card bench mode
(rejected: measures a static render; the M9 flip condition names
per-frame paths).
