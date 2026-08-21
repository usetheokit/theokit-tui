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

## Repository layout

```
src/<domain>/        one product domain per folder, each owning its public barrel (ADR 0001, 0002)
src/renderer/        the differential terminal engine — output, input and layout
tests/               cross-cutting suites: contract, degrade matrix, lint, examples
wiki/                the OKF knowledge bundle — measured records, parity gates, benchmarks
assets/              brand artwork
scripts/             repo gates invoked from package.json
```

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
