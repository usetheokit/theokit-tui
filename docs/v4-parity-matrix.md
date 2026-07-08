# V4 Component-Parity Matrix

> Success criterion of the V4 program (owner mandate 2026-07-08): component
> parity with Claude Code, Codex, Gemini CLI, pi, mastracode, tau and
> OpenCode. Source: three parallel source-code inventories over the cloned
> references (Claude Code is OBSERVATIONAL — closed source; its column
> reflects product behavior, not read code). Universal = present in ≥ 4/7
> peers → parity REQUIRED. Re-audit of this matrix is the V4 exit gate.

Legend: ✓ have · ◐ partial · ✗ missing · CC=Claude Code(obs) Cx=Codex
G=Gemini P=pi M=mastracode T=tau O=OpenCode

## Already covered (V1–V3 surface)

| Category                        | CC  | Cx  | G   | P   | M   | T   | O   | Ours (0.17.0)                                               | Gap notes                                                                     |
| ------------------------------- | --- | --- | --- | --- | --- | --- | --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Chat thread + role messages     | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ ChatMessage/ChatThread                                    | system-labeled blocks (skill/branch/compaction) missing — app-composable      |
| Tool cards + per-kind results   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ ToolCall(Card)/ToolResult + result union                  | per-TOOL custom renderers ◐; interactive expand/collapse ✗ (M25)              |
| Markdown + code + diff          | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ MarkdownText/CodeBlock/DiffViewer                         | tables ✗, intra-line diff highlight ✗ (M25)                                   |
| Spinner + elapsed + cancel hint | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ AgentStreaming + useTurnElapsed                           | phrase-cycler/shimmer ✗ (M24)                                                 |
| Status bar + token metrics      | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ AppStatusBar + ContextWindowBar/CostMeter/TokenUsageChart | —                                                                             |
| Banner / splash                 | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ WelcomeBanner (animated)                                  | multi-step onboarding = app flow, out                                         |
| Composer + slash menu           | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ ChatComposer + slash menu                                 | fuzzy ✗ (M21), @files ✗ (M21), history/Ctrl+R ✗ (M21), kill-ring/undo ✗ (M21) |
| Themes + degrade ladder         | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓ TheoTUIProvider + monochrome data-driven                  | theme preview picker → M22 SelectList consumer                                |

## Committed in the V4 renderer program (M17–M21)

| Category                                          | Peers                  | Milestone |
| ------------------------------------------------- | ---------------------- | --------- |
| Flicker-free renderer (CSI-2026, diff strategies) | P (Cx/CC equiv native) | M17–M18   |
| Bracketed paste → collapsed placeholder           | CC, Cx (PasteBurst), P | M19       |
| Remappable keybindings (emacs defaults)           | P, M, Cx               | M19       |
| PTY e2e harness (@xterm/headless)                 | P (test infra)         | M17/M19   |
| Inline images (kitty/iTerm2)                      | P, CC(input)           | M21       |
| Editor upgrade: undo/kill-ring/word-nav/history   | P, Cx, G, CC, O        | M21       |
| Fuzzy + @file-mention autocomplete                | CC, Cx, G, T, O        | M21       |

## NEW milestones required by this matrix (M22–M25)

| Category                                                     | CC  | Cx  | G   | P   | M   | T   | O   | New milestone                   |
| ------------------------------------------------------------ | --- | --- | --- | --- | --- | --- | --- | ------------------------------- |
| SelectList (fuzzy, single/multi) + pickers                   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | **M22** interaction primitives  |
| Overlay/modal infra + full-screen pager                      | ✓   | ✓   | ✓   | ◐   | ✓   | ✓   | ✓   | **M22**                         |
| Approval/Permission prompt (diff inline; always/once/reject) | ✓   | ✓   | ✓   | ◐   | ✓   | ✗   | ✓   | **M23** agent decision surfaces |
| Question prompt (structured ask-user)                        | ✓   | ◐   | ✓   | ◐   | ✓   | ✗   | ✓   | **M23**                         |
| Plan approval / proposed-plan cell                           | ✓   | ✓   | ◐   | ✗   | ✓   | ✗   | ◐   | **M23**                         |
| Todo/plan checklist (live ☐/☑)                               | ✓   | ✓   | ✓   | ✗   | ◐   | ✗   | ✓   | **M24** live progress surfaces  |
| Multi-step / subagent progress                               | ◐   | ✓   | ✓   | ✗   | ✓   | ✗   | ✓   | **M24**                         |
| Collapsible block (thinking/reasoning; expandable output)    | ✓   | ✓   | ◐   | ✓   | ✓   | ✓   | ✓   | **M24**                         |
| Toast / desktop notification (OSC-9/BEL)                     | ✗   | ✓   | ✓   | ✗   | ✓   | ✗   | ✓   | **M24**                         |
| Spinner phrase-cycler + shimmer                              | ✓   | ✓   | ✓   | ✗   | ◐   | ✗   | ✗   | **M24**                         |
| Markdown tables                                              | ✓   | ✓   | ✓   | ✓   | ◐   | ✓   | ✓   | **M25** parity polish           |
| Intra-line diff word highlight                               | ◐   | ✓   | ✗   | ✓   | ✗   | ✗   | ✓   | **M25**                         |
| Interactive expand/collapse on caps (ctrl+o idiom)           | ✓   | ✓   | ✓   | ✓   | ✓   | ✗   | ✗   | **M25**                         |
| Terminal title + OSC-8 hyperlinks helpers                    | ✗   | ✓   | ✗   | ✗   | ◐   | ✓   | ✓   | **M25**                         |

## Explicitly OUT (app territory, ≤ 3 peers, or against thesis)

- Session management UI (browsers/tree selectors/timeline-revert) — app
  state machinery; the lib ships the SelectList/Pager they compose from.
- Sidebar layouts (T, O only) — app-level layout composition.
- Voice/push-to-talk (M only) · Easter eggs (P) · Quota/billing dialogs
  (G) · Login/OAuth flows (all — app auth, not render primitives).
- Settings screens — apps compose them from M22 primitives.

## Exit gate

V4 closes when a RE-AUDIT of this matrix shows every "universal" row
(≥ 4/7 peers) at ✓ for the lib-scope column — verified per-row by a
component + oracle set + example, per the house cycle discipline.
