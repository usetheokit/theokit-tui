---
type: Parity Matrix
title: V4 component-parity matrix
description: Component parity against seven peer agent CLIs — what is covered, what shipped in M17–M25, and what is deliberately out of library scope. Closed by the M25 exit-gate re-audit.
tags: [parity, matrix, roadmap, v4, competitive]
sources:
  - id: matrix
    resource: "git:9fd7eb1:docs/v4-parity-matrix.md"
    last_modified: 2026-07-09
  - id: m25-report
    resource: "git:9fd7eb1:docs/renderer/m25-parity-report.md"
    last_modified: 2026-07-09
generated:
  by: claude-code/opus-5
  at: 2026-08-06
status: stable
---

> Success criterion of the V4 program (owner mandate 2026-07-08): component parity
> with Claude Code, Codex, Gemini CLI, pi, mastracode, tau and OpenCode. Source:
> three parallel source-code inventories over the cloned references — **Claude Code
> is OBSERVATIONAL** (closed source; its column reflects product behavior, not read
> code). Universal = present in ≥ 4/7 peers → parity REQUIRED. Re-audit of this
> matrix is the V4 exit gate.

Legend: ✓ have · ◐ partial · ✗ missing · CC = Claude Code (obs) · Cx = Codex ·
G = Gemini · P = pi · M = mastracode · T = tau · O = OpenCode

# Already covered (V1–V3 surface)

| Category                        | CC  | Cx  | G   | P   | M   | T   | O   | Ours (0.17.0)                                               | Gap notes                                                                         |
| ------------------------------- | --- | --- | --- | --- | --- | --- | --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Chat thread + role messages     | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ ChatMessage/ChatThread                                    | system-labeled blocks (skill/branch/compaction) missing — app-composable          |
| Tool cards + per-kind results   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ ToolCall(Card)/ToolResult + result union                  | per-TOOL custom renderers ◐; interactive expand/collapse ✓ (M25 ExpandableOutput) |
| Markdown + code + diff          | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ MarkdownText/CodeBlock/DiffViewer                         | tables ✓ + intra-line diff highlight ✓ (M25)                                      |
| Spinner + elapsed + cancel hint | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ AgentStreaming + useTurnElapsed                           | phrase-cycler/shimmer ✓ (M24 opt-ins)                                             |
| Status bar + token metrics      | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ AppStatusBar + ContextWindowBar/CostMeter/TokenUsageChart | —                                                                                 |
| Banner / splash                 | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ WelcomeBanner (animated)                                  | multi-step onboarding = app flow, out                                             |
| Composer + slash menu           | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ ChatComposer + slash menu                                 | fuzzy ✗ (M21), @files ✗ (M21), history/Ctrl+R ✗ (M21), kill-ring/undo ✗ (M21)     |
| Themes + degrade ladder         | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ TheoTUIProvider + monochrome data-driven                  | theme preview picker → M22 SelectList consumer                                    |

# Committed in the V4 renderer program (M17–M21)

| Category                                          | Peers                  | Milestone                                                             |
| ------------------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| Flicker-free renderer (CSI-2026, diff strategies) | P (Cx/CC equiv native) | [M17](/renderer/skeleton-parity.md)–[M18](/renderer/layout-parity.md) |
| Bracketed paste → collapsed placeholder           | CC, Cx (PasteBurst), P | [M19](/renderer/input-stack.md)                                       |
| Remappable keybindings (emacs defaults)           | P, M, Cx               | [M19](/renderer/input-stack.md)                                       |
| PTY e2e harness (@xterm/headless)                 | P (test infra)         | M17/[M19](/renderer/input-stack.md)                                   |
| Inline images (kitty/iTerm2)                      | P, CC(input)           | M21                                                                   |
| Editor upgrade: undo/kill-ring/word-nav/history   | P, Cx, G, CC, O        | M21                                                                   |
| Fuzzy + @file-mention autocomplete                | CC, Cx, G, T, O        | M21                                                                   |

# NEW milestones required by this matrix (M22–M25) — ALL SHIPPED

