# Review agent: domain-tui — post-0.41.1-batch (2026-07-23)

Ad-hoc range review (no plan file). Scope: `git diff v0.41.1..HEAD`. Domain: Ink/terminal rendering correctness.

Focus (TUI-specific invariants of this codebase):

- `<Static>` windowing contract: the Explored grouping happens in the PROJECTION (messagesToAgentEvents), claimed as "1 event = 1 row" so windowing is untouched. Verify: can a grouped `explored` event MUTATE (grow) after graduating into Static history (append-once violation)? How does the projection behave when an explore run is still streaming (last tool pending/running)?
- Explored block render: `└` connector lines, dim styling — NO_COLOR/monochrome degrade OK? Width: long paths/patterns in `exploreSummary` — truncation to terminal width or overflow risk?
- Inline diff in timeline (`DiffViewer` in `toolBody`): NO_COLOR degrade, narrow width behavior, `maxLines` respected?
- Word-wrap fix (chat-message): correct use of measured width? CJK/grapheme safety (house Intl.Segmenter idiom)?
- Composer: ESC refocus (78d4316) — focus leak scenarios; `initialValue` seed — grapheme-safe via text-buffer? `onChange` — fires on every edit path (paste, delete, kill-ring)?
- Shell envelope render: exitCode≠0 badge, stderr labeling in ToolResult — degrade ladder respected?

Read-only. Cite file:line evidence for every finding.
