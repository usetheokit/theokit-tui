# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added

- `useAgentStream` accepts a second `options` argument with `initialMessages` — the transcript of a
  resumed session, projected through `messagesToAgentEvents` and returned ahead of everything the
  live stream folds. The fold only ever grew from the stream, so a surface that repointed its
  session rendered an empty timeline while the model demonstrably had the earlier turns: *"it
  worked"* and *"it did nothing"* looked identical. The history is a prefix rather than a seeded
  fold, so it survives the reset a new `source` identity triggers and may arrive after mount
  (#179)

- **ci:** per-commit package previews via pkg.pr.new. A fix here is unverifiable from a sibling
  repository until it is on a registry, and this ecosystem has nine interdependent publishable
  repositories — measured 2026-08-31, `@theokit/http` reached 2.0.0 in one while three packages in
  another declared a range excluding it, and nothing found out until a release gate ran. Previews
  cost nothing and burn no npm version, so they are the first thing to reach for; the snapshot path
  is for when the answer has to come from registry.npmjs.org specifically.

### Changed

- **release:** the npm dist-tag is now derived from the version being published instead of
  defaulting. A prerelease version (`X.Y.Z-next.N`) publishes under `next`; a stable version
  publishes under `latest`. Previously the publish passed no `--tag` at all, so a prerelease
  would have become the version every consumer installs, with the publish reporting success
  either way.

## [0.79.0] - 2026-08-27

### Added
- **ci:** `Promotion gate` refuses a pull request into `develop` that does not come from this repository's own `workspace`. `git-safety.md` has always said so and `validate-command.sh:245` has always blocked it — for a `git merge` typed locally, which is not how any of this repository's 60 promotions landed (usetheokit/theokit#606)

- `defaultToolHeader` and `DEFAULT_TOOL_HEADERS` — the humanised verb table for the conventional
  tool names (`run_shell` → `Ran`, `apply_patch` → `Edited`, `write_stdin` → `Wrote to session`),
  so an app no longer re-derives it behind the `formatToolHeader` seam. Opt-in with
  `formatToolHeader: defaultToolHeader`; an app that passes nothing renders raw tool names exactly
  as before (#53)
- `AgentTimeline` accepts `verbose` — set it to `false` and every run of adjacent tool calls
  collapses into a dim count line (`Ran 2 shell commands`, `Read 3 files`) instead of the cards,
  the collapsed-by-default transcript Claude Code shows. Defaults to `true`, so an existing
  timeline renders unchanged. The collapse covers the live tail; rows already printed into
  scrollback stay as they were printed (#61)
- `AgentTimeline` accepts `footer` — a slot under the last row for the mode note that goes with
  the toggle (`Showing detailed transcript · ctrl+o`). The text and the key binding belong to the
  app; the timeline only exposes the surface (#61)

### Added

- An approval LEDGER (`createApprovalLedger`, `ingest`, `settle`, `prune`, `findNextApproval`,
  `pendingCount`) for several approvals in flight — settled individually, pruned on backtrack, and
  read incrementally instead of rescanning the thread. `findPendingApproval` scans newest-first and
  answers "the approval that just came in"; the ledger returns the OLDEST unsettled, because a human
  answering a queue answers it in the order the questions arrived. Both answers already existed in
  one process; the difference is now written down rather than implicit in two places (#68)
- `resolveApprovalId` and `partToPendingApproval` are exported. They were private, so a consumer
  needing to settle an approval re-derived the whole fallback chain — including the `toolName:
  "tool"` default — and ended up declaring the same concept a third time (#68)
- `TurnDone` — the dim past-tense line a finished turn leaves behind (`✻ Baked for 5s`).
  `AgentStreaming` is live-only, so a scrolled-back transcript kept the answers and dropped the
  timings. Static and timer-free by design: this is the row that graduates into `<Static>`, and a
  row that changed after mount would disagree with what the terminal already printed. The verb is
  a function of the duration, not a random pick, for the same reason; `WHIMSY_VERBS` and
  `whimsyVerb` are exported so an app can use its own voice (#62 item 1)
- `ChatComposer` accepts `variant` — `"plain"`, `"border"`, or `"rules"` (full-width horizontal
  rules above and below with no sides, the Claude Code composer chrome). Omit it and the frame
  follows `bordered`, so existing consumers are unchanged (#62 item 2)
- `ChatComposer` accepts `refocusOnEscape` (default `true`). The composer re-takes focus on ESC
  because Ink blurs the focused input before subscribers see the key, which left it inert after an
  app used ESC to interrupt a turn. An app that maps ESC to a deliberate focus handoff can now say
  so instead of fighting the composer over every press. Menu and shell-draft dismissals still
  refocus regardless — there the composer handled the key itself (#59 item 4)

### Changed

- The user role's glyph is `❯ ` in every built-in theme, replacing `> ` (Claude Code parity,
  #62 item 3). A consumer wanting the old prompt overrides `role.user.glyph` on the theme
- `ToolResultFormatter` returns a union of single bodies instead of
  `Pick<AgentToolEvent, "output" | "shell" | "diff">`. A formatter returning two exclusive bodies
  used to compile and fail later at the timeline's guard, which named the timeline rather than the
  formatter. It is now a type error at the formatter (#59 item 2)
- The tool-result routing (`routeToolResult`, `looksLikeUnifiedDiff`, `toShell`,
  `parseShellEnvelope`, `NormalizedShell`, `isShellEnvelope`) moved to its own module. Every symbol
  is re-exported from `agent-stream-event.ts`, so no import changes (#59 item 1)

### Fixed

- A tool row no longer graduates into `<Static>` while it is still running or pending. Scrollback
  is append-only, so a row committed mid-flight was frozen there: the spinner stayed in the
  transcript and the result never appeared. Widening the window so nothing graduated produced a
  different transcript from the same events — the history was reporting the window rather than the
  turn. The boundary now stops at the first unsettled row, and the whole tail waits with it,
  because scrollback has no insertion point to fill in later. A tool that never settles keeps the
  live region growing; a longer tail beats a wrong history (#52)
- `WelcomeBanner`'s two-column layout stays inside its border at every width. Both columns were
  unshrinkable, so wherever art + gutter + aside did not fit, the aside ran past the right border
  and lost its closing rule — visible below roughly 52 columns for a 24-cell wordmark. The aside
  now wraps instead; the art keeps its full width, which is the rule that made the columns
  unshrinkable in the first place. A consumer whose banner overflowed will see it reflow (#158)

### Changed

- CI reports on `main` when the tree's version is not the one npm serves. It warns rather than
  fails: a bumped-but-unpublished version is the normal state between merging a bump and cutting
  the tag, so a red check would fire on every correct commit and be trained away (#131)

## [0.78.0] - 2026-08-25

Cut as 0.78.0 rather than 0.77.0. The tree carried 0.77.0 and the registry served 0.76.1, so 0.77.0
was never published — but it was packed as a tarball and consumed locally, WITHOUT the `asideDivider`
below. Publishing a different 0.77.0 would give one version number two contents, which is the kind
of ambiguity that costs an afternoon to diagnose.

### Added

- `WelcomeBanner` takes `borderTitle`, which writes the product and build INTO the top border —
  `╭─── TheoCode v0.4.7 ─────╮`. It was not expressible before: the frame is an Ink `<Box borderStyle>`
  and Ink has no border label, so the only way to get one was to hand-roll the whole box, which is
  what `WelcomeBanner` exists to stop (#155)
- `PermissionPrompt` takes `hintPlacement`, which moves `hint` under the choice list instead of above
  the question. A consumer using it to say which keys settle the prompt wants it read after the
  choices, not before them; `"above"` stays the default so existing `ruleNote`-style hints do not
  move (#155)

- `WelcomeBanner` takes `asideDivider`, which draws the vertical rule between the two columns and
  lets the aside fill the width left over. Building the "Tips for getting started" panel that
  `aside` was made for previously meant computing the slot width from the box's own padding
  (`columns - artWidth - 6`), asking for a cross-axis `flexGrow` so the rule reached the bottom
  border, and drawing the rule on your own Box because the gutter is a margin. All three go away;
  banners that do not pass the flag are unchanged (#157)
- `Release`, a tag-driven publish for `@theokit/tui`. There was no release workflow: publishing
  happened by hand, which is why the tree carries 0.77.0 while the registry serves 0.76.1, and why
  no published version carries a provenance attestation (#153)
- `Workflow Lint`, a CI gate running actionlint and zizmor over `.github/workflows/` (#153)

### Fixed

- The release workflow could never have published. `packages/tui`'s `prepublishOnly` ran `pnpm
  gates`, and `gates` is a script of the ROOT manifest — inside the package it does not exist, so
  `pnpm publish` died with `Command "gates" not found` before uploading anything. Found by cutting
  the first real tag; the workflow shipped in #153 and had never been exercised. It now defers to
  the root script and skips entirely under `CI`, where the workflow has already run the same gates
  twice (Node 22 and 22.12) — the same "CI runs its own gates" pattern the sibling repos' pre-push
  hook uses. The gate did its job: it failed closed, and nothing reached the registry (#153)

- A consumer's `formatResult` override never ran on the FAILURE path. The gate read `tool.output`,
  while an errored part is filled from `tool.errorText` — so a rejected or failed call rendered its
  raw payload verbatim while the header override, which has no such gate, fired normally. A consumer
  could format every successful call and no failed one, with nothing on screen saying why (#156)

### Changed

- The CI matrix runs Node 22.12 and the latest 22.x, was 22.x and 24.x. Testing 24 while never
  testing the floor `engines` declares covers the wrong end (#153)
- `engines.node` is `>=22.12.0`, was `>=22`, matching the rest of the published packages (#153)
- Node pinned to 22.12.0 and pnpm to 10.34.1, resolved from `.nvmrc` and `packageManager` (#153)

### Security

- Every GitHub Action is pinned to a commit SHA rather than a movable tag (#153)
- The publish authenticates with npm trusted publishing over OIDC; no long-lived token exists (#153)

### Added

- **A documentation-only commit was impossible, and the wiki's citations had gone dead (B-109).**

  Two defects the layout change introduced, both found while promoting it:

  - The pre-commit formatter gate rejected any commit whose staged set is only Markdown. Prettier
    formatted `.md`; Biome does not, and reports an empty input set as an error rather than a
    no-op — so the hook refused the commit naming files it does not govern. The empty case is now
    reported, not silenced, and the gate was re-verified against all three cases (malformed `.ts`
    blocks; `.md`-only passes; mixed set still checks the `.ts`).
  - The OKF knowledge bundle cites the code holding each fact. **13 of 21** citations resolved
    before this session, **1 of 21** after the move, **21 of 21** now. Every rewrite was checked
    against the filesystem; none was guessed.


### Changed

- **Test runs no longer claim every core on the host.** `vitest.config.ts` capped nothing, so the default applied — `os.availableParallelism()`, one fork per core, each booting a full test environment. On a 12-thread machine a single `vitest run` therefore took the whole box, and anything else running alongside it (a second suite, a typecheck, the desktop) competed for what was left. The cap now leaves 4 cores free (`Math.max(2, cpus().length - 4)`), scaling with the runner instead of hard-coding one machine's core count. It costs no wall-clock — measured in `theokit-ui`, the full suite ran 73.96s at 4 workers against 74.36s at 12. (usetheokit/theokit-ui#51)

### Deprecated

### Removed

### Fixed

### Security

## [0.77.0] - 2026-08-21

### Added

- **The repository adopts the ecosystem's shared conventions (B-109).**

  `theokit-sdk` is the reference layout for the Theo framework, and this package diverged from it
  on four axes. This lands the three that are cheap and reversible:

  - `.ls-lint.yml` — kebab-case file naming, wired into `pnpm gates` as `validate:naming`. The
    tree already satisfied it: **0 of 307** source files needed renaming, so the rule pins a
    convention that was being followed by habit with nothing enforcing it. Verified falsifiable —
    a file named `Bad_Name.ts` fails the gate.
  - `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.editorconfig`, `.nvmrc` — the
    community and editor files every other repo in the framework carries. `CONTRIBUTING` inherits
    the SDK's _structure_, not its prose: its 452 lines are lessons measured in that repository
    and would be false here.
  - `assets/banner.svg` — same palette, typography and frame as the SDK banner, with a terminal
    motif in place of the orbital one, now at the top of the README.

  Affects contributors, not consumers. **No published behaviour changes.**

- **Biome replaces ESLint + Prettier (B-109).** One tool, the ecosystem's config, `pnpm check` /
  `pnpm check:fix` as in `theokit-sdk`.

  312 files were reformatted (Biome's `lineWidth: 100` against Prettier's 80) and 1706 tests stayed
  green through it. Four rule groups diverge from the SDK's config, each for a measured reason
  rather than convenience:

  | Rule | Here | Why |
  |---|---|---|
  | `a11y/*` | off | Biome's a11y rules target the DOM. There is none. 39 of them fired on `role="user"` — the `ChatMessage` domain prop, not an ARIA attribute. Terminal accessibility here is `NO_COLOR` / `TERM=dumb` / screen-reader mode, and the degrade matrix already proves it. |
  | `suspicious/noControlCharactersInRegex` | off | A terminal library matches `\x1b`. The ESLint config it replaces was already disabling this rule case by case — 13 of the 18 `eslint-disable` comments in the tree were this exact rule. |
  | `suspicious/noArrayIndexKey` | off | The lists are frame rows. Row 3 is row 3; they are replaced by position, never reordered. |
  | `complexity/noExcessiveCognitiveComplexity` | 25, not 10 | 36 functions exceed 10 (max 25, median 14). Set to what the tree passes today, so it blocks regression instead of being waived on day one — the doctrine `.dependency-cruiser.cjs` already states. |

  **Two defects were found by doing this, both real:**

  - **`npx` made a gate pass having inspected nothing.** `npx biome format` run outside the project
    exits **0 silently**; the same binary invoked directly exits 123. The hermetic gate test (B-051)
    caught it. Every gate now calls the binary, never `npx` — this is the B-084 failure shape, one
    layer down.
  - **Biome's "unsafe" autofix broke an example.** `useExhaustiveDependencies` added `[stream, exit]`
    to a mount-once effect whose `stream` is re-created every render; `examples/scenes/chat.tsx` died
    with `Maximum update depth exceeded` before printing a token. The dependency list is empty on
    purpose and now says so.

  Five suppressions remain, each one line with the reason above it: two TypeScript conflicts
  (`useOptionalChain` returns `boolean | undefined` under `strict` — TS2322), the canonical global
  `RegExp.exec` loop, and two mount-once effects.

  `pnpm lint` reports **355 files inspected** — the same count ESLint reported, which is the
  evidence the swap did not narrow the gate's view.

- **Tests move out of `src/` and into `tests/`, mirroring the ecosystem layout (B-109).**

  129 files (110 tests, 19 snapshot files) moved with `git mv`, so the history follows them.
  `theokit-sdk` keeps 878 tests under `packages/*/tests` and zero co-located; this package had a
  hybrid of 110 in `src/` and 57 in `tests/`. It is now one answer to "where does a test live".

  `src/` is production code with no exceptions, and that turned out to be worth more than the
  tidiness: `.dependency-cruiser.cjs`'s dev-dependency rule carried an exemption for
  `*.test.*` / `*.bench.*` inside `src/`, and the exemption is now **deleted** rather than
  configured — there is nothing left in `src/` for it to excuse.

  **Two gates went quietly blind in the move, and both are fixed:**

  - `depcruise src` fell from **283 modules / 1128 dependencies to 162 / 610** — it kept reporting
    a clean pass over 57% of what it used to see. It now cruises `src tests` and reports
    **339 / 1346**, which is *more* than before the move: the tests that already lived in `tests/`
    had never been cruised at all.
  - `tests/lint/structure.test.ts` walked only `src/`, so its test-file naming rules had an empty
    input. Measured: a file named `bogus.nonsense.test.tsx` under `tests/` passed the qualifier
    rule. The naming rules now walk both trees; the domain rules (barrels, folder budgets) still
    walk only `src/`, because `tests/` has no barrels by design.

  Coverage is unaffected — vitest already excluded test files from `coverage.include: ["src/**"]`
  (verified: 0 of 142 reported files were tests, total 98.59%).

- **The repository becomes a pnpm workspace, matching the ecosystem layout (B-109).**

  The package moved to `packages/tui/`; `pnpm-workspace.yaml`, `turbo.json`, `biome.json`,
  `.ls-lint.yml`, `.dependency-cruiser.cjs` and `.npmrc` sit at the root, exactly where
  `theokit-sdk` keeps them. CI is unchanged — it calls `pnpm <script>` at the root, and the root
  now delegates through turbo.

  **The published package is unaffected**: same name, same version, same four entry points, same
  `files: ["dist"]`. `publint` reports "All good!" and the packed tarball carries the same
  artifacts.

  **`.npmrc` had to go to the ROOT, and that is not cosmetic.** pnpm resolves the tree from the
  workspace root, so a package-local `.npmrc` is never read during install. While it sat inside
  the package, `auto-install-peers` reverted to its default, `figlet` was installed, and
  `figlet-art.test.ts → returns_null_when_figlet_is_absent` went red — the exact failure the README
  warns about. The lockfile had to be regenerated to drop the peer it recorded.

  **Four gates broke on the way and each is fixed rather than relaxed:** `depcruise` could not find
  the tsconfig from the root (TS5083, then TS18003) and now runs with its cwd inside the package;
  the root `lint` could not see files outside the packages (`.dependency-cruiser.cjs` was the only
  one, and one invisible file is how the next ten arrive); `validate:naming` reported **0 files
  checked** under a `git ls-files` pathspec that matched nothing — a green gate that inspected
  nothing, caught by the same B-084 discipline that motivated it; and four repo-level contract
  tests were reading `wiki/`, `.github/` and the gate scripts through the package's relative path.

  **Deliberately NOT adopted: changesets.** `theokit-sdk` generates per-package changelogs with
  them and has no root `CHANGELOG.md`. `rules/cycle-release.md` derives the next version from this
  file's `[Unreleased]` section and cuts one semver tag. Adopting changesets would replace the
  release process, not the layout — that needs an ADR, not a refactor.

- **The never-weaken test guard had stopped guarding, and now says how much it checks (B-109).**

  `never-weaken migration guard (M10 D2)` compares the `it(` count of every changed test file
  against a base commit, so a refactor cannot quietly delete assertions. It resolves the base
  version by a hard-coded historical path — which two layout changes have since invalidated.

  Measured: **14 of 171** files were still being compared before this workspace migration (the
  domain split in `78a333a` had already broken most of them), and **0 of 158** after it. The guard
  was green in both states.

  It now tries the pre-package and pre-domain paths as well, bringing the comparison set to
  **27 of 158**, and — following B-084 — asserts that the set has not collapsed instead of
  reporting a pass over nothing. The floor is 20 rather than 1, because a guard comparing a single
  file passes just as happily as one comparing none.

## [0.76.1] - 2026-08-20

### Changed

- **The lint gate now names the source files it did NOT inspect (B-102).**

  `pnpm lint` reads `git ls-files`, so a file on disk and not yet staged is not in its input — it
  then reports "354 files inspected" and exits 0, a count that is honest about the wrong set. Two
  CI failures in one day were exactly that.

  It reports rather than fails: a file nobody staged is not part of the repository, and a gate
  that is red during ordinary work is a gate people route around. **This is a diagnostic — no
  published behaviour changes and no build fails that did not fail before.**

  Affects contributors running the gates locally, not consumers of the package.

## [0.76.0] - 2026-08-20

### Added

- **`narrowingLayer` — a `SurfaceLayer` whose `when` narrows the state for `render` (B-074).**

  ```ts
  narrowingLayer<AppState, WithApproval>({
    name: "approval",
    when: (s): s is WithApproval => s.pendingApproval !== undefined,
    render: (s) => <ApprovalCard approval={s.pendingApproval} />,  // no cast
  });
  ```

  `SurfaceLayer.when` returns `boolean`, so whatever it proves is discarded before `render` sees
  it and the caller re-asserts it by hand — measured in a real consumer as
  `approval={p.pendingApproval as PendingApproval}`, three lines below the `when` that proved it.

  **Purely additive.** `SurfaceLayer` is unchanged, every existing layer keeps compiling, and a
  narrowing layer is assignable to `SurfaceLayer<S>` so both kinds mix in one array.

  **The cost, stated:** inference does not carry through the factory, so both type arguments are
  explicit — `narrowingLayer<AppState, WithApproval>`. One type-argument pair against the guard,
  the re-assertion and the unreachable branch it replaces.

  Not applied to `KeyLayer` (`src/keys/layer-router.ts`), whose `when` returns actions rather than
  feeding a `render` — there is no narrowing to carry there.

## [0.75.0] - 2026-08-20

### Removed

- **`src/renderer/kill-ring.ts` and `src/renderer/undo-stack.ts` (B-065).** Neither was ever
  imported by anything. They are module-internal — absent from `src/index.ts` and
  `src/renderer/index.ts` — so nothing a consumer can reach changes, and this entry exists for the
  record rather than as a migration note.

## [0.74.0] - 2026-08-20

### Removed

- **`WindowView.overflowUp` and `WindowView.overflowDown` (B-076).** Both were derived fields —
  `overflowUp` was `hiddenBefore > 0` and `overflowDown` was `hiddenAfter > 0` — carried beside the
  counts they came from. Two predicates for one fact.

  **If you read them, write the expression instead:** `view.hiddenBefore > 0`. Nothing has to be
  recomputed or recovered; the equivalence is now a comment on `hiddenBefore` itself, which is
  where someone looking for the removed field will land.

  This reaches `SlashMenu` too, which extends `WindowView`.

  **A breaking change to a published type, and a minor under 0.x.** Recorded that way rather than
  as a tidy-up: no reader was measured in this repository or in the one known consumer — which
  cites the booleans in comments while explaining that it renders the counts — but consumers this
  package cannot see are exactly the ones a removal reaches.

## [0.73.0] - 2026-08-20

### Changed

- **`createFrameBudget` no longer accepts a negative `frameBudgetMs`, and `-1` in particular now
  throws (B-075).** It used to be silently identical to `0`, the documented "disables throttling"
  value, so a caller who spelled "off" that way had working code. That is the one input in this
  change with a plausible dependant, and it is why this is a minor rather than a patch: under 0.x a
  breaking change is a minor bump.

  If you passed `-1` meaning "no throttling", pass `0`. It is the documented spelling and it is
  unchanged.

  Reaches you through `@theokit/tui/renderer` and, indirectly, through `useCoalesced`'s `windowMs`
  on the root entry.

### Fixed

- **A `NaN` or `Infinity` frame budget stopped the UI instead of reporting anything (B-075).**
  `createFrameBudget` read `frameBudgetMs` straight through with no validation, and two values broke
  it in different ways with no error either time.

  With `Infinity` the surface painted once and then never again. With `NaN` it was worse than a
  freeze: `NaN <= 0` is false and `Infinity >= NaN` is false, so **not one** paint was ever allowed.
  Measured through `useCoalesced` with `windowMs: NaN`, the derived value was computed zero times,
  the terminal rendered the literal string `undefined`, and the zero-millisecond timer rescheduled
  itself — 6 to 7 renders over 12 ticks against a healthy budget's 2. A wrong value on screen, a
  re-render loop, and no diagnostic anywhere.

  An invalid budget is now refused at construction with a `TypeError` naming the value, and leaves a
  durable `[theokit/tui]` record before it throws — so the failure is at the call the caller wrote,
  not at some later paint. `0` and fractional budgets such as `2.5` are unaffected and stay
  accepted.

## [0.72.0] - 2026-08-20

### Security

- **`setTerminalTitle` and `osc8Link` now refuse caller values carrying control bytes (B-086).**
  Both interpolated their arguments verbatim into an OSC sequence, so a `BEL` or an `ESC \` in a
  title, URL or link text **terminated the sequence early and let what followed run as a new
  command**. Demonstrated: a title of `ok` plus a payload emitted the title sequence followed by a
  complete OSC 52 clipboard write.

  This is CVE-2026-47090's shape — an OSC 8 emitter interpolating caller values without encoding
  them. The values that reach these functions in practice are chosen by consumers, which is why a
  comment saying "sanitize upstream if untrusted" was never a control: the review that would catch
  a bad call happens outside this repository.

  **What is refused, precisely**, since "control bytes" is not a specification: the whole of C0
  (`U+0000-U+001F`) and C1 (`U+007F-U+009F`), tested as a CHARACTER PREDICATE rather than by
  matching a sequence. A matcher cannot see a lone `ESC` with no terminator — the branch where
  `less` failed in CVE-2022-46663, whose one-line fix reads _"End OSC8 hyperlink on invalid
  embedded escape sequence"_. Values without such a byte emit byte-identically to before, so a
  correct caller sees no change at all.

  **They now throw rather than strip**, and that is deliberate: the caller chose the value, so a
  control byte is a defect in their code, not hostile data from outside — silently repairing it
  would hide their bug and ship a title that is not the one they wrote. Well-formed values emit
  byte-identically to before.

  **What an incorrect caller sees now, stated in both directions rather than only the flattering
  one.** On a TTY they got a broken terminal and now get an exception. **Off a TTY they got a
  silent no-op and now also get an exception** — `setTerminalTitle` writes nothing there, and
  `osc8Link` returns the text verbatim, so neither was visibly wrong before. The validation runs
  ahead of both gates on purpose: off-TTY is where tests and CI run, so that is where a caller's
  bug should surface, and `osc8Link` hands the unvalidated string back rather than discarding it.

### Fixed

- **The exported `VERSION` constant reports `0.72.0` (B-095).** It is maintained separately from
  `package.json` and lagged behind it during this cut until the export-surface contract test caught
  the disagreement. Nothing shipped wrong — the mismatch never left the release branch — and it is
  recorded here because `VERSION` is `@public`: comparing it is how a consumer confirms they are
  running a build that carries the OSC refusal below, rather than inferring it from a lockfile.

### Changed

- **`setTerminalTitle` and `osc8Link` reject inputs they previously accepted (B-086).** Recorded
  separately from the security note above because it is the part that can break a working caller:
  any value carrying a C0 or C1 control byte now raises `RangeError` instead of being emitted. That
  is a behaviour change on two published functions, which is why this release is a minor rather
  than the patch its section headings would otherwise derive.

## [0.71.0] - 2026-08-20

### Security

- **An untrusted code block can no longer put a control sequence on your terminal (B-078).**
  `CodeBlock` sanitised its input with the SGR-only stripper, so an OSC 8 hyperlink reached the
  rendered frame **byte-for-byte**: a model's output could make arbitrary text clickable and, via
  OSC 52, silently overwrite the clipboard.

  Clipboard write is on by default on five of nine terminals surveyed from their own source —
  Windows Terminal, kitty, alacritty, WezTerm, Ghostty. It is off on iTerm2 and xterm, and not
  implemented in VTE. Clipboard **read** is not the threat: no terminal in that set permits it
  unprompted.

  The fix is a separate sanitiser rather than a wider `stripAnsi`, because the two have different
  responsibilities: one removes colour from output this library authored, the other removes
  everything from content it was handed and cannot vouch for. Its last pass is a stateless control
  filter, and that is what carries the safety property — a structural matcher for `OSC … terminator`
  cannot match a sequence that never terminates, which is precisely the shape of CVE-2022-46663.

  Tabs, newlines and carriage returns survive, so code blocks still render as code.

### Fixed

- **`@`-mention search walks breadth-first, so a root-level file is no longer hostage to the
  subtrees that sort before it (B-072).** Typing `@pack` in a directory containing `package.json`
  used to return **nothing**.

  The walk was depth-first and recursed into a directory the instant it met one, while the result
  cap applies BEFORE ranking — so the cap decided which paths the ranker ever saw. Measured on this
  repository, the capped walk read six directories and never opened `package.json`, `src/`, `tests/`
  or `wiki/`. Breadth-first makes DEPTH decide who survives the cap instead of alphabetical luck,
  which is what someone typing a query expects.

  The default cap also rose from 50 to 1000. **On a small tree that alone is enough** — measured
  depth-first at 1000, this repository does answer `@pack` with `package.json`. It stops being
  enough as the tree grows: at the same cap, a 21-repository tree answers with a
  `coverage/lcov-report/*.html` file, because depth-first still spends the budget on whatever sorts
  first. Breadth-first is what makes the result independent of tree size.

  The cap still applies before ranking, deliberately: ranking everything means walking everything,
  and this runs once per keystroke with no debounce. Measured, a full walk is 8.4 ms here, 221 ms
  across a 21-repo tree, and 2.1 seconds over a 150 000-file one. With the fix, `@pack` answers
  correctly in 3.7 / 5.9 / 12.6 ms on those same three trees.

  One consequence worth naming: B-071's test had been weakened to assert only that the menu was
  populated, because the ranking could not be relied on. It now asserts the obvious match ranks
  first — a test written around a defect, un-written.

## [0.70.0] - 2026-08-19

### Changed

- **The disclosure affordance is now `▸` / `▾`, not `▶` / `▼` (B-053).** `▼` had come to mean three
  unrelated things in one package: "expand this section" (`CollapsibleBlock`), "there is more output
  behind this" (`ExpandableOutput`), and "N rows are hidden below the window" (the three list views).

  B-022 and B-052 made the third meaning numeric everywhere, which turned a theoretical collision
  into a measured one: a single frame renders `▼ 8` from a collapsible block whose summary happens
  to be a number and `▼ 4` from an overflowing menu, four lines apart — identical in shape,
  unrelated in meaning.

  The distinction is **weight, not direction**, because direction is already load-bearing on both
  sides: disclosure toggles down/right, overflow shows up and down at once. Small triangles are
  disclosure, large triangles are overflow. One glyph, one meaning.

  Demonstrated rather than asserted, which is what the item asked for: a test renders both in one
  frame and checks that `▾ 8` and `▲ 8` are no longer the same shape.

  **This changes rendered output of two published components.** A consumer asserting on `▶` or `▼`
  from `CollapsibleBlock` or `ExpandableOutput` will need to update; assertions on the list views'
  overflow markers are untouched.

### Changed

- **The thirty spawn budgets are measured, and the measurement is why they stay (B-067).** The
  standing comment said they were unmeasured and that measuring them was a followup, which invited
  the same investigation repeatedly. Measured on a machine already under load — a pessimistic
  sample — the tightest is 2.9x with 19.7 seconds of headroom, and all fifteen example tests pass.

  The number with a failure history turned out not to be in this population: it is the 2000 ms
  budget already hunted across three earlier items and fenced by this same lint. The thirty
  inherited the suspicion, not the defect.

  Corrected in review, and the correction is the interesting half. The first version of this entry
  said a CI-side measurement was needed and that nobody had one. Both were wrong: it is one
  `gh run view --log` away, and CI is 2-3x **faster** than a loaded developer machine, on the full
  suite. Measured there, the tightest margin is 6.6x rather than 2.9x. The decision not to tighten
  stands and stands more strongly — but it now rests on numbers instead of on an obstacle that did
  not exist.

### Fixed

- **`ComposerCapabilities.mentions` documented a predicate the composer does not use (B-071).** Its
  TSDoc said "a mention provider is passed and can return results", so a truthful consumer omitted
  `mentions` when it passed no `fileSearch` — and lost the `@` row from its own help for a feature
  that works.

  Measured: `chat-composer.tsx:303` reads `fileSearch = defaultFileSearch`, a `.gitignore`-aware cwd
  walk. Driven with no provider at all, typing `@src` returns **16 live candidates**. The real gate
  is `mention-menu.ts:64` — the predicate is _"the provider in effect returned results"_, never
  _"a provider was passed"_. `mentions` is the one field of four whose absence under-advertises.

  **The comment was corrected, not the code, and that was a decision.** Dropping the default would
  compile everywhere and pass all three existing mention tests — they inject a provider — while
  silently deleting a working feature from every consumer that never passed the prop. Set `mentions`
  whenever the composer is mounted, unless you passed `fileSearch: () => []` to switch it off.

  The default path is now pinned by a test; it was asserted by nothing, and the mutant that removes
  the default provider kills it.

## [0.69.0] - 2026-08-19

### Security

- **`diff` moved from 7 to 8.0.4, past the published advisory (B-069).** `GHSA-73rr-hh4g-fpgx` /
  `CVE-2026-24001` is a denial-of-service in jsdiff's patch PARSING, fixed in 8.0.3.
  `@types/diff` was removed in the same change because jsdiff ships its own typings from 8 onward,
  so keeping it would have declared types for a version we no longer install.

  **This package was never exposed, and saying so is part of the entry.** The vulnerable
  `parsePatch` / `applyPatch` have zero call sites here; the advisory itself states that "other
  methods of the library are unaffected"; the only jsdiff call is `diffWordsWithSpace` over a
  del/add line-text pair (`src/diff/diff-word.ts:45`); and the single route to it is behind
  `intraLineHighlight`, whose default is `false`. Consumers who installed 0.68.0 were not at risk —
  they were carrying an advisory that could not reach them.

  What DID change for a consumer: `npm audit` on a fresh install of 0.68.0 reported 2 advisories,
  one of them `diff`. It reports one fewer now.

  **What this does not cover.** The package that actually parses an untrusted patch here is
  `parse-diff` (`src/diff/diff.ts:1`), not jsdiff — and it has not been audited. Filed as its own
  item rather than implied away, because an entry about a parsing DoS that leaves the real parser
  unexamined is the more dangerous half of a half-truth.

  Chose 8.0.4 rather than 9.0.0: the advisory is fixed at 8.0.3, and taking a major for a
  low-severity issue in an unreachable path buys risk with no return.

### Changed

- **Four dead-code exemptions replaced by one rule (B-066).** `knip.json` listed
  `src/search/index.ts` and the three `src/renderer/*` barrels by name; it now declares
  `src/**/index.ts` an entry point and the list drops from seven rows to three.

  The four barrels genuinely have zero importers — and under ADR 0002 that is the EXPECTED state,
  not a defect: a barrel is the _mechanism_ of privacy, so a folder the root does not re-export has
  nothing left to import its barrel. Two gates disagreed about it —
  `tests/lint/structure.test.ts` mandates a barrel for every folder under `src/`, knip called that
  same barrel unused — and the exemption list was the manual patch between them, growing one line
  per internal domain. Deleting the four was measured and refused: it turns that test red, naming
  those exact folders.

  The gate is not weakened, and that was measured rather than asserted: a module exported from its
  own barrel and imported by nothing is still reported. Declaring a barrel an entry makes the
  BARREL a root, not its exports.

  Also corrected: `src/search/index.ts`'s header claimed its boundary was "enforceable". Both of its
  real consumers reach past it with a deep import, one of them from a different and public domain,
  and no sibling domain in the tree imports another's barrel. The comment now says the boundary is
  conventional, which is what is true.

  No `dist` artifact changes; nothing published moves.

### Changed

- **A test wait that fails now names the 200 ms event that likely caused it (B-058, phase 1).**
  `settleWatching` reaches a 200 ms ceiling when it observes no reaction to a write, and returned
  quietly. That is correct for a key that legitimately changes nothing — and identical to what a
  write the component never saw produces. The event is now recorded and appended to a failing
  wait's message, so a timeout ten seconds downstream reports the cause instead of the symptom.
  Passing tests print nothing.

  Test-infrastructure only; no published behaviour changes.

  **The write-side half is NOT fixed, and the reason is on the record — corrected once, in review.**
  A first version of this entry claimed the mechanism could not be reproduced. That was wrong twice
  over: the probe measured `stdin.listenerCount("data")`, and ink never listens to `data`; and it
  put `useInput` in the root component, where ink attaches synchronously so no window exists.

  Measured after the correction: when the `useInput` consumer mounts LATE — behind a state flip, the
  shape a composer has when an overlay appears — the first write is destroyed **20 times out of 20**,
  leaving exactly the reported `bc` after typing `a`, `b`, `c`.

  So a deterministic repro of the class exists, and the fix is still not shipped: what is missing is
  evidence that the SUITE's failures take that route, since `ChatComposer` calls its input hooks
  unconditionally. Four earlier classes were declared closed by absence; closing this one by analogy
  would be the same mistake better disguised. No wait budget was raised and no worker count lowered.

### Added

- **`SelectList` accepts an optional `initialSelectionIndex` (B-054).** Omitting it reproduces
  today's behaviour exactly, so no caller changes.

  It exists because an edge-RENDERING test could only reach the last row by driving the up-arrow,
  which made it die whenever the key layer died. Measured: the mutants "wrap becomes clamp" and
  "delete the up-arrow branch" had **identical kill sets of four tests** — nothing in the repo
  distinguished a broken wrap from a dead arrow. With the prop, both mutants now kill
  `up_arrow_wraps_to_the_last_row` and spare the rendering test, so the two report different
  defects. `WindowedList` already took its position as a prop, which is why its equivalent test was
  three lines.

  The name says `initial` on purpose: the component keeps owning the selection, so a changing value
  is ignored after first render. A controlled `selected` + `onSelectionChange` pair was rejected —
  a caller who passes the value and forgets the handler gets inert arrows, and this is published.

### Fixed

- **Four test helpers were not stripping ANSI at all (B-055).** They spelled the pattern
  `/\[[0-9;]*m/g` — a `/` straight into `\[`, with no escape byte. Measured against the shipped
  `Banner`: 8 escape bytes in, 8 escape bytes out. They deleted the colour _parameters_ and left the
  escapes, so a frame they "stripped" still failed exact equality and passed every substring
  assertion — which is why all three files were green. `src/layout/stack.test.tsx` is the one that
  was one colour away from failing with an unreadable diff naming the wrong cause.

  The same pattern also eats plain text: `"value [1m] and [;m end"` came back as `"value ] and  end"`.

### Changed

- **One `stripAnsi` for the package, replacing 39 hand-rolled constructs across 35 files (B-055).**
  They came in four spellings; three of them (``, a raw `0x1B` byte, `String.fromCharCode(27)`)
  all denote U+001B and were equivalent, and the fourth is the defect above. The production
  sanitiser at `markdown/code-block.tsx` now uses it too — byte-identical semantics, so nothing
  it renders changes.

  Nothing is added to the public surface: the module is absent from `src/format/index.ts`, and the
  `exports` map has no wildcard, so no consumer can reach it. Verified against the built `dist`.

  Census after: **35 files import the shared helper, and exactly one `[0-9;]*m` construct remains
  outside it** — `tests/fixtures/helpers.test.tsx:40`, which asserts an SGR is PRESENT and is
  therefore not a stripper. It carries a comment saying so, so the next reader does not "finish" the
  migration by deleting an assertion.

  Its scope stays SGR-only on purpose, pinned by a test. Widening to the OSC families would change
  what a sanitiser of **untrusted** input removes — an OSC 8 hyperlink or an OSC 52 clipboard write
  survives it today — and that is registered as its own item rather than smuggled into a
  de-duplication.

## [0.68.0] - 2026-08-19

### Fixed

- **The exported `VERSION` constant tracks the manifest again.** It read `0.67.1` while
  `package.json` said `0.68.0` — caught by the contract test written for exactly this
  ("prevents silent drift at the first release bump") before anything was published, so no
  consumer ever saw the mismatch. Recorded here rather than under `[Unreleased]` because it
  belongs to THIS release: putting it in the next one would describe this cut inside the
  following one.

### Changed

- **The slash and `@`-mention menus now show HOW MANY rows are hidden (B-052).** The overflow
  chrome went from a bare `▲` / `▼` to `▲ 4` / `▼ 4`, finishing what B-022 started: three
  components render the window computed by one `windowFor`, and this was the last one still
  drawing a bare arrow over counts it already held.

  The counts were never missing from the VALUE — `deriveSlashMenu` spreads `windowFor(...)`, so
  `hiddenBefore` and `hiddenAfter` were there at runtime the whole time. What hid them was the
  type: `SlashMenu` re-declared the window contract by hand instead of extending `WindowView`, so
  the spread widened the value and the interface narrowed it back. It now extends `WindowView`,
  which is why the same fix reached the `@`-mention menu for free — it shares the shape.

  **Compatibility.** `SlashMenu` is module-internal: `src/chat/index.ts` does not re-export it, so
  the added fields are invisible to the published surface and no consumer can be constructing one.
  What DOES change for consumers is the rendered frame of `ChatComposer`, which is why this is a
  minor and not a patch — a snapshot test over the composer's menu will see the number. Assertions
  of the shape `toContain("▲")` are unaffected.

  **Two review findings were folded in before release, not filed.** The `@`-mention path was
  pinned by nothing: zeroing only its counts survived the whole suite, because the fixture returned
  three candidates against a five-row window, so no mention menu in any test ever overflowed. It
  now has its own edge test. And the two frozen `CLOSED` literals — which this change had made
  LONGER — are now one shared `CLOSED_MENU`, its window half taken from `windowFor`'s own
  empty-list branch: the same hand-copy the interface change removed, one layer down.
  `SlashMenu.matches` became `readonly` because that shared instance escapes to callers by
  reference, not only by spread.

  **A third round-2 finding, and it is the one worth reading.** `readonly` alone was not enough:
  `Object.freeze` returns `Readonly<T>`, and annotating the binding `: SlashMenu` discarded it — so
  one field was protected and the other eight typechecked as writable while throwing at runtime, a
  failure that is harmless on an open menu and a hard `TypeError` on a closed one. The annotation is
  gone, inference keeps every field read-only, and the runtime freeze — which until now was pinned
  by nothing, measured by removing it and watching the whole suite stay green — has its own test.

## [0.67.1] - 2026-08-19

### Fixed

- **The coverage report is now readable by the validation gate (B-048).** `vitest.config.ts`
  declared a coverage block with no `reporter`, so the default set shipped — `text`, `html`,
  `clover`, `json` — and none of those is a filename the Squad gate looks for. It reported _"the
  threshold was NOT verified"_ on every validation run, and a WARN does not block.

  **This adds no safety, and saying so is the point.** The config declares thresholds of 90 on all
  four metrics and CI runs `pnpm test:coverage`, which fails the job when one is missed — so
  coverage has been enforced all along, at a stricter floor than the gate's 80. Measured while
  fixing this: statements 98.51%, branches 95.23%, functions 93.42%, lines 98.51%. What changes is
  that a gate stops emitting a warning nobody could act on.

  The reporter list is written out in full rather than reduced to what the gate wants: `reporter`
  replaces vitest's defaults, so the shorter fix would have silently deleted the HTML report people
  open locally. Both halves are pinned by a contract test whose detection power was verified by
  mutation.

- **The guard sink's lost-record count is now verified against the real dependency, not a stub
  (B-040).** `GuardSink.write` returns `boolean` because `installStderrGuard` returns `false` when
  its append fails — and every test of that path injected a stub written by the same author as the
  code under test, so the integration the design rests on was asserted nowhere. B-025 declared this
  exact failure scenario (an unwritable log directory) and never exercised it.

  The new integration test installs the REAL guard on a read-only directory, which
  `installStderrGuard` already treats as a supported state, so no mocking is needed. It asserts both
  halves: the counter rises AND the guard's own error object reaches the caller unchanged. Four
  mutants, four detected — including one that rethrows a NEW error, which a `toThrow` assertion
  would have passed.

## [0.67.0] - 2026-08-19

### Fixed

- **Every render-path guard now leaves a durable record, and a new silent one cannot land (B-028).**
  B-025 shipped the mechanism and wired one consumer, deliberately — a mechanism should have one
  proven consumer before it has 24 — and 20 component files were still throwing typed errors with
  no record anywhere. All 41 throws across those files now route through `reportGuardFailure`.

  The throw contract is unchanged: `reportGuardFailure` returns `never` and rethrows the SAME error
  object, so every `toThrow` assertion observes what it observed before.

  The durable part is the gate, not the sweep: `tests/lint/render-guards-report.test.ts` names any
  component that throws a typed error without reaching the sink, so file 21 cannot repeat file 1.
  Its limit is stated rather than implied — it matches on the import, not on every throw — and
  `tests/lint/guard-sink-per-domain.test.ts` closes that hole with one driven guard per domain,
  each proven by removing the report and watching its domain go red.

  `assertFiniteNonNegative` deliberately does NOT report: the record's first field names the
  component whose guard fired, and a shared helper called from several components knows none of
  their names. The caller wraps instead, and `src/format/format.ts` now says so.

### Added

- **The `[Unreleased]` section is now gated as English, and released entries are still untouchable
  (B-027).** The rule for new entries lived only inside the comment granting the exemption that
  disables its enforcement — and that comment let seven consecutive releases ship in Portuguese
  (0.54.0 through 0.60.0), written by an author who had read it. The new gate reads only the section
  that is still mutable; entries for a released version stay exactly as they shipped, because
  translating one would rewrite the record of what shipped.

  Proven with the same line in two places: injected into `[Unreleased]` it turns the gate red;
  injected into `## [0.60.0]` it does not.

## [0.66.0] - 2026-08-19

### Added

- **The dead-code gate can now see a module only its own test reaches (B-024).** `pnpm lint` runs
  `knip --production --include files`, which resolves reachability from what the package actually
  publishes rather than from a test.

  Measured on this tree: knip under its defaults does NOT report `src/renderer/kill-ring.ts` or
  `src/renderer/undo-stack.ts` — complete, tested modules whose own headers describe a composer
  integration that does not exist, and which nothing imports. In production mode it reports both.
  That is the blind spot the item was filed about, and it is why `/code-quality`'s D1 returned
  `PASS` with `score_cap: 100` on every audit while unable to answer its own question.

  `examples/` and `benchmarks/` are DECLARED ENTRIES rather than ignored paths: they are unreachable
  from `exports` by design, but a dead module imported only by a dead example must stay visible.
  The six known-dead files are exempted one path at a time, each with a written reason and an item
  that owns the decision — nothing was deleted to make the gate green. See `knip.README.md`.

### Changed

- **The release chain writes the version into every site that carries it (B-059).** The version
  lives in `package.json` and in `src/index.ts` as an exported constant, and a human kept them in
  step. The export-surface gate catches a divergence — it did, at 0.63.0, aborting `npm publish`
  _after_ the tag was cut and pushed, so `v0.63.0` still points at a commit whose exported constant
  is wrong. `bump_version.py` now writes both, verifies every site before writing any of them, and
  **names** any other tracked file carrying the old version instead of rewriting it: a version
  string in a fixture or a documented example is not a site, and replacing it blindly is a
  corruption no gate would catch. A non-zero exit blocks the release rather than warning.

## [0.65.0] - 2026-08-19

### Added

- **A dependency-rule gate runs with every other gate, and it found a real cycle (B-023).** Every
  `/code-quality` run reported the same INFO — "no architecture rules declared" — so the dependency
  detector was skipped on every audit. `.dependency-cruiser.cjs` now declares `no-circular` (error),
  `not-to-dev-dep` (error) and `no-orphans` (warn), and `pnpm gates` runs it.

  The first measurement was worth more than the gate: `dependency-cruiser --no-config` reported
  "no dependency violations found" over 384 modules, which is vacuous — with no rules there is
  nothing to violate. With a real rule it found
  `renderer/host-config.ts → renderer/text-measure.ts → renderer/host-config.ts`.

  **What is deliberately absent: folder-layering rules.** Measured, the domain graph runs both ways
  — `layout → prompts` and `prompts → layout`, `agent → chat` and `status → agent`. A layering rule
  would fail on the day it landed against a design nobody agreed to, and a rule waived on arrival
  teaches everyone to waive rules. This gate catches cycles and dev-dependency leaks; it does not
  make the layering enforced.

### Fixed

- **The renderer's node type no longer closes an import cycle (B-023).** `RendererNode` and
  `RootNode` moved to `src/renderer/node.ts`, a leaf that imports nothing from its siblings;
  `host-config.ts` re-exports them, so no import site changed and no public export moved. The cycle
  cost nothing at runtime — `text-measure.ts` used `import type`, which TypeScript erases — but
  dependency-cruiser reports both directions as plain imports, so keeping it would have required a
  path exception naming the two files the rule had just caught.

### Fixed

- **The edge-case coverage analyzer counts what a plan declares, and finds the tests the plan names
  (B-018).** Its ratio gates a release — below 0.80 the review returns `NEEDS_DEEPER` — and it was
  reporting 13 cases for a plan declaring 4 (ratio 0.385) and 27 for one declaring 7 (0.222). Both
  now report their real count and 1.0. Three defects: the same bullet extracted twice in two
  spellings, every keyword-bearing bullet anywhere in the document counted as an edge case
  (including Baseline Context citations and Unresolved Questions), and a matcher demanding all five
  longest words co-occur in one file — which missed three cases whose named tests exist. The
  analyzer now reads the `#### TDD` block that names the covering test, and the script has its first
  test file: 14 tests, 7 mutants, 7 detected.

### Added

### Changed

### Deprecated

### Removed

### Fixed

- **A stale `## [Unreleased]` section was sitting in the middle of this file (B-046).** It lived
  between the 0.52.0 and 0.51.0 releases and repeated an entry already filed under 0.52.0, so the
  file had two sections claiming to hold unreleased work. Nothing was actually unreleased and
  nothing was undocumented — it was residue from an old promote that copied instead of moving — but
  a reader had no way to know that without checking which heading each sat under.

  The release tool matched the first heading and stopped, so the second was never seen rather than
  skipped with a warning. It now refuses a CHANGELOG carrying more than one, naming both line
  numbers, instead of promoting past it in silence.

### Security

## [0.64.0] - 2026-08-18

### Added

- **`ComponentBoundary` — a component failure no longer takes the whole application, the user's
  session, and the shell's idea of success with it (B-031).** Measured against real `ink@7.1.0`: a
  component that throws from a prop guard unmounted the ENTIRE tree, printed ink's ERROR panel to
  the end user with an absolute source path and a source excerpt, and left the process exiting
  **0** — a CLI that died reporting success to its shell, so any script, CI job or supervisor
  treated the crash as a clean run.

  Wrapped, the same failure renders one dim line, the siblings survive, and the process exits
  non-zero:

  ```tsx
  import { ComponentBoundary } from "@theokit/tui";

  <ComponentBoundary component="SelectList">
    <SelectList items={items} window={window} onSubmit={onSubmit} />
  </ComponentBoundary>;
  ```

  It records what it caught, and it does not overwrite a narrower exit code you already set — a CLI
  that exited `2` for a usage error still exits `2`. An optional `onError(error, info)` prop routes
  the error wherever you keep them; it does not suppress the record.

  **Nothing changes until you wrap something.** This package does not wrap its own components: a
  boundary renders a fallback, so doing it for you would change what 21 components render on
  failure — and whether to keep going after one is a policy you own, not one a library should take.

## [0.63.1] - 2026-08-18

### Fixed

- **The exported `VERSION` constant matched the previous release, not the current one.**
  `src/index.ts` carried `0.62.0` while `package.json` said `0.63.0` — a package that would have
  announced itself to consumers as a version it was not. Caught by `prepublishOnly`, which runs the
  contract test that compares the two, and which is the first time in ten versions that gate has run
  at all.

  0.63.0 was tagged and never published for exactly this reason. The tag stays as the record of a
  release the gate stopped; it is not rewritten, and it is not republished under the same number.

## [0.63.0] - 2026-08-18 [NOT PUBLISHED — see 0.63.1]

### Changed

- **The test suite is deterministic at default worker count again (B-057).** `pnpm gates` now exits
  0 on three consecutive runs; it had been failing intermittently on a different test each time.
  The cause was a test helper that waited for the rendered frame to STOP CHANGING — a condition
  satisfied trivially in the window between a keystroke and the render, so it handed back a stale
  frame and the assertion after it read one. It now waits for the reaction to be observed first.

  Test infrastructure only; no consumer-visible behaviour changes. Recorded because it is what
  makes the gate above trustworthy, and because the gate is what `prepublishOnly` runs.

- **The repository's own quality gate is green again, and now means the same thing on every
  machine (B-051).** `pnpm gates` had been red since v0.54.0 — which is also the first version that
  never reached npm — and `format:check` is its first link, so `lint`, `typecheck`, `test` and
  `build` had not run in any publish attempt for ten versions. 24 files were reformatted.

  The larger half is that both `format:check` and `lint` walked the FILESYSTEM rather than the git
  index, so their result depended on whatever untracked files a machine happened to have: a cache
  directory, a stray scratch file. Both now read `git ls-files`, and both refuse an empty list
  rather than reporting success — the first repair had left them exiting 0 outside a git repository,
  having inspected nothing.

  A regression test runs the real gate against a throwaway three-file repository: an untracked bad
  file is ignored, a tracked bad file is caught, and no `.git` fails closed.

  No consumer-visible behaviour changes. Recorded here because the gate is what `prepublishOnly`
  runs, so this is what unblocks publishing at all.

- **`SelectList` now shows HOW MANY rows are hidden, not just that some are (B-022).** The
  overflow chrome went from a bare `▲` / `▼` to `▲ 3` / `▼ 8`, matching what `WindowedList`
  already rendered from the identical model. Both components consume the same view object;
  one was reading the counts and the other was reading booleans derived from those same
  counts, so the same list under two public components told the user two different things
  about the same state. A boolean cannot be turned back into a number, which is why the
  counts replaced the booleans in the model in the first place — this view had kept
  discarding them.

  **API docs corrected in the same change.** `WindowedList`'s TSDoc asserted that "`SelectList`
  renders a bare `▲` and throws away the `hiddenBefore`". That shipped: `tsup` builds declarations,
  so the sentence reached `dist/index.d.ts` and consumers read it as hover text. It is now three
  lines stating what the model carries and what this component renders — no version numbers, no
  history. A package whose CHANGELOG says a divergence is fixed while its API docs say it exists has
  told the reader two things.

  A third view — the slash / mention menu inside `ChatComposer` — still renders bare arrows.
  It is not part of this change: its `SlashMenu` type hand-re-declares the window contract
  instead of extending `WindowView`, so the counts arrive at runtime but are absent from the
  type. Registered as a followup rather than silently included, so that "both components
  consume the same view object" above is not read as "every arrow in the package now carries
  a count".

  **Blast radius, measured:** `grep -rn "SelectList" modelo/TheoCode/` → **6 hits, 0
  affected**. The single render passes 4 items and no `window`, against a default of 5, so
  nothing is hidden and no arrow is drawn either before or after this change.

  **Width cost:** none, and the guarantee is structural rather than a measurement of one case.
  The count lands on the arrow row, and the counter row (`(7/12)`) is always wider than the
  arrow row for every list size — so the arrow row can never be the widest line in the frame,
  at any count. Review measured this from 10 to 100,000 items with one-character labels: the
  arrow row grows from 3 to 7 columns while the widest line goes 9 → 10, never the arrow.

  The first version of this entry claimed the weaker thing and claimed it wrongly: it said the
  row "grows from 1 to 3 bytes" using `awk '{ print length }'`, which counts bytes, where `▼`
  is 3 bytes and `▼ 8` is 5 — so 1 → 3 was a column count wearing a byte label. It also gave
  a false reason ("a menu whose labels are shorter than `▼ 999` would widen"). Corrected here
  rather than quietly dropped, because the wrong version shipped in this section.

## [0.62.0] - 2026-08-18

### Changed

- **`windowFor` and `SelectList` refuse a window they cannot describe (B-021).** The hidden-row
  counts are a partition of the list, and a non-positive or fractional window made them describe
  something else: `window = 0` put `windowStart` past the selection so nothing rendered while both
  arrows still claimed rows, `window = -1` made the counts sum to 21 in a list of 20, and `2.5` hid
  seven and a half rows. `SelectList` exposes `window` publicly and passed it through unvalidated,
  so a consumer could get a menu that advertised contents it never drew. `windowFor`,
  `deriveSelectList` and `SelectList` now all throw a typed error naming the entry point the caller
  actually used.

  **What that means concretely, measured under `ink@7.1.0` rather than described as "throws":** a
  throw from a component's render tears the whole app down, a developer stack with absolute paths
  prints to stdout, and the process exits **0**. `render()` itself returns normally — but
  `waitUntilExit()` REJECTS with the guard's own error, so a consumer awaiting it does receive it.
  An earlier draft of this paragraph said the consumer "cannot catch it", which this package's own
  probe (`guard-sink.integration.test.tsx`) and `error-handling.md` § 3.1 both contradict. That is the package idiom across 21 guarded components and it is worse than the
  wording "throws a typed error" suggests, so it is stated plainly here rather than discovered. **Refused rather than clamped**, because the
  counts exist precisely to stop information being destroyed (U-10) and clamping would destroy the
  caller's mistake instead. Blast radius measured before shipping: the only known consumer renders
  `SelectList` without a `window` prop, and its `windowFor` mentions are comments explaining why it
  does NOT use it — `grep -rn "windowFor\|SelectList" modelo/TheoCode/` → 12 hits, 0 affected.
  (b021-window-invariant-2026-08-18)

## [0.61.0] - 2026-08-18

### Added

- **`reportGuardFailure` and `GuardSink` in `@theokit/tui` (B-025).** A boundary guard that fires
  now leaves one **durable** record — `[theokit/tui] <ISO-8601> <Component>: <message>` — on a sink
  that defaults to `process.stderr` and is injectable. It buys **persistence, not visibility**, and
  the distinction is the whole point: ink's own `ErrorBoundary` already prints an `ERROR` panel with
  a stack when a guard throws, but that panel is transient stdout, erased by the next repaint or
  lost to scrollback, and `installStderrGuard` does not capture it — so an operator debugging an
  intermittent guard has nothing to read. The record is **sanitised** (the offending value is
  untrusted by construction: interpolated verbatim it injected control bytes into the terminal and
  forged a second record via an embedded newline) and carries a **timestamp**, because the blessed
  destination is a log rotating at 10 MB across 10 generations. Reporting is additive — the return
  type is `never`, so the existing throw contract is unchanged. What this does NOT fix is filed as
  **B-031**: one invalid prop still unmounts the whole app, shows the end user a developer stack,
  and exits 0. (b025-silent-guards-2026-08-18)

### Changed

- **The guard record is sanitised against every line-breaking code point, and a malformed `error` is
  refused (B-025).** `JSON.stringify` escapes C0 only, so 33 code points reached the record raw —
  including U+0085, U+2028 and U+2029, which are Unicode line terminators: a reader that splits
  Unicode-aware still saw a second, well-formed, correctly-timestamped `[theokit/tui]` record, and
  U+009B / U+009D are the 8-bit CSI and OSC introducers. `reportGuardFailure` also read
  `error.message` without checking it, so a malformed argument threw from outside the guarded
  region — no record, no loss counted, and the guard's own diagnostic replaced by a `TypeError`
  about the reporter. Both are now refused, and both are pinned: reverting either turns four tests
  red, where before each was covered by nothing. (b025-silent-guards-2026-08-18)

- **`UsagePanel` refuses an unknown `order` section (B-025).** It crashed with
  `SECTION_RENDERERS[section] is not a function` — no record, no attribution, and a message naming a
  module-private constant the caller cannot see. A repeated name still draws twice and an empty list
  still draws nothing, both documented as deliberate; an unknown name is a typo and now says so,
  naming the component and the value. (b025-silent-guards-2026-08-18)

- **`GuardSink.write` returns `boolean`, and lost records are counted (B-025).** `false` is how
  `process.stderr` and this package's own `installStderrGuard` report a write that was LOST, and
  discarding it made a dead sink silent — the very failure the sink exists to prevent, one layer
  down. Losses are now counted and readable via `lostGuardRecords()`.

  Not marked BREAKING, and the earlier draft of this entry was wrong to: it claimed
  `reportGuardFailure` "shipped in 0.60.1" with a two-argument signature. Measured with
  `git ls-tree`, `src/status/guard-sink.ts` is absent from v0.59.0, v0.60.0 AND v0.60.1 — the whole
  surface is new and has never been published, so there is no consumer to break and the entry was
  positioned to derive a false MAJOR bump. Caught by review (F-dom-7).

- **`UsagePanel` now validates every `usage` field it forwards (B-025).** It guarded `contextWindow`
  and stopped there, so a non-finite `inputTokens` failed from inside `ContextWindowBar` and a bad
  `cost` from inside `CostMeter` — both naming a component the caller never wrote. `inputTokens`,
  `outputTokens` and the optional `cacheReadTokens` / `reasoningTokens` / `cost` are now refused at
  the panel's own boundary with an error that names `UsagePanel`, using the shared
  `assertFiniteNonNegative` rather than a re-inlined copy of it. Absent optional fields still pass
  and a present `0` is still accepted: absent stays absent, and `0` is a measurement the agent
  reported. No rendering changed. (b025-silent-guards-2026-08-18)

### Fixed

- **The last two guessed budgets in the suite become measured ones (B-034).** `degrade-matrix`
  spawns `pnpm exec tsx` three times per run and budgeted 20000 ms with nothing recorded beside it;
  one spawn measures 2621 ms at load 13, so that 7.6x margin still failed with `ETIMEDOUT` at load 30. Now 60000 ms, with the measurement in the code and the better fix named rather than
  overlooked: pre-compiling the probe and spawning `node` would take it to ~100 ms and remove the
  sensitivity instead of budgeting for it. `typeUntil` in the composer suite carried the third copy
  of the 2000 ms bound that B-033 measured expiring on a correct frame, and now shares the one
  budget. Measured after: **five consecutive `npm test` runs at default workers, loads 11.46 to
  31.07, all green** — where the suite previously failed routinely at load 13.
  (b034-measured-budgets-2026-08-18)

- **Tests wait for a condition instead of for a number of milliseconds (B-033).** 13 files slept a
  fixed duration and then asserted — encoding "the effect completes within N ms", which is true on
  an idle laptop and false on a loaded one. A shared `waitFor` polls the condition each site was
  really about and fails naming what never happened, which is how a defect in a different slice was
  identified rather than mistaken for a slow test. Five fixed-duration waits remain, each carrying a
  written reason: two are poll intervals inside bounded waits (already the target idiom), two are
  fixtures where the delay IS the subject, and one asserts that something does NOT happen, which has
  no condition to poll for. Internal to the test suite; no published behaviour changed.
  (b033-wait-for-condition-2026-08-18)

- **Two test-suite defects that were being treated as one (B-020).** `npm test` at default workers
  failed for reasons unrelated to the code under test, and the failures had two different causes.
  **A budget nobody set:** `vitest.config.ts` declared no `testTimeout`, so tests ran against
  vitest's 5000 ms default while `package-contract.test.ts` takes 3004 ms on an idle machine — 60%
  of the budget before any contention. Now 15000 ms, with the measurement recorded beside it; a
  raised timeout cannot mask a race, because a race reports a wrong value rather than a timeout.
  **An assertion that read a clock:** `same_status_rerender_does_not_reset_spinner` asserted the
  spinner cell had not CHANGED across a rerender, which conflates "the interval was not reset" — the
  behaviour under test — with "no time passed", which is not ours to guarantee. It now asserts the
  invariant it always meant: the cell is a valid `dots` frame and is not frame[0]. Internal to the
  test suite; no published behaviour changed. The remaining load-sensitivity is a third class,
  filed and planned as B-033. (b020-deterministic-frames-2026-08-18)

## [0.60.1] - 2026-08-18

### Fixed

- **`WindowedList` drew NOTHING when `selected` was `NaN` (B-026).** `windowFor` clamps with
  `Math.min(Math.max(selected, 0), count - 1)`, and every comparison against `NaN` is false — so
  `clampedIndex` and `windowStart` both became `NaN`, `rows.slice(NaN, NaN)` returned `[]`, and the
  list rendered empty: no error, no log, nothing on screen. The `window` prop had a guard and
  `selected` did not. A non-integer `selected` is now refused with a typed error naming the
  component; in-range integers are still clamped, and `-1` remains the "no selection" sentinel.
  (b026-windowedlist-nan-2026-08-18)

## [0.60.0] - 2026-08-18

### Added

- **`CLEAR_SCREEN_AND_SCROLLBACK` em `@theokit/tui/terminal` (B-013).** O item foi registrado
  **esperando ser morto** — uma linha de ANSI e exatamente onde o degrau 5 da parcimonia morde — e
  sobreviveu pela clausula escrita antes de medir. `\\x1b[2J\\x1b[H`, a variante sem apagar o
  scrollback, deixa a tela em branco e o cursor no topo: e exatamente o que um reset correto
  aparenta. A diferenca so aparece quando alguem rola para cima e encontra a conversa que lhe
  disseram estar apagada — e o atraso e ilimitado. Nenhum teste deste pacote enxerga isso: todas as
  assercoes sao sobre o frame renderizado, e scrollback e o que o terminal guarda fora dele. Entao
  o que e publicado e o NOME, nao os bytes: o pacote ja tinha a sequencia oposta, privada no output
  engine, correta la porque um redraw completo e dono da tela e nao pode destruir saida que nao
  escreveu. As duas diferem por tres caracteres e significam coisas opostas. (b013-clear-screen-2026-08-18)

## [0.59.0] - 2026-08-18

### Added

- **`useRisingEdge` — dizer quando piora, e so entao (B-011).** O pacote ja publicava os CANAIS
  para avisar o usuario — `Toast`, `Notice`, `notify` — e nenhum deles impunha QUANDO: `notify`
  escreve um bell a cada chamada, e o `Toast` disciplina a dispensa, nao o disparo. Entao a regra
  era reescrita a mao em cada consumidor, e a medicao mostrou que duas das oito linhas falham em
  SILENCIO: ler o nivel anterior depois de sobrescreve-lo faz os dois serem sempre iguais e o aviso
  nunca dispara; e o booleano de escalada precisa de uma clausula por par ascendente — esquecer uma
  faz o aviso URGENTE nunca chegar enquanto o primeiro ainda chega, ou seja, o usuario foi avisado
  uma vez e acredita que esta sendo avisado. Ambas produzem "o aviso nao aparece", que e invisivel
  porque ausencia de aviso parece ausencia de problema. O hook nao carrega limiar, classificador
  nem texto: decidir em QUE nivel voce esta e politica de quem chama. Nivel fora da ordem lanca
  erro tipado, validado no corpo do render — porque um throw dentro de efeito o React nao entrega
  como rejeicao, e o teste passaria vazio. (b011-rising-edge-2026-08-18)

## [0.58.0] - 2026-08-18

### Added

- **`useCoalesced` e o `createFrameBudget` que ninguem alcancava (B-009).** A premissa do item
  estava errada, e a verdade e um achado melhor: o orcamento de frame nao faltava.
  `src/renderer/frame-budget.ts` estava completo, coberto por nove testes, e tratava um salto de
  relogio para tras **melhor** que a copia do consumidor — considera a ancora obsoleta em vez de
  clampar, porque clampar perpetua o congelamento pelo tamanho do salto em vez de limita-lo a um
  frame. Ele so era **inalcancavel**: fora de todo barrel, importado por nada alem do proprio
  teste. E `npx knip` sem config — como o `/code-quality` o roda — dizia que a arvore estava limpa,
  porque um import de teste parece uso. O codigo morto nao passou por desatencao: o gate foi
  perguntado e respondeu que estava tudo bem. Agora ele e exportado, e o hook novo e construido
  **sobre** ele. O update final e obrigatorio, nao otimizacao: sem ele a ultima mudanca da janela
  nunca renderiza — o token final de um stream — e tudo parece certo ate o stream parar. Modo
  leitor de tela zera a janela: coalescer descarta estados intermediarios, que e exatamente o que
  um leitor de tela precisa anunciar. (b009-frame-budget-hook-2026-08-18)

## [0.57.0] - 2026-08-18

### Added

- **`selectSurface` — decidir qual superficie e dona da regiao sem desenhar nada (B-007).** Todo
  agente de terminal tem gate de confirmacao, login, pergunta e composer disputando uma linha, e a
  resposta e sempre um ternario aninhado dentro do JSX. A ordem E o contrato ali, e nao fica
  registrada em lugar nenhum: no consumidor medido ela atravessa **sete superficies em dois
  arquivos**. A justificativa nao e legibilidade — e o que da para testar. No mesmo repo, a
  precedencia de TECLAS e testada (o pacote ja publicou `routeThroughLayers`) e a de RENDER nao,
  porque observar quem vence exige MONTAR, e montar arrasta `@theocode/agent/config`, `/ask`,
  `/auth` e `node:os`. Aqui a selecao e pura: `selected.layer` e uma string que um teste afirma sem
  montar nada, e `render` e um thunk para que a superficie vencedora so seja construida quando
  alguem de fato for desenha-la. Nao mora em `@theokit/tui/keys` de proposito — aquele subpath
  promete ser livre de React. (b007-surface-layers-2026-08-18)

## [0.56.0] - 2026-08-18

### Added

- **`composerShortcutsFor` e `footerHintFor` — anunciar so o que o app realmente ligou (B-005).**
  Medido: cinco das quinze entradas de `DEFAULT_COMPOSER_SHORTCUTS` descrevem um recurso que o
  `ChatComposer` condiciona a um prop opcional, e uma delas — `Ctrl+C` — nao tem handler nenhum no
  composer. O rodape era pior do que o item dizia: o prop `hint` so e consultado na linha desenhada
  quando NAO ha modo ativo; a linha de modo acrescentava `· ← for agents` sem consultar prop algum,
  entao um app com modo de permissao e sem painel de agentes anunciava um e nao tinha como calar.
  Um prop que funciona em um ramo de dois e pior que prop nenhum, porque quem chama acredita ter
  desligado. Os defaults atuais ficam **intactos** — mudar default e a mudanca silenciosa, que e
  exatamente o defeito deste item. `Ctrl+C` mantem a linha e perde a atribuicao falsa: o defeito
  era de quem e o atalho, nao se ele existe. (b005-capability-affordances-2026-08-18)

## [0.55.0] - 2026-08-18

### Added

- **`WindowedList` — mostrar onde voce esta numa lista sem tomar o teclado (B-003).** A ancora
  centrada e as contagens `hiddenBefore`/`hiddenAfter` foram acrescentadas ao `windowFor` para um
  scrubber de historico, e a view que as justificou nunca foi entregue — entao o consumidor medido
  reconstruiu o clamp a mao, em 91 linhas cujo proprio docstring nomeia essas duas lacunas como
  motivo. `SelectList` nao servia, e nao pelo motivo esperado: o input dele **e** condicionado ao
  foco. O que o desqualifica e ser um MENU — chrome `filter:` obrigatorio, `onSubmit` requerido, e
  um `▲` pelado que descarta a contagem que ele mesmo calculou. O novo componente e presentacional
  (provado estruturalmente, nao prometido em docstring), o cabecalho e um SLOT porque e ali que um
  produto nomeia o proprio gesto, e as linhas ocultas aparecem como numero com glifo de direcao —
  sem palavra alguma para traduzir. Recusa `window` nao-positivo com erro tipado: medido, `window`
  igual a 0 devolve um `windowStart` DEPOIS da selecao, e -1 devolve contagens que somam mais que a
  lista inteira. (b003-history-overlay-2026-08-18)

## [0.54.0] - 2026-08-18

### Added

- **`UsagePanel` — os tres medidores de uso em um bloco (B-001).** `ContextWindowBar`,
  `TokenUsageChart` e `CostMeter` ja existiam separados e nada os compunha, entao todo consumidor de
  `readTurnUsage` escrevia a mesma projecao de `TurnUsage` para `TokenCategory` na mao — 13 linhas
  medidas em um consumidor real. As duas pontas dessa projecao sao deste pacote, entao uma mudanca
  em qualquer uma quebrava cada copia em silencio. A ordem vertical e um prop com default, nao um
  layout fixo: a medicao apontou a ordenacao como a UNICA parte da composicao que e decisao de
  produto. `contextWindow` e opcional porque `TurnUsage` nao carrega o tamanho da janela — sem ele a
  barra mostra a contagem absoluta em vez de inventar uma porcentagem; um numero nao-positivo
  explicito continua sendo erro de programacao e falha alto, nomeando o proprio componente.
  (b001-usage-panel-2026-08-18)

- **Varredura de review sobre o TheoCode — 3 achados registrados (B-015..B-017).** Primeira medicao
  sob o dominio `theocode-app` alargado. Os quatro gates do repo passam a mao em HEAD (typecheck,
  534 testes, knip, depcruise) e o achado esta no que ninguem roda: **`.github` nao existe e nunca
  existiu em 383 commits**, entao todo gate depende de alguem lembrar. Isso e o mecanismo por tras
  dos outros dois — `crossval` reporta 31 de 114 itens fechados sem `fixed_in` (contiguos B-096 a
  B-127, disciplina abandonada em data conhecida) e nenhum pipeline o invoca; e 15 arquivos alterados
  desde 2026-08-09 nao tem teste algum que os importe, incluindo uma recusa de delecao e um veto de
  seguranca. Um candidato foi rastreado ate o consumidor e **recusado** — `all-sessions.ts:132`
  parece engolir erro no caminho do GC e o chamador e fail-closed. Registrar o que foi checado e
  limpo e o que distingue uma varredura de uma que parou de olhar. (theocode-review-sweep-2026-08-18)

- **14 itens de backlog registrados — sete pares extracao/adocao.** Cada par e um componente: a
  extracao em `tui-library` e a adocao em `theocode-app` que a prova. A metade de adocao esta
  bloqueada na extracao e diz isso — e o que impede uma extracao de ser dada como pronta enquanto a
  duplicata que a justificou continua em disco. As extracoes entram `triaged` com ponteiro verificado
  (a medicao ja aconteceu); as adocoes entram `raw` com `evidence: none-yet`, porque o export que
  elas adotariam ainda nao existe e apontar para o arquivo a deletar nao e evidencia de defeito.
  - **theokit-tui:** backlog B-001 — `UsagePanel` — the three usage meters have no composed form, so every consumer assembles them (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-002 — Delete the local usage panel once the library ships one (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-003 — No overlay for walking backwards through history, though both halves it needs already shipped (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-004 — Retire the local backtrack overlay in favour of the library one (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-005 — Two channels advertise affordances the app never wired, and the default parameter is the cause (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-006 — Drop the local shortcut and footer-hint filters once the library gates them (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-007 — Nothing expresses which surface OWNS the input row, so consumers write a nested ternary chain (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-008 — Rewrite the input slot as declared layers (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-009 — No frame budget for derived timeline state, so a streaming turn re-derives on every token (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-010 — Consume the library's frame budget instead of the local one (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-011 — Warning on a threshold crossing has no primitive, so a per-turn warning is the easy default (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-012 — Keep the copy, drop the edge detector (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-013 — The clear-screen sequence is not published, and the half people omit is the scrollback (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-014 — Delete the local ANSI constant, or kill this item with its pair (backlog-init-2026-08-18)

- **`BACKLOG.md` — o registro de manutencao que faltava, e a tabela de roteamento corrigida.** O
  install trazia `rules/cycle-backlog.md` nomeando o ecossistema `theo-platform` (`theo`,
  `theo-cloud`, `theo-lens`, …), nenhum deles com checkout nesta arvore. Como `scripts/route_domain.py`
  parseia justamente essa tabela, todo repo daqui roteava para lugar nenhum e o gate G1 recusava
  qualquer item — uma tabela herdada que descrevia outro workspace nao e um default, e um defeito
  silencioso. Passa a declarar os dois dominios que existem em disco: `tui-library` (`theokit-tui`) e
  `theocode-app` (`TheoCode`, em `modelo/TheoCode/`), cada um com o especialista escrito
  (`.claude/agents/`), porque `route_domain.py` sai com codigo 3 quando a tabela nomeia um dono que
  nao esta no disco. O par e o ponto: a biblioteca publica as primitivas, o app e obrigado a escrever
  a mao o que ela nao entregou — e isso e a medicao. O gate 0.2 do `/backlog-init` (raiz
  guarda-chuva) foi dispensado deliberadamente e o motivo esta escrito no proprio arquivo, com o
  custo nomeado. Registro nasce vazio: item sem `why_now`, sem DoD e sem dono e herdado como se fosse
  decisao. (backlog-init-2026-08-18)

- **Gate de estrutura em CI — ADR 0003.** `tests/lint/structure.test.ts` reprova o PR que devolve um
  arquivo solto para a raiz de `src/`, cria pasta sem barrel, passa de 25 arquivos por pasta, exporta
  dois componentes do mesmo modulo, deixa componente inline com mais de 40 linhas, usa qualificador
  de teste fora do registro (`integration`, `e2e`), prefixa arquivo com id de milestone ou usa
  `-model` sem view ao lado. Segue o precedente de `tests/lint/no-ptbr.test.ts` — politica como
  teste, sem ferramenta nova — e roda dentro de `pnpm gates`. A deriva que motivou tudo isso passou
  por code review por 147 arquivos sem ser barrada: regra que so vive na cabeca do revisor erode.
  (architecture-review-2026-08)

- Secret scanning em duas camadas: um hook `pre-commit` que varre com o TruffleHog o conteúdo que
  está staged e recusa o commit, e `.github/workflows/secret-scan.yml`, que revarre no CI o intervalo
  empurrado. O hook é o que impede a credencial de entrar no histórico; o workflow é o que
  `git commit --no-verify` não consegue pular. Falsos positivos confirmados são silenciados linha a
  linha com um comentário `trufflehog:ignore`, nunca excluindo o caminho — excluir o caminho
  esconderia também um segredo real acrescentado depois àquele mesmo fixture. (secret-scanning-2026-08)

- **`windowFor` ganha ancora centrada, e a ajuda de teclado passa a derivar das capacidades — T3.4.**
  Duas metades que sobraram no consumidor. A janela ja reportava `hiddenBefore`/`hiddenAfter` como
  contagem desde a 0.53.0 (U-10); o que faltava era a **ancora** — a janela trailing prende a selecao
  na ultima linha, e um overlay que anda para tras no historico precisa dela no meio, com as linhas
  dos dois lados visiveis. Entrou como **opcao** com o comportamento atual no default: qualquer outra
  coisa re-ancora silenciosamente toda lista de todo consumidor no upgrade. Desvio deliberado do
  pseudo-codigo do plano, que propunha um `windowAround` novo: ja existia exatamente uma
  implementacao desse clamp, exportada e consumida, e uma irma ao lado seriam duas implementacoes de
  uma regra so, discordando na primeira vez que alguem tocar em qualquer uma (G12).

  `keyboardHelpFor` deriva o rodape de atalhos das mesmas capacidades que a superficie liga. O
  literal escrito a mao mora ao lado do handler que ele descreve sem nada segurando os dois juntos, e
  a falha e silenciosa e de mao unica: reamarra-se uma tecla e a ajuda continua anunciando a antiga,
  o usuario aperta e nada acontece, e nenhum teste quebra porque a string continua sendo a string.
  Capacidade sem tecla, com tecla em branco, ou desabilitada nao entra — anunciar um atalho que nao
  responde e pior do que nao mencionar.

- **Os mapas de apresentacao de tool chegam ao pacote — T3.1.** `ToolCallCard`, `ToolResult`,
  `ShellEnvelope` e os medidores ja vinham daqui; o que faltava era a metade que diz **qual nome le
  como**. Sem ela, todo produto escreve a sua: o consumidor medido carrega 292 linhas de
  `HEADERS_BY_TOOL` / `BODY_BY_TOOL` / `APPROVAL_LABELS`, mais um `tool_name_mismatch` escrito a mao
  no registry para segurar o contrato de chaves por disciplina. As duas metades sao nossas — as
  factories donas dos nomes, este pacote dono do render — entao este e o unico lugar onde elas podem
  ficar juntas. `DEFAULT_TOOL_PRESENTATION` traz 20 nomes medidos das factories; `toolPresentation()`
  aceita override parcial (trocar um header nao obriga a repetir os outros dezenove) e responde por
  qualquer nome, inclusive um que o produto inventou. Todo leitor trata a entrada como hostil: input e
  output de tool vem de um modelo e de subprocessos, e um render que estoura derruba a sessao por uma
  string que o modelo errou.

  Nota de acoplamento, registrada e nao resolvida: a lista de nomes e conhecimento duplicado. Este
  pacote **nao** importa `@theokit/agents` e nao deve — a dependencia corre no sentido contrario —
  entao `KNOWN_TOOL_NAMES` e literal e pode divergir. O custo da divergencia e um header generico em
  uma tool; o custo da alternativa e uma aresta de dependencia invertida para sempre.

### Changed

- **`src/` passa a ser organizado por dominio de produto, e nenhum componente exportado divide
  arquivo com outro — ADRs 0001/0002.** A superficie publica do pacote nao muda: os quatro subpaths
  (`.`, `./renderer`, `./terminal`, `./keys`) exportam exatamente os mesmos simbolos de antes, o que
  `tests/contract/export-surface.test.ts` e `tests/contract/public-api.integration.test.tsx`
  verificam a cada commit. O que muda e o caminho de arquivo de cada modulo dentro do pacote — quem
  fazia deep import (`@theokit/tui/dist/chat-composer.js`, nunca suportado) precisa passar pelo
  barrel. `src/` tinha 147 arquivos em um unico diretorio: 71 modulos, 61 testes co-locados e 15
  snapshots. Agora sao 14 pastas de dominio (`agent/`, `chat/`, `tools/`, `diff/`, `markdown/`,
  `prompts/`, `metrics/`, `branding/`, `layout/`, `status/`, `theme/`, `shortcuts/`, `search/`,
  `format/`), cada uma com barrel proprio, e `src/index.ts` caiu de 288 para 27 linhas — deixou de
  ser lista escrita a mao e ponto garantido de conflito de merge. `chat-composer.tsx` caiu de 806
  para 575 linhas: os sete componentes que dividiam o arquivo viraram modulos em `chat/composer/`.
  (architecture-review-2026-08)

- **A politica de export que vivia em comentario agora tem lugar proprio: `docs/adr/`.** O codigo
  citava ADRs por id (`D7`, `EC-10`, `arch-5`) que nao existiam como arquivo — 47 ids distintos em
  248 citacoes. `docs/adr/README.md` indexa cada um com todas as linhas que dependem dele, gerado
  por `docs/adr/build-legacy-index.py`. O indice torna os ids localizaveis; ele nao inventa a
  justificativa que nunca foi escrita. (architecture-review-2026-08)

- **`tests/` e `examples/` passam a ser divididos por proposito.** `tests/` ganhou
  `contract/`, `examples/`, `benchmarks/` e `fixtures/` ao lado do `renderer/` que ja existia;
  `examples/` ganhou `components/`, `scenes/` e `renderer/`. Os scripts `example:*` continuam
  valendo, apontando para os novos caminhos. (architecture-review-2026-08)

- **22 arquivos deixam de comecar por id de milestone.** `m17-skeleton-parity.md` ordenava por
  cronologia do projeto e nao dizia nada a quem le; o milestone agora fica dentro do arquivo.
  Vale para `benchmarks/baselines/*`, `tests/*` e `wiki/*`. (architecture-review-2026-08)

- **O sufixo `-model` passa a significar algo — ADR 0004.** Ele marcava a metade headless de um
  componente, mas acertava 3 vezes em 8, e outros 23 modulos headless nao o usavam. Agora so e
  valido quando existe a view de mesmo nome ao lado; os cinco que nao tinham par perderam o sufixo
  (`diff-model.ts` -> `diff.ts`, `markdown-model.ts` -> `markdown.ts`, e assim por diante).
  (architecture-review-2026-08)

- **O repositório passou para a organização oficial `usetheokit`.** Clones existentes continuam
  funcionando: o GitHub redireciona permanentemente o remote antigo `usetheodev/theokit-tui`. Os
  campos `repository`, `bugs` e `homepage`, o README, os exemplos que imprimem o link de documentação
  no terminal e o `NOTICE` agora apontam para `usetheokit`. (usetheokit/theokit#316)

- **O texto da licença Apache-2.0 foi completado com o apêndice de copyright.** O LICENSE trazia o
  corpo oficial, mas com o apêndice ainda no formato de instrução (`Copyright [yyyy] [name of
copyright owner]`), sem titular declarado. O `NOTICE`, por sua vez, atribuía a "Theo ecosystem
  contributors (usetheodev)" — divergente do titular usado em todos os outros repositórios. Os dois
  agora declaram `Copyright 2026 usetheo.dev`. (usetheokit/theokit#316)

- `sonar-project.properties` passa a declarar `sonar.organization=usetheokit` e
  `sonar.projectKey=usetheokit_theokit-tui`, acompanhando a mudança de organização. A organização e o
  projeto correspondentes precisam existir no SonarCloud — do contrário o step de análise falha.
  (usetheokit/theokit#316)

### Fixed

- **O gate `no-ptbr` parava de varrer na borda de outro repositorio.** `SCAN_ROOTS = ["."]` varre a
  arvore inteira — de proposito, porque uma lista mantida a mao apodrece assim que alguem adiciona um
  pacote. So que a arvore passou a conter `modelo/TheoCode`, um checkout proprio (383 commits) de um
  produto irmao nosso, com politica de idioma propria: 5 ofensas em `BACKLOG.md` e
  `tools/check-english-only.mjs` que este repositorio nao pode corrigir e nao deve reescrever —
  editar o historico de outro repo para satisfazer o nosso linter. O corte e estrutural, nao um nome
  em `SKIP_DIRS`: diretorio que carrega `.git` E outro repositorio, e "contem .git" nao envelhece,
  enquanto uma lista de exclusao envelhece no dia do segundo checkout. Custo zero de I/O — o
  `Dirent[]` ja estava em maos. Coberto por teste com poder de deteccao verificado por mutacao:
  desarmar o guard deixa o teste vermelho. (backlog-init-2026-08-18)

- **O guard `it_count_never_decreases` nao enxergava renames e morria com ENOENT.** Ele comparava o
  caminho do commit base com o disco; qualquer arquivo de teste movido o derrubava antes de contar.
  Agora indexa os testes atuais por basename (com unicidade verificada, para a premissa falhar alto
  se deixar de valer), carrega uma tabela explicita de renames deliberados e trata arquivo de teste
  realmente apagado como contagem zero — um enfraquecimento que a assercao **diz**, em vez de um
  crash. A deteccao de rename do proprio git foi testada antes e descartada com evidencia: contra um
  base distante, 120 de 161 movimentacoes puras ainda eram lidas como delete+add.
  (architecture-review-2026-08)

## [0.53.0] - 2026-08-14

### Added

- **`FreeTextInput` ganha um modo mascarado (`mask`) — U-9.** Um app de terminal que le uma API key
  tinha de reconstruir o componente inteiro para nao ecoar o que o usuario digita; o consumidor
  medido carrega 63 linhas de `SecretInput` proprio por causa disso, e copias reconstruidas sao
  justamente onde o texto puro vaza. `mask: true` usa `•`; uma string contribui seu primeiro
  grafema, para que um valor de varios caracteres nao infle o comprimento renderizado — vazar um
  comprimento errado ainda e vazar um comprimento.

  A mascara e uma questao de RENDERIZACAO: `onSubmit` continua recebendo o texto real. Um
  componente que mascarasse tambem o valor submetido seria silenciosamente inutil, e so no ponto em
  que a credencial falha — remotamente, depois, com uma mensagem de provider que nao diz nada sobre
  isso.

  E a colagem foi tratada porque um campo mascarado e onde se COLA: um valor vindo de gerenciador de
  senha chega como um pedaco unico que pode carregar quebra de linha. Inseri-la crua poe uma quebra
  dentro do segredo; deixa-la passar como Enter submete um segredo truncado. Nenhuma das duas falhas
  aparece ali — as duas surgem depois, como erro opaco de autenticacao.

  **O que este modo NAO promete:** manter o segredo fora da memoria. Ele vive no buffer como
  qualquer outro texto. Uma versao que o movesse para um `ref` seria o mesmo heap com uma historia
  mais forte — e a nota original que motivou este item afirmava que o consumidor mantinha o segredo
  fora do state do React, o que foi verificado e **e falso** (ele usa `useState`). A propriedade que
  este modo de fato entrega e a que importa num terminal: o texto puro nunca chega a tela, onde
  cairia no scrollback, num compartilhamento de tela ou numa sessao gravada.

- **`StatusFooter` passa a encaminhar `modeLabel` para a linha de modo — U-8.** O `ModeIndicator` ja
  aceitava `label` exatamente para um produto cujo vocabulario de permissao nao e este (um agente
  estilo Codex usa `suggest | auto-edit | full-auto`). O que faltava e que o rodape composto nunca
  encaminhava: a saida de emergencia ficava um nivel abaixo e fora de alcance, entao quem usava
  `StatusFooter` empilhava o modo no `left` e perdia a linha — que e o que o consumidor medido faz.

  **Encaminhar, nao alargar.** Alargar a uniao de `mode` deixaria `plna` renderizar como um modo;
  exigir que quem chama DIGA que esta fora do vocabulario mantem o typo sendo um erro e torna a
  saida explicita. `mode` segue encaminhado mesmo junto de `modeLabel`, para que a checagem de
  uniao fechada continue rodando — um chamador que passe um label e um modo com typo ouve sobre o
  typo.

## [0.52.1] - 2026-08-12

### Fixed

- **The suite no longer fails about one full run in twenty (B-125).** Two timing assumptions, both
  measured over twenty consecutive runs rather than reasoned about. `chat-composer` slept a fixed
  50ms after each simulated keystroke — its own comment already said a fixed sleep is flaky under
  load and that polling was the answer — and now waits for two identical consecutive frames.
  `chat-composer.onchange` assumed two ticks were enough for `useInput` to subscribe before writing;
  under load the keystroke was dropped and the failure surfaced two seconds later in a `waitFor`,
  far from the cause. It now writes until the key lands, which resends a lost event rather than
  retrying a failed assertion.

## [0.52.0] - 2026-08-11

### Added

- **`@theokit/tui/keys` — modal keypress routing (B-104 slice 2).** Layers are tried in declared
  order, the first whose `when` holds claims the key exclusively, and the result names WHICH layer
  claimed it. That last part is why it is worth extracting: precedence that cannot be observed cannot
  be tested. `./terminal` deferred this with a real objection — an interface shaped by one product's
  key states would give the second consumer something to route around — and the objection is answered
  rather than waived: what ships is the ordering rule, with states, keys and actions as type
  parameters. Nothing in the module names an overlay, a mode or a keystroke.

## [0.51.0] - 2026-08-11

### Added

- **`@theokit/tui/terminal` — the loop the components run inside (#B-104).** This package shipped ~60 widgets and none of what a terminal agent must build before a widget can be drawn safely. `installStderrGuard(logPath, { label })` redirects `process.stderr.write` for the session so a stray warning cannot corrupt the frame, and COUNTS what it could not write, reporting the loss once at teardown — falling back to the real stream would corrupt the frame, which is the thing being prevented, and staying silent produces a session where every diagnostic is dead and nothing says so. `createWriteQueue()` serialises writes per key, as a factory rather than module state so two consumers in one process do not serialise against each other, and a rejected operation rejects its own caller without poisoning the key. `rotateLog(path, { capBytes, keep })` caps a log by size, throwing on a nonsense argument and staying quiet on a full disk. A separate subpath because these reach `node:fs` and `process` while the root entry is React components. The keypress router is deliberately NOT included: its mechanism generalises, its contract is the consumer's vocabulary, and a public API shaped by one application gives the second consumer something to route around

## [0.50.4] - 2026-08-10

### Fixed

- The command menu closes once you start typing an argument. It matched on the first token after the slash, so `/sandbox read-only` still matched the command `sandbox` and the menu stayed open — Enter then completed the selection, replaced the line with the bare command and DISCARDED the argument. Measured in a consumer across three commands; one of them changed a security setting and failed silently, accepting the command and leaving the setting alone. Typing a space after the name is the user leaving selection and starting to write, so there is nothing left to choose (#B-089)

## [0.50.3] - 2026-08-10

### Fixed

- `Home` and `End` move the cursor in the composer. Every terminal form of both keys was already parsed and then thrown away: the names landed in `nonAlphanumericKeys` so the printable input was blanked, and `Key` carried no field to replace it, so the composer received no event at all. The motions they drive (`move-line-start` / `move-line-end`) already existed and were already bound to ctrl+a/ctrl+e, so this connects a built capability rather than adding one — and it goes through `defaultKeymap`, so both keys stay remappable. Measured in a consumer by A/B against another terminal agent over the same tmux channel, which ruled out terminal encoding (#B-068)

### Added

- `ModeIndicator` accepts `label`, so a product whose permission vocabulary is not this one can still use the row. `PermissionMode` is the Claude Code idiom (`default | auto-accept | plan`); a Codex-style agent has a different one, and the boundary check refused it — right for a typo, wrong for a different vocabulary, with no way to tell them apart. The union stays closed for `mode`, so a typo is still caught: a caller has to SAY it is outside the vocabulary rather than slip out of it (#U-8)
- `WindowView` reports `hiddenBefore` and `hiddenAfter`. `windowFor` already computed both — `windowStart` IS the count above — and reduced them to booleans, so a consumer rendering "N more above" had to recompute the same window arithmetic it had just asked for. The booleans remain, now derived from the counts (#U-10)

## [0.50.2] - 2026-08-08

### Fixed

- `WelcomeBanner` no longer lets a two-column layout overflow its own border. The box capped itself at `MAX_WIDTH` (60 cells), a limit sized for the single-column banner; with an `aside` the content is art + gutter + aside, which routinely exceeds it — and capping the frame did not shrink the content, it just let it run past the right border. The cap now applies to the one-column layout only, where it protects line length; the two-column layout uses the terminal width it was given (#U-7c)

## [0.50.1] - 2026-08-08

### Fixed

- `WelcomeBanner` no longer compresses `art` when an `aside` is present. The two-column branch grew the main column with `flexGrow` alone, so once art + gutter + aside exceeded the terminal Ink broke every art row across lines and pushed the tagline and hints out of the frame — making the `art` prop shipped in 0.50.0 usable only in the single-column layout that already worked. The column is now sized with `bannerArtWidth` and does not shrink; without `art` the previous behaviour is unchanged (#U-7b)

## [0.50.0] - 2026-08-08

### Added

- `WelcomeBanner` accepts `art`: a multi-line ASCII-art string rendered in place of the bold `name`, so art and the right-hand `aside` compose in one component. `Banner` had `art` and no `aside`; this had `aside` and no `art`, so the layout a coding agent actually ships — art on the left, a hints panel on the right — was reachable from neither, and a consumer rebuilt the whole box by hand to get both. It degrades to the bold `name` exactly as `Banner` does, and both now draw through the same `ArtBlock` (#U-7)

### Changed

- A documentação do repositório passou a viver em `wiki/`, uma base de conhecimento no formato Open Knowledge Format v0.2 (legível por agentes, com procedência e links entre conceitos); a pasta `docs/` foi removida e seus nove relatórios viraram doze conceitos — o registro de TTFATT agora é `wiki/benchmarks/ttfatt.md`
- Os baselines de benchmark saíram de `docs/benchmarks/` para `benchmarks/baselines/`, ao lado dos benches que os geram; quem regenera um baseline não precisa mais escrever fora da pasta de benchmarks

### Fixed

- `ChatComposer` não chama mais `onChange` com o texto inalterado quando o host re-renderiza passando uma arrow function nova — o callback é lido por ref, então não é preciso `useCallback` no consumidor (#59)
- As linhas do bloco `Explored` mantêm a indentação sob o galho `└` quando o alvo é longo demais para a largura do terminal, em vez de continuarem na coluna 0 (#59)
- O bloco `explored` da projeção de mensagens voltou a ter identidade estável entre renders quando seu conteúdo não muda — sem isso, a validação incremental da timeline reprocessava o histórico inteiro a cada token em qualquer sessão com um agrupamento de leituras (#66)
- `ChatMessage` com `markdown` e margem horizontal não estoura mais o terminal por uma célula — a coluna do conteúdo passou a repartir só o espaço que sobra do glifo, em vez de ser dimensionada pelo parágrafo inteiro sem quebra (#64)
- `AgentTimeline` passou a validar também os eventos `explored` na fronteira: ids duplicados entre as ferramentas agrupadas (e contra os ids de topo), bloco sem nenhuma ferramenta e status/exclusividade/`maxLines` inválidos agora falham com erro tipado, em vez de virarem aviso de `key` duplicada do React ou um cabeçalho "Explored (0)" vazio (#58)
- `AgentTimeline` passou a limitar o diff inline em 20 linhas por padrão — um resultado grande de `apply_patch` não inunda mais o transcript, e o teto explícito por evento (`maxLines`) continua valendo (#57)
- `ChatMessage` com margem horizontal (`marginLeft`/`marginRight`/`marginX`/`margin`) não estoura mais a largura do terminal — a margem passou a ser descontada da largura fixada, eliminando a quebra no meio da palavra que voltava a acontecer nessas mensagens (#56)
