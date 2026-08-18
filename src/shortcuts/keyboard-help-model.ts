/**
 * The keyboard-help footer, derived from the capabilities a surface declares.
 *
 * `↑/↓ navigate · enter select · esc cancel` was a hand-written literal in every product, living
 * beside the key handler it describes with nothing holding the two together. That failure is silent
 * and one-directional: rebind or remove a shortcut and the help keeps advertising the old one, so
 * the user presses the advertised key and nothing happens — and no test fails, because the string
 * is still the string someone wrote.
 *
 * Deriving the list from the same declarations the surface binds makes the help unable to describe
 * a key that is not there. Not by discipline — there is simply nothing to derive it from.
 */

export interface KeyCapability {
  /** Stable identity, so a surface can look one up to enable or rebind it. */
  readonly id: string;
  /** What the user is told this does. */
  readonly label: string;
  /** The bound key. Absent or blank means unbound, and unbound means unadvertised. */
  readonly key?: string;
  /** Off for this state. Defaults to on; an explicit `false` drops it from the help. */
  readonly enabled?: boolean;
}

export interface KeyboardHelpEntry {
  readonly key: string;
  readonly label: string;
}

/**
 * The advertisable subset, in declaration order.
 *
 * Order is preserved because it is the surface's editorial decision — which shortcut matters most
 * here — and sorting would silently overrule it. Two capabilities sharing a key are both listed:
 * context-dependent bindings are legitimate, and dropping one would hide a real conflict from the
 * author instead of showing it.
 */
export function keyboardHelpFor(
  capabilities: readonly KeyCapability[],
): readonly KeyboardHelpEntry[] {
  const help: KeyboardHelpEntry[] = [];
  for (const capability of capabilities) {
    if (capability.enabled === false) continue;
    const key = capability.key?.trim();
    // Blank is absence wearing a different type, and it is what a config file produces. A row with
    // an empty key column tells the user a shortcut exists and refuses to say which.
    if (key === undefined || key.length === 0) continue;
    help.push({ key, label: capability.label });
  }
  return help;
}
