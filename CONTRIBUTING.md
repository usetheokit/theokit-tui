# Contributing to `@theokit/tui`

Thanks for helping build the Theo terminal UI primitives. The exported TypeScript types are the
canonical API contract — the code is the documentation.

By taking part you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md). Security problems do
**not** go in an issue — see [SECURITY.md](./SECURITY.md).

## Quick start

```bash
nvm use                                   # Node 22+
corepack enable && corepack prepare pnpm@10.34.1 --activate
pnpm install --frozen-lockfile
pnpm gates                                # format:check + lint + typecheck + depcruise + build + test
```

`pnpm gates` runs the same sequence CI runs.

One caveat comes with the workspace: **turbo caches task results per package, and it keys that
cache on declared inputs only.** A change outside them — a root file, a lockfile, a rebuilt native
module — does not invalidate it, so a cached PASS can describe a tree that no longer exists.
Measured while adopting the workspace: `node-pty` was rebuilt, four PTY tests went from skipped to
passing, and `pnpm test` kept replaying the cached run that skipped them. After touching anything
outside a package's `src`/`tests`, force a real run:

```bash
npx turbo run test --filter='./packages/*' --force
```

**`auto-install-peers=false` in `.npmrc` is deliberate — do not flip it.** `figlet` and `lowlight`
are _optional_ peers. `figlet` is deliberately not installed, and
`figlet-art.test.ts → returns_null_when_figlet_is_absent` proves the real import failure degrades to
`null` instead of throwing. Auto-installing peers would put `figlet` in the tree and that test would
stop testing anything. A missing-peer warning for `figlet` during install is expected.

## Branch model

The flow is `workspace → develop → main`.

- **All work happens on `workspace`.** Features, fixes, refactors, docs, chores — everything commits
  there. We do **not** use feature branches by default.
- **`develop` integrates.** It only advances through a `workspace → develop` pull request.
- **`main` is release-only.** It receives release merges (`develop → main` PR + a semver tag) —
  never direct commits.
- Never use `git checkout` (use `git switch` / `git restore`), `git revert` (write an explicit
  reversing commit), `git reset --hard` (use `git stash` / `--soft`), or `git push --force` on
  `main` / `develop` / `workspace`.

## Commit conventions

- Conventional-commit prefixes: `feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `style` /
  `ci` / `perf` / `build`.
- **No AI co-author trailers** (enforced by a git hook under `.githooks/`).
- Reference the backlog item ID when there is one (`B-074`).
- Say _why_, not only _what_. A message that explains the reasoning is the only place that reasoning
  survives.

## Before you open a PR

- [ ] `pnpm gates` is green locally.
- [ ] **TDD** — the failing test came first; a bug fix ships with its regression test.
- [ ] **Public API changed?** Update the domain barrel that exports it — barrels are the surface, and
      `src/index.ts` only re-exports them (ADR 0002).
- [ ] `CHANGELOG.md` `[Unreleased]` updated when the change is user-visible. Entries are written in
      **English** and address the consumer, not the implementer.
- [ ] File naming passes `pnpm validate:naming` — kebab-case, enforced by `.ls-lint.yml`.

## Running an example

The `example:*` scripts live in the package, not at the root, so reach them through the filter:

```bash
pnpm --filter=@theokit/tui run example:chat     # or example:agent, example:banner, …
```

Verified after the workspace move — `example:banner` renders. They are deliberately not aliased at
the root: sixteen pass-through scripts would be sixteen things to keep in sync for one package.

## Repository layout

```
packages/tui/src/<domain>/   one product domain per folder, each owning its public barrel (ADR 0001, 0002)
packages/tui/src/renderer/   the differential terminal engine — output, input and layout
packages/tui/tests/          every test, mirroring src/ plus the cross-cutting suites
packages/tui/scripts/        package gates invoked from its package.json
assets/                      brand artwork
wiki/                        the OKF knowledge bundle — measured records, parity gates, benchmarks
CHANGELOG.md                 the single changelog, and the source of the next version
```

The workspace holds one package today. Its shape matches `theokit-sdk` so the tooling — `biome.json`,
`.ls-lint.yml`, `.dependency-cruiser.cjs`, `turbo.json` — sits in the same place in both repos.

**Cutting a release needs `--root packages/tui`.** The release scripts look for the published
manifest at the repository root, and since the workspace migration the root `package.json` is
private and carries no `version`. `bump_version.py` refuses outright rather than writing to the
wrong file — pass `--root packages/tui` and it updates both sites (the manifest and the `VERSION`
constant a consumer reads at runtime). This note lives here because those scripts are installed
tooling and are not versioned with the project.

**Releases do NOT use changesets, unlike `theokit-sdk`.** `rules/cycle-release.md` derives the next
version from this repository's single `CHANGELOG.md` `[Unreleased]` section and cuts one semver tag;
changesets would replace both the changelog and that derivation. Changing it is a release-process
decision, not a layout one, and needs an ADR.

`src/index.ts` re-exports domain barrels and does nothing else. Export policy lives in each domain's
barrel, next to the code it governs.

## Test structure

Structure every test as **Arrange → Act → Assert**, separated by a blank line. Comment markers are
optional once the blank line does the separating:

```tsx
it("renders nothing when the window is empty", () => {
  const rows = [];

  const { lastFrame } = render(<WindowedList rows={rows} selected={0} />);

  expect(lastFrame()).toBe("");
});
```

Two rules this package learned the hard way and enforces:

- **A test must wait on a signal the intermediate state cannot satisfy.** A fixed sleep is satisfied
  by the passage of time, which the code does not control — that class of flake cost this repo the
  B-020 / B-033 / B-034 chain. Wait for the state, not for a duration.
- **A test that asserts nothing happened must be able to fail.** Seven such tests were found asserting
  against a condition that was never reachable (B-068).

## Degrade matrix

Every primitive must degrade cleanly under `NO_COLOR`, `TERM=dumb` and bare pipes. This is proven by
a subprocess matrix in CI, not by inspection — if you add a component that branches on colour, it
branches on **theme data resolved at the provider**, never on `process.env`.

## Reporting a bug

Open an issue with: the version, a minimal reproduction, what you expected, what happened, and the
terminal + `TERM` value. A failing test is ideal.
