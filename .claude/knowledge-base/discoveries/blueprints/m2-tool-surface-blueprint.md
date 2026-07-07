# Blueprint: M2 Tool-use surface — ToolCall/ToolCallCard/ToolResult + status lifecycle

> **Version 1.0** — Synthesizes the deep research over `gemini-cli` (production tool-message
> family: status maps, truncation, shell envelope), `assistant-ui/react-ink` (ToolFallback
> card + ink-spinner usage), `ink-ui` (spinner internals) and `codex` (exec_cell head/tail
> truncation) into the locked M2 decisions: 4-status lifecycle, card anatomy, tail-retention
> truncation with "+N lines" indicator, shell-envelope layout, ink-spinner adoption, spinner
> test determinism, and the bench design. All 6 research questions answered; 0 blocked.

**Slug:** `m2-tool-surface`
**Source plan:** `.claude/knowledge-base/discoveries/plans/m2-tool-surface-plan.md`
**Owner:** paulohenriquevn + Claude (assisted)
**Generated:** 2026-07-06 via `/discover-execute`
**Confidence verdict:** SHIPPABLE (98.7/100 — 2026-07-06, zero caps)

## Context

Inherited from the discovery plan: `ROADMAP.md § M2` — ToolCall/ToolCallCard with status
lifecycle (running → success/failed), ToolResult (collapsed/expanded; shell-envelope aware),
spinner while running (ink-spinner), snapshots across statuses + long/truncated output. Risks:
long output overflowing; status transitions racing the stream.

## Objective

Enable `/to-plan` to write the M2 plan with zero unresolved design questions.

---

## Coverage Corner 1 — Integration Tests

*(Answers Q4.)*

- **Spinner determinism (ink-ui idiom):** real timers + exhaust the animation
  (`await delay(frames.length * interval)`) + dedup `[...new Set(frames)]` + exact set equality —
  `.claude/knowledge-base/references/ink-ui/test/spinner.tsx:10-26`.
- **Status transitions:** stateful wrapper exposing `setStatus`, mutate inside `act()`, assert
  the post-transition frame —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ShellToolMessage.test.tsx:89-127`.
- **Truncation oracles:** line presence/absence + the "hidden" indicator string —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolResultDisplayOverflow.test.tsx:14-106`
  (`overflowDirection='top'` keeps tail: `not.toContain('Line 1')`, `toContain('Line 5')`).
- **Animated children are MOCKED in gemini's component tests** (`vi.mock('../GeminiRespondingSpinner.js')`) —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolMessage.test.tsx:22-38`;
  the only real animation test is ink-ui's.

### Synthesis for M2

Our `renderFrame` captures ONE tick (0ms) — BEFORE ink-spinner's first interval (dots ≈ 80ms) —
so a `running` snapshot deterministically shows frame[0]; no fake timers, no mocking. One
animation test may use the ink-ui exhaust+dedup idiom against `cli-spinners.dots`. Transition
tests use `rerender` with a new `status` prop (our stdin/settle kit unnecessary — status is a
prop per D3). Truncation tests use the gemini line-oracle idiom.

---

## Coverage Corner 2 — Dependencies

*(Answers Q5.)*

- **Adoption (pre-validated):** BOTH analogs ship ink-spinner —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:46`
  (`"ink-spinner": "^5.0.0"`),
  `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json:54` (`"ink-spinner": "5.0.0"`).
- **Usage shape:** `<Text color={...}><Spinner type="toggle|line"/></Text>` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/CliSpinner.tsx:7,32`;
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/toolCall/ToolFallback.tsx:1-125`
  (running → `<Spinner type="line"/>` in yellow).
- **What a spinner needs (hand-roll cost):** cli-spinners frames + interval hook with cleanup +
  theme — ~60 LoC across 3 files —
  `.claude/knowledge-base/references/ink-ui/source/components/spinner/use-spinner.ts:1-38`.
- **Gotcha found:** ink-ui requires `cli-spinners` at runtime but does NOT declare it as a
  dependency for consumers (packaging gap) — evidence that hand-rolling invites dependency
  mistakes.

**Verdict (D2 resolved): adopt `ink-spinner ^5.0.0`** — production-proven by both analogs, tiny,
canonical. Peer ranges (ink/react) confirmed at `/deps-audit` via registry. Fallback if peers
conflict with ink ^5 + react ^18: ~30-line internal hook modeled on ink-ui's.

---

## Coverage Corner 3 — Tools

*(Answers Q6.)*

- **gemini height plumbing:** `availableTerminalHeight` threaded down; constants
  `TOOL_RESULT_STATIC_HEIGHT=1`, reserved 4 (standard) / 6 (ASB), min 2 lines;
  `ACTIVE/COMPLETED_SHELL_MAX_LINES = 15` (content ≈ 10 lines) —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/utils/toolLayoutUtils.ts:13-65`;
  multi-card height split —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolGroupMessage.tsx:294-302`;
  pre-truncation char cap `MAXIMUM_RESULT_DISPLAY_CHARACTERS = 20000` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/shared/SlicingMaxSizedBox.tsx:12`.