| Category                                                     | CC  | Cx  | G   | P   | M   | T   | O   | Milestone / status                                               |
| ------------------------------------------------------------ | --- | --- | --- | --- | --- | --- | --- | ---------------------------------------------------------------- |
| SelectList (fuzzy, single/multi) + pickers                   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | **M22** ✓ (v0.23.0 SelectList)                                   |
| Overlay/modal infra + full-screen pager                      | ✓   | ✓   | ✓   | ◐   | ✓   | ✓   | ✓   | **M22** ✓ (OverlayProvider/Pager)                                |
| Approval/Permission prompt (diff inline; always/once/reject) | ✓   | ✓   | ✓   | ◐   | ✓   | ✗   | ✓   | **M23** ✓ (v0.24.0 ApprovalPrompt)                               |
| Question prompt (structured ask-user)                        | ✓   | ◐   | ✓   | ◐   | ✓   | ✗   | ✓   | **M23** ✓ (QuestionPrompt)                                       |
| Plan approval / proposed-plan cell                           | ✓   | ✓   | ◐   | ✗   | ✓   | ✗   | ◐   | **M23** ✓ (PlanApproval)                                         |
| Todo/plan checklist (live ☐/☑)                               | ✓   | ✓   | ✓   | ✗   | ◐   | ✗   | ✓   | **M24** ✓ (v0.25.0 TodoList)                                     |
| Multi-step / subagent progress                               | ◐   | ✓   | ✓   | ✗   | ✓   | ✗   | ✓   | **M24** ✓ (MultiStepProgress)                                    |
| Collapsible block (thinking/reasoning; expandable output)    | ✓   | ✓   | ◐   | ✓   | ✓   | ✓   | ✓   | **M24** ✓ (CollapsibleBlock/ThinkingBlock)                       |
| Toast / desktop notification (OSC-9/BEL)                     | ✗   | ✓   | ✓   | ✗   | ✓   | ✗   | ✓   | **M24** ✓ (Toast/notify)                                         |
| Spinner phrase-cycler + shimmer                              | ✓   | ✓   | ✓   | ✗   | ◐   | ✗   | ✗   | **M24** ✓ (AgentStreaming opt-ins)                               |
| Markdown tables                                              | ✓   | ✓   | ✓   | ✓   | ◐   | ✓   | ✓   | **M25** ✓ (v0.26.0 — universal 6.5/7)                            |
| Intra-line diff word highlight                               | ◐   | ✓   | ✗   | ✓   | ✗   | ✗   | ✓   | **M25** ✓† (borderline ~3.5/7 — opt-in, off-path byte-identical) |
| Interactive expand/collapse on caps (ctrl+o idiom)           | ✓   | ✓   | ✓   | ✓   | ✓   | ✗   | ✗   | **M25** ✓ (universal 5/7 — ExpandableOutput)                     |
| Terminal title + OSC-8 hyperlinks helpers                    | ✗   | ✓   | ✗   | ✗   | ◐   | ✓   | ✓   | **M25** ✓† (non-universal ~3.5/7 — bonus parity)                 |

> † **Honesty note (M25 re-audit).** The intra-line diff and OSC-helper rows are
> below the strict ≥ 4/7 "universal → parity REQUIRED" bar. They ship ✓ because
> each fully satisfies the [exit-gate triple](/concepts/exit-gate-triple.md)
> (component ∧ oracle set ∧ example) with no standing refutation — intra-line as
> an opt-in prop with a proven byte-identical default path, OSC helpers as pure
> no-op-off-TTY escape writers. They are graded ✓ **with this note**, not silently
> as required-universal rows.

# Explicitly OUT (app territory, ≤ 3 peers, or against thesis)

- **Session management UI** (browsers / tree selectors / timeline-revert) — app
  state machinery; the library ships the SelectList/Pager they compose from.
- **Sidebar layouts** (T, O only) — app-level layout composition.
- **Voice / push-to-talk** (M only) · **Easter eggs** (P) · **Quota/billing
  dialogs** (G) · **Login/OAuth flows** (all — app auth, not render primitives).
- **Settings screens** — apps compose them from M22 primitives.

# Exit gate

V4 closes when a RE-AUDIT of this matrix shows every "universal" row (≥ 4/7 peers)
at ✓ for the library-scope column — verified per row by a component + oracle set +
example, per the house cycle discipline.

## Exit-gate result (M25 re-audit, 2026-07-09) — **PASSED**

The re-audit was an independent 2-specialist refutation panel (per
`cycle-review.md` — not a self-grade). **No refutation stood.** Every universal
library-scope row has the exit-gate triple; the two borderline rows ship ✓ with
the honesty note above. No app-scope row from the "Explicitly OUT" list was
mis-graded as a library gap. Full report:
[M25 exit-gate re-audit](/parity/exit-gate-re-audit.md). Every M22–M25
milestone is released (v0.23.0–v0.26.0); **the V4 parity program is closed.**
