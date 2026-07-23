# Review agent: cross-validation — post-0.41.1-batch (2026-07-23)

Ad-hoc range review (no plan file). Scope: `git diff v0.41.1..HEAD` (14 commits in `commit-range.txt`).

Focus: every CLAIM in the ground truth maps to implementation + tests, and vice versa:

1. CHANGELOG `## [Unreleased]` at HEAD — each entry (Added: Explored block, inline diff; Removed: ai-sdk BREAKING; Fixed: settings deny rules, shell envelope): does the code do exactly what the entry claims? Are the claimed config knobs (`exploreTools`, `DEFAULT_EXPLORE_TOOLS`, pass `[]` to disable) real and tested?
2. Commit messages vs diffs: does each commit do what its message says, and ONLY that (scope cohesion)? Flag mixed-concern commits.
3. GAP check: features shipped in the range but MISSING from CHANGELOG [Unreleased] — note that 0.42.0/0.43.0/0.44.0 npm releases happened mid-range WITHOUT promoting the CHANGELOG; entries for formatToolHeader (#53), formatToolResult, word-wrap fix, ESC refocus, initialValue/onChange may be absent from [Unreleased] though they will ship in 0.47.0 relative to the last CHANGELOG-recorded release 0.41.1. Report precisely which of the range's user-visible changes lack a CHANGELOG entry ANYWHERE (Unreleased or a versioned section).
4. BREAKING honesty: the removal entry gives a correct 1:1 migration path?

Read-only. Output a claims table: claim → commit(s) → implemented? → tested? → verdict.
