// B-055 — the ONE ANSI stripper for this package.
//
// Deliberately NOT listed in `./index.ts`. `package.json`'s `exports` map declares four subpaths
// with no wildcard, so a module absent from the barrel reaches no consumer and this file costs no
// semver event. It follows the precedent `format.ts:17` already sets in this same domain:
// production-importable, module-internal by construction rather than by comment.
//
// It replaced 39 hand-rolled constructs across 35 files, in four spellings. Three of them —
// ``, a raw 0x1B byte, and `String.fromCharCode(27)` — all denote U+001B and were equivalent.
// The fourth omitted the ESC entirely and therefore stripped nothing: measured against the shipped
// Banner, it left all 8 escape bytes in place while deleting the SGR parameters, so a frame it
// "stripped" still failed an exact-equality assertion and passed every substring one.
//
// SCOPE IS SGR ONLY, and that is a decision rather than a limitation (ADR D2). Every site this
// replaced stripped `ESC [ <digits;> m` and nothing else, so keeping that scope makes the migration
// byte-identical — which is what lets a snapshot diff mean "the semantics moved" instead of noise.
// Widening to the OSC families is a behaviour change to `markdown/code-block.tsx:184`, which
// sanitises untrusted input, and is registered as B-078 rather than smuggled in here.

/** `ESC [ <digits and semicolons> m` — the colour/style (SGR) family. */
const SGR_RE = /\[[0-9;]*m/g;

/**
 * Removes SGR escape sequences, escape byte included.
 *
 * Adjacent colour runs join, so a two-tone progress bar reads back as one string — the contract
 * `metrics/progress-bar.test.tsx:7` documented in a comment before any module enforced it.
 */
export function stripAnsi(value: string): string {
  return value.replace(SGR_RE, "");
}
