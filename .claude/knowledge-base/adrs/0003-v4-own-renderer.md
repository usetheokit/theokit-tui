# ADR 0003 — V4: own renderer, keeping React

**Date:** 2026-07-08 · **Status:** accepted (owner decision)

## Context

The pi/tui gap analysis (references/pi, MIT, 68k stars) proved that
renderer-level capabilities — CSI-2026 synchronized (flicker-free) output,
fine-grained differential rendering, bracketed-paste atomic segments,
inline images — are unreachable from userland Ink. The roadmap carried an
explicit out-of-scope: "A homegrown TUI framework — we use Ink".

## Decision

Build OUR renderer (V4 program, M17–M21) while KEEPING React: a custom
`react-reconciler` host exposing Box/Text/useInput/useStdout/Static-
compatible primitives, Yoga for layout (the same engine Ink uses — parity
by construction), our own output engine (3-strategy diff + CSI-2026, the
pi lessons) and input stack (bracketed paste, kitty protocol, remappable
keybindings). The React component API remains the product thesis — the
20+ shipped components and their 575 tests are the compatibility gate.

## Alternatives rejected

- **Ink fork (gemini-cli path):** fastest flicker win, but permanent fork
  maintenance and no ownership of input/images/scrollback.
- **Standalone renderer without React (pi path):** maximal capability but
  a total component rewrite AND abandons the React-devs thesis — pi/tui
  already exists for that audience.
- **Stay on Ink + capability V4 only:** leaves flicker/paste/images
  permanently platform-capped.

## Consequences

- Out-of-scope item removed with a dated note (ROADMAP § out of scope).
- M20 carries the go/no-go cutover gate (human-approved ADR before any
  default-engine flip); Ink remains the default until then.
- Rule 9 tension resolved explicitly: we reuse react-reconciler + Yoga
  (the hard, solved parts) and own only the terminal-specific engine
  where the differentiation lives.
