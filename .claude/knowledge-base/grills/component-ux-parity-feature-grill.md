---
slug: component-ux-parity
generated_by: roadmap-feature
new_milestone_id: M26
date: 2026-07-09
status: completed
out_of_scope_check: no_conflict (agent-surface polish, not generic TUI widgets)
---

# Feature grill — component-ux-parity (M26)

One-line: evolve @theokit/tui components toward Claude Code parity, starting with
ToolCallCard/ToolResult (the `● Bash(...)` header + `⎿` result tree look).

## Q1 — What is this feature and why now?
A UX pass across ALL agent-surface components toward Claude Code visual/interaction
parity, ANCHORED on ToolCallCard/ToolResult (the `● Bash(...)` header + `⎿` result
tree). Why now: the composer already reached input parity (/ @ ! ?), but the tool
cards / outputs still diverge from the Claude Code look — the biggest perceived gap
when running the live demos. DoD enumerates concrete per-component upgrades.

## Q2 — Dependencies (which milestones must be [x])?
M25 (V4 parity polish + exit gate). Depending on the last milestone implies the whole
V4 renderer program is done and every component is migrated to V4 — the base needed to
polish them. All M0–M25 are already [x], so M26 is immediately eligible.

## Q3 — Definition of Done (3-5 verifiable bullets)?
1. ToolCallCard: Claude-Code-style header — a status glyph `●` colored by status
   (running/success/failed) + `name(args)` on one line, args truncated to width.
   (snapshot test)
2. ToolResult: body rendered under a `⎿` corner connector with indented lines, per
   kind (diff/output/preview). (snapshot test per kind)
3. The new look ships as the DEFAULT (no consumers yet — owner decision Q4: no
   backward-compat constraint, do what's best for the system). No opt-in prop needed;
   the full test suite + export-surface stay green.
4. Parity sweep of the other agent-surface components (ChatMessage, AgentStreaming,
   AppStatusBar, ChatThread): each gets ONE documented tweak OR a 'no-change' with
   rationale — recorded in docs/component-parity.md.
5. Live verification (tmux) of the tool cards across all 3 kinds + a captured frame in
   the parity doc.

## Q4 — Top 2 NEW risks?
Owner note: there are NO consumers yet, so backward-compatibility is NOT a risk — the
new look ships as the default; do what's best for the system. The two genuine technical
risks that remain:
- R1 (render regression): the `●`/`⎿` glyphs are ambiguous/wide-width and the new
  indentation/tree can break wrap, alignment, and the existing snapshots under the V4
  renderer. Mitigation: per-kind snapshot tests + live verification at real width.
- R2 (scope creep): the parity 'sweep' (DoD item 4) is subjective and can balloon.
  Mitigation: cap at ONE documented change-or-no-change per named component.
