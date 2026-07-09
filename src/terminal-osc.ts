// M25 terminal OSC helpers (plan m25-parity-polish-audit T4.1, ADR D): the
// terminal-title (OSC 0) + hyperlink (OSC 8) helpers, mirroring the M24 notify.ts
// capability-gate shape — pure, injectable env/out, and a no-op / plain-text
// degrade off-TTY or under a multiplexer (never write a raw escape into a pipe or
// a multiplexer stream). NOTE: `title`/`url` are written VERBATIM — an embedded
// BEL/ESC corrupts the sequence; sanitize upstream if untrusted.

/** A stdout-like sink: `write` + the TTY flag (injectable for tests). */
export interface OscSink {
  isTTY?: boolean;
  write(data: string): void;
}

const underMultiplexer = (env: NodeJS.ProcessEnv): boolean =>
  env["TMUX"] !== undefined ||
  env["STY"] !== undefined ||
  env["ZELLIJ"] !== undefined;

/** Set the terminal window/tab title (OSC 0). A no-op on a non-TTY sink. Unlike
 * `osc8Link`, this does NOT gate on a multiplexer: tmux/screen pass OSC-0 title
 * sequences through to the outer terminal, so gating would break title-passthrough
 * (whereas OSC-8 hyperlinks are not reliably forwarded — hence the asymmetry). */
export function setTerminalTitle(
  title: string,
  out: OscSink = process.stdout,
): void {
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
  if (!supportsHyperlinks(env, out)) return text;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