- **codex line caps (terminal-size-independent):** `TOOL_CALL_MAX_LINES = 5`,
  `USER_SHELL_TOOL_CALL_MAX_LINES = 50`; head+tail with
  `… +{omitted} lines (ctrl + t to view transcript)` when `total > 2 * limit` —
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/exec_cell/render.rs:32-35, 136-183, 254-260`.
- **M2 bench design:** extend our harness with `benchmarks/tool-cards.bench.tsx` — workload:
  thread of 100 messages + 50 tool cards (mixed statuses) mounted, then 150 status transitions
  (running→success/failed) + one 500-line output card at `maxLines` 10; same metrics
  (frames, mean/peak ms ± std dev, pinned env) → `docs/benchmarks/m2-tool-cards-baseline.json`.

---

## Coverage Corner 4 — Techniques

*(Answers Q1, Q2, Q3.)*

### Q1 — Card anatomy + status lifecycle

- **gemini status enums:** core 7-state → display 6-state map —
  `.claude/knowledge-base/references/gemini-cli/packages/core/src/scheduler/types.ts:26-34`,
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/types.ts:63-96`.
- **Glyphs:** `TOOL_STATUS = { SUCCESS:'✓', PENDING:'o', EXECUTING:'⊷', CONFIRMING:'?',
  CANCELED:'-', ERROR:'x' }` + `STATUS_INDICATOR_WIDTH = 3` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/constants.ts:20-27`,
  `.../messages/ToolShared.tsx:29`.
- **Status→color:** success/pending → `theme.status.success`; error → `theme.status.error` bold;
  executing → spinner in warning/active — `.../messages/ToolShared.tsx:145-190`.
- **Card layout:** header (indicator + bold name + dim description, 1 line) + body (bordered
  left/right, `paddingX 1`) — `.../messages/ToolMessage.tsx:45-165`, `ToolShared.tsx:202-259`
  (canceled gets strikethrough).
- **react-ink ToolFallback:** running → `<Spinner type="line"/>`; STATUS_ICONS/COLORS maps —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/toolCall/ToolFallback.tsx:1-125`.
- **Transitions re-render via plain prop change** — no memo on the indicator (low-frequency
  updates); react-ink memoizes at the thread-row level (our M1 contract already provides this).

### Q2 — Long-output handling

- **gemini standard mode:** tail retention (recent output wins), indicator
  `... first/last N line(s) hidden (key to show)`, expansion = global `constrainHeight`
  toggle — `.../messages/ToolResultDisplay.tsx:58-62, 219-253`,
  `.../shared/MaxSizedBox.tsx:88-141`.
- **codex:** symmetric head+tail with `… +N lines` when `total > 2×limit` (evidence above).
- **Markdown vs plain:** gemini routes by result type (`renderOutputAsMarkdown`, JSON
  pretty-print, ANSI arrays) — `.../messages/ToolResultDisplay.tsx:91-185`.

### Q3 — Shell envelope

- **Command echo:** `$ ` prefix in symbol color —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/UserShellMessage.tsx:42-43`.
- **stdout/stderr:** gemini interleaves ANSI as-is (no labels; colors carry the distinction) —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/AnsiOutput.tsx:56-75`.
- **Exit code:** shown ONLY when non-zero, red `exited {code}`; success = green, no code —
  `.claude/knowledge-base/references/codex/codex-rs/exec/src/event_processor_with_human_output.rs:137-142`.
- **Empty output:** codex silently drops —
  `.../event_processor_with_human_output.rs:157-161`.

## Cross-cutting Comparison

| Dimension | gemini-cli | react-ink | codex | ink-ui |
|---|---|---|---|---|
| Status set | 6 display states (`types.ts:63-70`) | running/success/error icons (`ToolFallback.tsx`) | per-command status lines | n/a |
| Spinner | ink-spinner `type="toggle"` (`CliSpinner.tsx:32`) | ink-spinner `type="line"` | n/a (Rust) | own hook + cli-spinners (`use-spinner.ts`) |
| Truncation | tail-retention + hidden-indicator (`MaxSizedBox.tsx:138-141`) | n/a at card level | head+tail `… +N lines` (`render.rs:254-260`) | n/a |
| Shell envelope | ANSI interleave, `$` echo | n/a | red `exited {code}` non-zero only | n/a |
| Animation tests | mocked away (`ToolMessage.test.tsx:22-38`) | n/a | n/a | exhaust+dedup frames (`test/spinner.tsx:10-26`) |

