# M10 snapshot re-record review (D2/T1.4)

Base: `035ae09` (pre-bump). Changed files: 2 of 12 (.snap). Every diff
reviewed line-by-line; zero unexplained rows; border glyphs zero-diff.

| File | Snapshots | What changed | Justifying blueprint delta |
|---|---|---|---|
| tool-call.test.tsx.snap | tool-call-pending/running/success/failed + tool-call-card | `[1mNAME[2m summary[22m` → `[1mNAME[22m[2m summary[22m` — bold now closed explicitly BEFORE dim opens; visible text byte-identical | SGR sequencing via ansi-tokenize 0.1→0.3 + chalk chain (blueprint Corner 4 / F3 class (a)) |
| public-api.integration.test.tsx.snap | light-theme-scene | same SGR close-before-open resequencing in the bold+dim composer line | same |

Verified NOT changed: welcome-banner snapshots (border glyphs — cli-boxes 4
deep-equal proof held), diff-viewer/code/metrics/stream scenes, all
truncate-end content (string-width 8 shifts affect only emoji/CJK clusters —
our fixtures are ASCII).

## M26 re-record — tool-card Claude Code parity (2026-07-10)

The `●` status bullet (default `theme.toolStatus` glyph across dark/light/no-color),
the `name(args)` header format, and the `⎿` result-tree connector re-recorded three
snapshot files. Visible-text change is intentional and reviewed line-by-line.

| File | Snapshots | What changed | Justifying delta |
|---|---|---|---|
| tool-call.test.tsx.snap | tool-call-pending/running/success/failed + tool-call-card | status glyph `o`/`✓`/`x` → `●` (colored by status); `NAME summary` → `NAME(summary)`; card body now under a `⎿` corner connector | M26 plan ADR A/B/C; blueprint §T1/T2 (codex `exec_cell/render.rs:372`,`:706`; mastra `tool-execution-enhanced.ts:1482`) |
| agent-timeline.test.tsx.snap | representative-turn + header-scene | tool rows adopt the `●` bullet + `⎿` body (composed ToolCallCard) | same — downstream of ToolCallCard |
| public-api.integration.test.tsx.snap | tool/agent/stream scenes | same `●` + `name(args)` + `⎿` in the composed public-API scenes | same |

Verified NOT changed by M26: welcome-banner, diff-viewer intra-line, metrics,
code-block, markdown-table — none render tool-status glyphs.

## M27.1 re-record — Claude Code chat differentiation (2026-07-10)

The assistant role glyph (`✦` → `●`, an aligned width-1 filled circle matching the
tool-status bullet) and the user turn rendering dim (input-echo contrast) re-recorded
four snapshot files. Visible-text change is intentional and reviewed.

| File | Snapshots | What changed | Justifying delta |
|---|---|---|---|
| chat-message.test.tsx.snap | chat-message-user/assistant/system | assistant glyph `✦ ` → `● `; user text now wrapped in `[2m` dim (input echo) | M27.1 Claude Code parity — differentiate user (dim echo) vs agent (`●` bullet, normal) |
| agent-timeline.test.tsx.snap | message/turn scenes | assistant rows adopt the `●` bullet (composed ChatMessage) | same — downstream of ChatMessage |
| public-api.test.tsx.snap → public-api.integration.test.tsx.snap | tool/agent/theme/stream scenes | `●` assistant bullet + dim user across composed public-API scenes | same |
| tool-call.test.tsx.snap | (unchanged this milestone; M26 entry stands) | — | — |

Verified NOT changed by M27.1: welcome-banner, banner, diff-viewer, metrics,
code-block — none render the chat role glyph.

## M27.1 polish — ChatThread inter-turn spacing (2026-07-13)

`ChatThread` now inserts one blank line above every turn EXCEPT the first
rendered element (Claude Code cadence). Re-recorded ONE snapshot; diff is a
single `+` blank line — no glyph/text/border change.

| File | Snapshot | What changed | Justifying delta |
|---|---|---|---|
| public-api.integration.test.tsx.snap | welcome-banner-scene | one blank line inserted between the `> hello` user turn and the `● welcome aboard` assistant turn | ChatThread inter-turn `marginTop={1}` (M27.1 spacing polish) |

Verified NOT changed: every non-ChatThread scene (the spacing lives in
ChatThread's row wrapper; standalone ChatMessage is untouched — no leading/
trailing margin).

## #40 re-record — ⏺ glyph restored (string-width bump, 2026-07-16)

The width bug that forced `●` (the M27.1 workaround) is fixed: `string-width`
7.2.0 → 8.2.1 and `widest-line` 5.0.0 → 6.0.0 (both now on the string-width ^8
line Ink 7.1.0 uses), so `⏺` (U+23FA) measures **1** cell (`measureText("⏺")
=== 1`), matching Ink. With the width correct, the theme's Claude-Code bullet
`●` → `⏺` across all three themes (role.assistant + tool-status
pending/success/failed). 13 snapshots re-recorded; the diff is a pure `●`→`⏺`
character swap (17 lines each side, same columns — `⏺` and `●` are both width 1,
so nothing shifted).

| File | Snapshots | What changed | Justifying delta |
|---|---|---|---|
| chat-message.test.tsx.snap | chat-message-assistant | assistant glyph `●` → `⏺` | #40 — string-width fix enables the intended ⏺ |
| tool-call.test.tsx.snap | tool-call-pending/success/failed + card | tool-status glyph `●` → `⏺` | same |
| agent-timeline.test.tsx.snap | message/tool scenes | `⏺` via composed ChatMessage/ToolCallCard | same |
| public-api.integration.test.tsx.snap | tool/agent/theme/stream scenes | `●` → `⏺` across composed scenes | same |

Verified NOT changed: the `Toast` bullet (component-local `●`, not a theme role
glyph — out of "no tema" scope), the thinking marker `•`/`✻`, and every
non-glyph scene. The dependency bump alone changed no snapshot (only ⏺'s width
moved, and nothing used ⏺ before the swap — 153 width-sensitive tests stayed
green pre-swap).

## Claude Code parity — AgentStreaming interrupt hint (2026-07-16)

The streaming hint gained the Claude Code shape `({elapsed} · {N} tokens · esc to
interrupt)` (was `(esc to cancel[, {elapsed}])`). One snapshot re-recorded; the
diff is the suffix wording only (plus a one-char-longer primary truncation, as the
longer suffix leaves one fewer column for the truncate-end thought).

| File | Snapshot | What changed | Justifying delta |
|---|---|---|---|
| agent-streaming.test.tsx.snap | agent-streaming | `(esc to cancel, 12s)` → `(12s · esc to interrupt)` | #1 Claude Code parity (tokens + interrupt wording) |

## AgentTimeline inter-block spacing (2026-07-16)

`AgentTimeline` now inserts one blank line above every event block (message /
thinking / tool) EXCEPT the first rendered one — the Claude Code cadence, mirroring
ChatThread's inter-turn spacing. Two snapshots re-recorded; the diff is blank-line
insertions only (no glyph/text change).

| File | Snapshots | What changed | Justifying delta |
|---|---|---|---|
| agent-timeline.test.tsx.snap | agent-turn + timeline-header-scene | one blank line above each block after the first | AgentTimeline row `marginTop={1}` (Claude Code cadence) |
| public-api.integration.test.tsx.snap | stream-scene | same inter-block blank lines in the composed AgentTimeline stream scene | same — downstream of AgentTimeline |
