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

/**
 * `ESC [ <digits and semicolons> m` — the colour/style (SGR) family.
 *
 * The escape is written as `\u001B` rather than the raw byte, because a raw `0x1B` in source is
 * invisible to `grep` — which is precisely how four sites in this repo came to omit it and strip
 * nothing for a whole slice without anyone noticing. `no-control-regex` fires on either spelling,
 * so the suppression is unavoidable here and is scoped to this one line.
 */
// eslint-disable-next-line no-control-regex
const SGR_RE = /\u001B\[[0-9;]*m/g;

/**
 * Removes SGR escape sequences, escape byte included.
 *
 * Adjacent colour runs join, so a two-tone progress bar reads back as one string — the contract
 * `metrics/progress-bar.test.tsx:7` documented in a comment before any module enforced it.
 */
export function stripAnsi(value: string): string {
  return value.replace(SGR_RE, "");
}

/**
 * `ESC ] … (BEL | ESC \\)` — the OSC family, terminated either way.
 *
 * Non-greedy so a payload carrying two OSC strings does not collapse into one match.
 */
// eslint-disable-next-line no-control-regex
const OSC_RE = /\u001B\][\s\S]*?(?:\u0007|\u001B\\)/g;

/** `ESC [ … <final byte>` — the CSI family, whatever the final byte is. */
// eslint-disable-next-line no-control-regex
const CSI_RE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

/**
 * Every remaining C0 and C1 control byte except the three a code block legitimately carries.
 *
 * B-078 — this backstop, not the two matchers above, is what carries the safety property. A
 * structural matcher for `OSC … terminator` cannot match an OSC that never terminates, and a
 * TRUNCATED sequence is exactly the shape of CVE-2022-46663 in `less` — whose one-line fix reads
 * "End OSC8 hyperlink on invalid embedded escape sequence". An emitter or a filter is only as safe
 * as its error handling, so the last pass is stateless and cannot desynchronise.
 *
 * `\t`, `\n` and `\r` survive because `toCodeLines` splits on newlines and expands tabs; removing
 * them would corrupt every code block rather than protect one. U+0080-U+009F go too: the 8-bit C1
 * forms are an alternative spelling of the same sequences, and `U+009D` is 8-bit OSC.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Strips every escape sequence and stray control byte from text this package was HANDED.
 *
 * Distinct from {@link stripAnsi} on purpose, and the reason is responsibility rather than blast
 * radius (B-078 ADR D1). `stripAnsi` removes colour from output this library AUTHORED, where the
 * only sequences present are the ones it emitted; this removes everything from content it did not
 * author and cannot vouch for. `gh` draws the same line between `IOStreams.Out`, which "does not
 * sanitize and never should", and `IOStreams.ContentOut`, which always does.
 *
 * Measured: as of `ink@7.1.0` an OSC 8 hyperlink reaches the rendered frame byte-for-byte, so a
 * model's output could make arbitrary text clickable and — via OSC 52, which survives on five of
 * nine terminals read from their own source — silently overwrite the user's clipboard.
 *
 * Deliberately NOT exported from `src/format/index.ts`: the published surface is a decision, and
 * this is a sink-specific control rather than a general utility.
 */
export function sanitizeUntrusted(value: string): string {
  return value.replace(OSC_RE, "").replace(CSI_RE, "").replace(CONTROL_RE, "");
}

/**
 * True when `value` carries any C0 or C1 control byte, tabs and newlines included.
 *
 * B-086 — the predicate half of {@link sanitizeUntrusted}'s character class, exported so there is
 * ONE definition of "control byte" in this package rather than two. B-055 exists because 39 copies
 * of one ANSI pattern drifted into three spellings, one of them wrong; a second definition here
 * would be that defect starting over.
 *
 * Stricter than `sanitizeUntrusted`'s removal set on purpose: that function KEEPS `\t`, `\n` and
 * `\r` because a code block needs them, while an OSC payload does not — a tab or a newline in a
 * window title is meaningless, and either can act as a separator in some parsers.
 */
export function hasControlBytes(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001F\u007F-\u009F]/.test(value);
}
