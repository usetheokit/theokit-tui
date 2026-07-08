// M19 kitty (plan m19-input-stack, ADR D5): kitty keyboard protocol handshake +
// AWARENESS only. Full CSI-u key decoding is deferred to M21 (the composer needs
// none of kitty's disambiguation — legacy encodings serve all 12 Key fields).
// Enable pushes the "disambiguate escape codes" flag (1), queries the current
// flags, and appends a Device-Attributes sentinel so a non-kitty terminal is
// detected without a startup timeout (pi's DA-sentinel, terminal.ts:15-17).

const ESC = String.fromCharCode(27);

/** Push flag 1 (disambiguate), query flags, DA sentinel — written on start. */
export const KITTY_ENABLE = ESC + "[>1u" + ESC + "[?u" + ESC + "[c";

/** Pop the kitty flag stack — written on teardown. */
export const KITTY_DISABLE = ESC + "[<u";

// A `\x1b[?<flags>u` reply; kitty is active when <flags> is a non-zero number.
const kittyReplyRe = new RegExp(ESC + "\\[\\?(\\d+)u");

/** True when a terminal reply indicates kitty keyboard support is active. */
export function detectKittyActive(reply: string): boolean {
  const match = kittyReplyRe.exec(reply);
  return match ? Number(match[1]) !== 0 : false;
}
