import { reportGuardFailure } from "../status/guard-sink.js";
import { hasControlBytes } from "./ansi.js";

// M25 terminal OSC helpers (plan m25-parity-polish-audit T4.1, ADR D): the
// terminal-title (OSC 0) + hyperlink (OSC 8) helpers, mirroring the M24 notify.ts
// capability-gate shape — pure, injectable env/out, and a no-op / plain-text
// degrade off-TTY or under a multiplexer (never write a raw escape into a pipe or
// a multiplexer stream). `title`/`url`/`text` are REFUSED when they carry a control
// byte (B-086): such a byte terminates the OSC and lets what follows run as a new
// command. The note that used to sit here said to sanitize upstream, which was a
// comment standing in for a control on functions whose real callers are consumers this repo
// cannot see. (The examples under `examples/` do call them — with clean literals — so the
// premise "zero in-repo callers" was wrong; the conclusion was not.)
//
// That near-miss is worth one more line, because the general rule is NOT "check your claims".
// A claim stronger than its argument needs goes unchecked PRECISELY BECAUSE it is doing no work
// — nobody audits a premise the conclusion does not rest on. Here it cost nothing: four callers
// instead of zero, and the fix stood. A sibling repo hit the identical defect in a claim that
// justified DELETING a test, and there the same wrong premise would have removed the only
// coverage of a whole surface.
//
// Nothing in the shape of the claim tells you which of the two you have. So the line to hold is
// narrower and checkable: VERIFY BEFORE YOU REMOVE. A premise that only supports keeping
// something can be wrong and survive; one that justifies a deletion cannot.

/** A stdout-like sink: `write` + the TTY flag (injectable for tests). */
export interface OscSink {
  isTTY?: boolean;
  write(data: string): void;
}

const underMultiplexer = (env: NodeJS.ProcessEnv): boolean =>
  env.TMUX !== undefined || env.STY !== undefined || env.ZELLIJ !== undefined;

/**
 * Refuses a caller value that could close the OSC and open a new one.
 *
 * B-086 — measured, `setTerminalTitle("ok" + BEL + osc52Payload)` emitted `ESC ] 0 ; ok BEL`
 * followed by a COMPLETE OSC 52 clipboard write. Not a corrupted string: a second command. That is
 * CVE-2026-47090's shape — an OSC emitter interpolating caller values without encoding them.
 *
 * It REJECTS rather than strips, and that is a decision (ADR D1). These are EMITTERS: the caller
 * chose the value, so a control byte is a defect in their code rather than hostile data arriving
 * from outside. Silently repairing it would hide their bug and leave them shipping a title that is
 * not the title they wrote (`rules/error-handling.md` § 2).
 *
 * A character predicate rather than a sequence matcher, because a matcher cannot see a lone `ESC`
 * with no terminator — the branch where `less` failed in CVE-2022-46663.
 */
function refuseControlBytes(value: string, argument: string): void {
  if (!hasControlBytes(value)) return;
  reportGuardFailure(
    "terminal-osc",
    new RangeError(
      `terminal-osc: ${argument} must not contain control bytes — such a byte terminates the OSC sequence and lets what follows run as a new command`,
    ),
  );
}

/**
 * Set the terminal window/tab title (OSC 0).
 *
 * A no-op on a non-TTY sink — but it still REFUSES a `title` carrying a control byte first, so an
 * off-TTY call that would have written nothing now throws (B-086). That ordering is deliberate:
 * off-TTY is where tests and CI run, so it surfaces a caller's bug before a real terminal sees it.
 *
 * Unlike `osc8Link`, this does NOT gate on a multiplexer: tmux/screen pass OSC-0 title sequences
 * through to the outer terminal, so gating would break title-passthrough (whereas OSC-8 hyperlinks
 * are not reliably forwarded — hence the asymmetry).
 *
 * @throws RangeError via `reportGuardFailure` when `title` contains a C0/C1 control byte.
 */
export function setTerminalTitle(title: string, out: OscSink = process.stdout): void {
  refuseControlBytes(title, "title");
  if (out.isTTY !== true) return;
  out.write(`\x1b]0;${title}\x07`);
}

/** True when an OSC-8 hyperlink is safe to emit (a TTY, not under a multiplexer). */
export function supportsHyperlinks(
  env: NodeJS.ProcessEnv = process.env,
  out: { isTTY?: boolean } = process.stdout,
): boolean {
  return out.isTTY === true && !underMultiplexer(env);
}

/**
 * Wrap `text` in an OSC-8 hyperlink to `url` when the terminal supports it;
 * otherwise return `text` verbatim (graceful degrade — the link is decorative).
 */
export function osc8Link(
  text: string,
  url: string,
  env: NodeJS.ProcessEnv = process.env,
  out: { isTTY?: boolean } = process.stdout,
): string {
  refuseControlBytes(url, "url");
  refuseControlBytes(text, "text");
  if (!supportsHyperlinks(env, out)) return text;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