## ADRs

### D1 — Status lifecycle: 4 states (`pending | running | success | failed`), exported as `ToolCallStatus`

**Decision:** M2 ships `"pending" | "running" | "success" | "failed"`. Glyph/color map:
pending `o` (gray, `role.system.prefix` affordance), running = ink-spinner `dots` in
`status.warning`, success `✓` in `status.success`, failed `x` bold in `status.error`.
`STATUS_INDICATOR_WIDTH = 3` alignment adopted.

**Rationale:** Roadmap DoD names running → success/failed; `pending` is cheap and real (queued
calls) and both analogs have it. Confirming/canceled belong to the approval flow (M3+ surface).
Glyphs mirror gemini's production set (`constants.ts:20-27`); colors reuse the EXISTING M0
`theme.status` tokens — no theme shape change.

**Alternatives considered:** gemini's full 6-state set (rejected: confirming/canceled have no
M2 renderer semantics — YAGNI); themable glyph tokens now (rejected: M6 owns theme
finalization; constants are module-local and documented).

**Consequences:** M3's approval prompts may extend the union additively; theme.tool tokens
arrive at M6 if needed.

### D2 — Spinner: adopt `ink-spinner ^5.0.0` (Rule 9 verdict)

**Decision:** New runtime dependency `ink-spinner ^5.0.0`; running indicator =
`<Text color={status.warning}><Spinner type="dots"/></Text>`.

**Rationale:** Production-adopted by BOTH analogs (pre-validated manifest lines); canonical Ink
solution; hand-rolling reproduces ~60 LoC + invites the exact packaging mistake ink-ui made
(cli-spinners undeclared). Peer compatibility (ink ^5 / react ^18) verified at `/deps-audit`.

**Alternatives considered:** hand-rolled hook + cli-spinners (rejected while ink-spinner peers
fit — reinvention); ink-ui's component (rejected: pulls the whole @inkjs/ui surface).

**Consequences:** First new runtime dep since M0 — deps-audit gates it; if peers conflict, the
documented fallback is a ~30-line internal hook.

### D3 — ToolCall (inline row) + ToolCallCard (card with body) + ToolResult (output block) as three composable primitives

**Decision:**
`ToolCall({ name, status, summary? })` — one header line: indicator (3 cells) + bold name +
dim summary. `ToolCallCard({ name, status, summary?, children? })` — ToolCall header + indented
body (`paddingLeft = 3` aligning under the name; no borders at M2). `ToolResult` renders the
body content (see D4/D5). Status arrives via props (M7 boundary).

**Rationale:** Mirrors gemini's header/body decomposition (`ToolMessage.tsx:45-165`) minus the
sticky-header/focus machinery (M3+); roadmap names both ToolCall and ToolCallCard; composition
over configuration (M0 D4 precedent: explicit props, no runtime).

**Alternatives considered:** single mega-component with `variant` prop (rejected: ISP — callers
of the inline row shouldn't carry card props); gemini's border-box body (rejected at M2:
border+height plumbing belongs with focus/viewport work — YAGNI; indentation suffices and is
codex-like).

**Consequences:** M3 timeline rows can embed `ToolCall` inline; cards remain compact.

### D4 — Truncation: `maxLines` tail-retention + `… +N lines hidden` indicator; caller-controlled expansion

**Decision:** `ToolResult({ children | lines, maxLines = 10, expanded = false })` — when the
content exceeds `maxLines` and not `expanded`: render the LAST `maxLines − 1` lines + one dim
indicator line `… +N lines hidden`; `expanded` renders everything. A 20 000-char pre-cap guards
pathological inputs.

**Rationale:** Tail retention = gemini's standard mode (recent output is the relevant end for
tool logs); the indicator phrasing follows codex's `… +N lines` (terminal-size-independent —
our components don't thread `availableTerminalHeight` at M2); the char pre-cap mirrors
`SlicingMaxSizedBox` (20k) as a safety valve.

**Alternatives considered:** codex head+tail split (rejected: two visible regions cost more
layout for marginal value at M2); gemini's global keybind expansion (rejected: no focus
management at M2 — caller toggles `expanded`); height-aware `availableTerminalHeight` plumbing
(deferred to M6 robustness work).

