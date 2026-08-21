# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it through GitHub's private vulnerability reporting, which is enabled on this
repository:

**[Report a vulnerability](https://github.com/usetheokit/theokit-tui/security/advisories/new)**

That form opens a private thread visible only to the maintainers. It is the only
channel we can promise to read for this — there is no security mailing list, and a
DM or a comment on an unrelated issue will be missed.

If you cannot use the form, open a public issue containing **only** the sentence
"requesting a private channel for a security report" and nothing about the finding
itself, and a maintainer will open the private thread.

### What to include

The same things any bug report needs, plus the reach of the problem:

- Affected version (`@theokit/tui@0.76.1`) and which entry point (`.`, `./renderer`,
  `./terminal`, `./keys`).
- What an attacker can do, stated concretely — write outside the log path, inject a
  terminal control sequence a host application did not intend, recover a credential
  from a diagnostic record.
- The smallest reproduction you have. A failing test is ideal; exact steps are fine.
- The terminal emulator and `TERM` value, when the finding depends on them.
- Anything about the impact you are unsure of. An honest "I could reach X but not
  prove Y" is more useful than a guess in either direction.

**Never include a real credential in the report.** If a key of yours leaked, rotate it
first, then report the code path that leaked it.

### What to expect

- **Acknowledgement within 3 business days.** If you do not hear back, the report did
  not reach us — please ping the thread.
- **An assessment within 10 business days**: whether we can reproduce it, the severity
  we assign and why, and whether we intend to fix it.
- **A fix in a patch release** for anything we accept as a vulnerability, with a
  GitHub Security Advisory and a CVE where one applies.
- **Credit in the advisory** under the name you choose, unless you prefer not to be
  named.

We do not run a paid bounty programme.

### Disclosure

We ask for coordinated disclosure: give us the assessment window above before going
public, and we will agree a date with you rather than let a report sit indefinitely.
If a fix is going to take longer than expected, we will tell you why instead of going
quiet.

If you find a vulnerability that is already public, or being exploited, say so in the
report — that changes the timeline and we will treat it accordingly.

## Supported versions

| Version                                       | Supported           |
| --------------------------------------------- | ------------------- |
| `@theokit/tui` 0.76.x                         | Yes                 |
| `@theokit/tui` 0.10.x (react 18 / ink 5 line) | Critical fixes only |
| Anything earlier                              | No                  |

The API is pre-1.0 and follows semver: under `0.x` a breaking change is a **minor**.
Fixes land on the latest minor; we do not backport to earlier ones.

## What is in scope

This package writes bytes to a terminal, parses input from it, and — through
`@theokit/tui/terminal` — writes diagnostic records to a file on disk. Findings in any
of that are in scope, in particular:

- **Terminal control-sequence injection.** Caller-supplied or model-supplied content
  reaching the terminal with escape sequences intact, where this package sanitises it
  internally — `CodeBlock` routes its input through `sanitizeUntrusted`, and the
  differential output engine measures width on sanitised text. Note that neither
  `sanitizeUntrusted` nor `stripAnsi` is part of the published surface: they are
  module-internal, so a consumer rendering untrusted text through a plain `Text` is
  outside what this package can defend.
- **Path traversal or unsafe write in the log sink.** `installStderrGuard` and
  `rotateLog` take a caller-supplied path and rotate files at it.
- **Credential leakage into a diagnostic record.** A guard sink record is written to
  disk; a component that puts a caller's secret prop into that record is a bug of this
  class, not a cosmetic one.
- **Unbounded resource use from untrusted content** — a diff, a markdown block or a
  code fence that makes a parser here hang or exhaust memory on input a consumer would
  reasonably feed it (agent output).
- **Supply-chain problems in what we publish**: the released tarball's contents, its
  provenance, or this repository's release workflow.

## What is not in scope

- A model producing wrong, harmful or offensive output that this package then renders.
  This package renders what the caller gives it — it is not a content filter, and says
  so in its data-props contract.
- An attacker who already has code execution on the machine running the CLI.
- A host application rendering untrusted content through its own `Text` rather than
  through a primitive of ours that sanitises. We publish no sanitising helper today, so
  this is a gap in the surface rather than a vulnerability in it — report it as a
  feature request, not an advisory. If the documentation implied such a helper exists,
  that documentation bug **is** in scope.
- Vulnerabilities in `ink`, `react`, `yoga-layout` or another dependency rather than in
  our use of it — report those upstream, and tell us so we can bump.
- Denial of service through obviously unbounded input to a local render call, absent a
  concrete impact beyond the caller's own process.

When in doubt, report it. Deciding scope is our job, not yours.
