// Public barrel for the shortcuts domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

// B-005 — the derivation the two advertising channels never had. `DEFAULT_COMPOSER_SHORTCUTS` and
// `StatusFooter`'s default hint both describe what the TOOLKIT can do; these describe what THIS app
// wired. The defaults are untouched, so an existing caller renders exactly as before.
export {
  type ComposerCapabilities,
  composerShortcutsFor,
  type FooterAffordances,
  footerHintFor,
} from "./composer-capabilities.js";
export type { KeyboardHelpProps, KeyboardShortcut } from "./keyboard-help.js";
// Keyboard-shortcut help panel (Claude Code's `?` overlay). Pairs with
// ChatComposer.onHelpToggle (fires when `?` is pressed on an empty buffer).
export { DEFAULT_COMPOSER_SHORTCUTS, KeyboardHelp } from "./keyboard-help.js";
// T3.1 — the missing half of tool rendering: which NAME reads how. The card and the envelope
// already shipped; the name→presentation maps did not, so every product wrote them (292 LOC
// downstream, plus a hand-written name-mismatch throw to keep the halves in sync). Both halves are
// ours, so this is the only place they can be kept together.
// T3.4 — the footer that lists shortcuts, derived from the same capabilities the surface binds. A
// hand-written literal beside the key handler drifts silently and one-directionally: the help keeps
// advertising a key that no longer works, and no test fails because the string is still the string.
export {
  type KeyboardHelpEntry,
  type KeyCapability,
  keyboardHelpFor,
} from "./keyboard-help-model.js";
