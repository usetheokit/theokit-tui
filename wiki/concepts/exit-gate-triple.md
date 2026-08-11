---
type: Convention
title: Exit-gate triple
description: The bar a component-parity row must clear to be graded ✓ — a component, a passing oracle set and a runnable example — plus the adversarial refutation panel that grades it.
tags: [parity, process, quality-gate, v4]
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

# The rule

A row in the [V4 parity matrix](/parity/v4-parity-matrix.md) flips to `✓` only
when it has all three legs **and** no refutation stands:

Component
: A real implementation in `src/` — not a plan, not a prop stub.

Oracle set
: Passing tests that pin the behaviour, including its edge cases.

Example
: A runnable `examples/*.tsx` that exercises it end to end.

# Who grades it

Not the author. The M25 re-audit was run as an **adversarial 2-specialist
refutation panel** (modelled on the house `cycle-review.md`): each specialist
tried to _refute_ a proposed `✓`, and the row survived only if no refutation
stood.[^m25-report] This is the guard against the failure mode the gate exists
for — a self-graded matrix where a plan counts as a shipped component.

# The universality bar, and the honest exception

Parity is _required_ for a category present in **≥ 4 of the 7 peer CLIs**
(universal). Two M25 rows shipped `✓` while sitting below that bar — intra-line
diff highlight (~3.5/7) and the OSC helpers (~3.5/7). They are graded `✓†` with
an explicit note rather than silently as required-universal rows, because each
fully satisfies the triple with no standing refutation.[^matrix]

That distinction is the convention's point: the marker records _why_ a row is
green, so a later reader cannot mistake bonus parity for a mandated row.

# Applied

- The gate's outcome for V4 → [M25 exit-gate re-audit](/parity/m25-exit-gate-re-audit.md).
- The same discipline applied to a look-and-feel change → [M26 component UX parity](/parity/m26-component-ux-parity.md),
  where four of five surfaces were honest `no-change` decisions.

[^matrix]: V4 parity matrix, § Exit gate and the `†` honesty note.

[^m25-report]: M25 parity re-audit report, § header and § Rows audited.