**Consequences:** Expansion interactivity (keybinds/focus) arrives with M3+; the prop contract
stays.

### D5 — Shell envelope: `ToolResult shell={{stdout, stderr, exitCode}}` with labeled stderr and non-zero-only exit badge

**Decision:** Shell mode renders: stdout lines (plain); stderr lines in `status.error` color
(dim label `stderr:` once before the block when both streams present); `exited {code}` line in
`status.error` bold ONLY when `exitCode !== 0`; when both streams are empty → dim `(no output)`.
Truncation (D4) applies to the COMBINED line list (stdout first, stderr after).

**Rationale:** We receive separated fields (unlike gemini's pre-interleaved ANSI), so the
distinction must be re-introduced — color alone fails NO_COLOR, hence the one-line label when
stderr exists (color-independent readability, M0/M1 review precedent). Exit-code convention
from codex (`exited {code}` red, success silent). `(no output)` placeholder chosen over codex's
silent drop: an empty CARD body reads as broken.

**Alternatives considered:** interleaving by timestamp (rejected: fields carry no ordering —
fabricated interleave would lie); always-shown exit code (rejected: noise on the common path).

**Consequences:** M4+ may accept pre-interleaved ANSI arrays; the envelope contract stays.

### D6 — Test strategy: first-frame spinner determinism; one exhaust+dedup animation test; transition rerenders; line oracles

**Decision:** (1) Per-status snapshots via `renderFrame` (one tick @0ms captures spinner
frame[0] deterministically — before the first ~80ms interval); (2) ONE animation test using the
ink-ui exhaust+dedup idiom against `cli-spinners.dots` (real timers); (3) transitions via
`rerender` with new `status` (+ the gemini stateful-wrapper idiom where act() is needed);
(4) truncation via line presence/absence + indicator string; (5) NO_COLOR probe gains a
tool-card scene (status glyphs distinguishable without color); (6) no fake timers anywhere.

**Rationale:** Q4 evidence — gemini mocks animations in component tests, ink-ui owns the only
real animation test; our one-tick renderFrame makes frame[0] snapshots stable by construction;
`rules/testing.md § 6` bans time nondeterminism.

**Alternatives considered:** vi.useFakeTimers for spinner cycling (rejected: cli-spinners +
intervals under fake timers flake — Q4 finding); mocking ink-spinner everywhere (rejected: then
nothing proves the real integration renders).

**Consequences:** The animation test carries a real ~800ms wall cost (dots: 10 frames × 80ms)
— acceptable, single test.

## Recommendations for the project

| # | Recommendation | Linked to | Priority |
|---|---|---|---|
| 1 | `ToolCallStatus` union + status→glyph/color constants (indicator width 3) | Q1, D1 | HIGH |
| 2 | `ToolCall` inline row + `ToolCallCard` (header + indented body) | Q1, D3 | HIGH |
| 3 | `ToolResult` with maxLines tail-truncation + `… +N lines hidden` + 20k char pre-cap | Q2, D4 | HIGH |
| 4 | Shell envelope mode (labeled stderr, non-zero exit badge, `(no output)`) | Q3, D5 | HIGH |
| 5 | `ink-spinner ^5.0.0` dependency (Rule 9 verdict; deps-audit confirms peers) | Q5, D2 | HIGH |
| 6 | Test kit per D6 (first-frame snapshots, one exhaust test, transition rerenders, line oracles, NO_COLOR scene) | Q4, D6 | HIGH |
| 7 | `benchmarks/tool-cards.bench.tsx` + m2 baseline JSON (cards + transitions + long output) | Q6 | HIGH |
| 8 | Document glyph constants as M6 theming candidates | D1 | LOW |

## Blocked questions (if any)

(none — all 6 answered)

## Halt-loop progress (audit trail)

- Iterations used: 1 (inline — 4 parallel research agents + synthesis; ralph-loop not spawned:
  session Stop hook active, per `rules/loop-engine-convention.md § Anti-patterns`)
- Questions answered: 6/6 · blocked: 0
- EC-2 sampling honored (codex render.rs read at truncation region; constants quoted)
- Citations verified: Step 7 path-existence sweep after synthesis

## Related

- Discovery plan: `.claude/knowledge-base/discoveries/plans/m2-tool-surface-plan.md`
- Edge-case review: `.claude/knowledge-base/reviews/m2-tool-surface-edge-cases-2026-07-06.md`
- Project rules linked: `.claude/rules/architecture.md`, `.claude/rules/testing.md`,
  `.claude/rules/analysis-golden-rule.md`, `.claude/rules/error-handling.md`
