// M24 desktop-notify helper (plan m24-live-progress-surfaces T4.1, ADR D5): a
// CONSERVATIVE OSC-9 gate + the imperative `notify()` writer. Mirrors the M21
// image capability matrix (`terminal-image.ts`): an ordered rule set, multiplexer
// first, injectable env, no module cache. M24 scope is OSC-9 + BEL only — a
// terminal that natively wants OSC-99 (kitty) / OSC-777 (wezterm) gets a BEL, not
// a stray OSC-9 it can't parse; under tmux/screen/zellij we SUPPRESS (a raw OSC-9
// would leak visible bytes through the multiplexer).

export type NotifyProtocol = "osc9" | "bel";

/** A stdout-like sink: `write` + the TTY flag (injectable for tests). */
export interface NotifySink {
  isTTY?: boolean;
  write(data: string): void;
}

/** Pick the notify protocol for this env, or `null` to suppress. Pure. */
export function detectNotifyProtocol(
  env: NodeJS.ProcessEnv,
): NotifyProtocol | null {
  // A multiplexer wins first — never emit a raw escape that leaks through it.
  if (env["TMUX"] || env["STY"] || env["ZELLIJ"]) return null;
  // OSC-9 only where it is KNOWN-supported (iTerm2 / ConEmu).
  if (
    env["TERM_PROGRAM"] === "iTerm.app" ||
    env["ITERM_SESSION_ID"] !== undefined ||
    env["ConEmuPID"] !== undefined
  ) {
    return "osc9";
  }
  // Everything else — a bell is the safe, universally-understood fallback.
  return "bel";
}

/**
 * Fire a desktop notification: OSC-9 where supported, BEL as the fallback,
 * nothing under a multiplexer or on a non-TTY sink (never write escape bytes into
 * a pipe). `out`/`env` are injectable for deterministic tests.
 *
 * NOTE: `message` is written VERBATIM into the OSC-9 payload (matching the codex
 * `osc9.rs` plain path). An embedded BEL (`\x07`) or ESC (`\x1b`) would terminate
 * or corrupt the sequence — sanitize upstream if the message is untrusted.
 */
export function notify(
  message: string,
  out: NotifySink = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (out.isTTY !== true) return;
  const protocol = detectNotifyProtocol(env);
  if (protocol === "osc9") {
    out.write(`\x1b]9;${message}\x07`);
  } else if (protocol === "bel") {
    out.write("\x07");
  }
  // protocol === null → suppress (multiplexer).
}
