import type { KeyboardShortcut } from "./keyboard-help.js";
import { DEFAULT_COMPOSER_SHORTCUTS } from "./keyboard-help.js";

/**
 * Which OPTIONAL composer features an app actually wired.
 *
 * Every field is a prop `ChatComposer` gates its handler on, measured rather than assumed:
 * `!` needs `onShellCommand` (`src/chat/chat-composer.tsx:447`), `?` needs `onHelpToggle` (`:495`),
 * `/` needs a non-empty `commands` (`:300`), and `@` needs the mention provider, whose own
 * docstring says returning `[]` disables mentions (`:70`).
 *
 * Absent means NOT wired. That direction is deliberate: a list that advertises by default is how
 * the same product promised a shell it could not run, a help panel that did nothing, and an agents
 * panel it had not built.
 */
export interface ComposerCapabilities {
  /** `onShellCommand` is passed. */
  shell?: boolean;
  /** `onHelpToggle` is passed. */
  help?: boolean;
  /** A non-empty `commands` list is passed. */
  commands?: boolean;
  /** A mention provider is passed and can return results. */
  mentions?: boolean;
}

/** The chords that only work when a capability is wired. Everything else is unconditional. */
const KEYS_REQUIRING = new Map<string, keyof ComposerCapabilities>([
  ["!", "shell"],
  ["?", "help"],
  ["/", "commands"],
  ["@", "mentions"],
]);

/**
 * The shortcut rows THIS app can honour.
 *
 * Reach for this when your app gates any of the four optional features; take
 * {@link DEFAULT_COMPOSER_SHORTCUTS} directly when it wires all of them. Declaring every
 * capability returns that list unchanged, in order — asserted, so the two paths cannot drift.
 */
export function composerShortcutsFor(
  capabilities: ComposerCapabilities,
): readonly KeyboardShortcut[] {
  return DEFAULT_COMPOSER_SHORTCUTS.filter((shortcut) => {
    const required = KEYS_REQUIRING.get(shortcut.keys);
    return required === undefined || capabilities[required] === true;
  });
}

/** Which affordances the status footer may advertise. */
export interface FooterAffordances {
  /** Pressing `?` does something right now. */
  shortcuts?: boolean;
  /** `←` opens an agents panel. */
  agents?: boolean;
}

/** Affordance text in the order the footer reads it, each gated on the capability it names. */
const FOOTER_AFFORDANCES: readonly (readonly [
  keyof FooterAffordances,
  string,
])[] = [
  ["shortcuts", "? for shortcuts"],
  ["agents", "← for agents"],
];

/**
 * The footer hint for THIS app.
 *
 * ALWAYS returns a string, and an empty declaration returns `""` rather than `undefined`. That is
 * load-bearing: `StatusFooter` declares `hint = DEFAULT_HINT` as a default PARAMETER, so
 * `undefined` does not mean "say nothing" — it means "say everything the toolkit can do", which is
 * how an agents panel that did not exist was advertised. An empty string is the honest empty hint,
 * and callers must branch on `=== undefined`, never on falsiness (ADR D4).
 */
export function footerHintFor(affordances: FooterAffordances): string {
  return FOOTER_AFFORDANCES.filter(([key]) => affordances[key] === true)
    .map(([, text]) => text)
    .join(" · ");
}
