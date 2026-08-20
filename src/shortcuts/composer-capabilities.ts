import type { KeyboardShortcut } from "./keyboard-help.js";
import { DEFAULT_COMPOSER_SHORTCUTS } from "./keyboard-help.js";

/**
 * Which OPTIONAL composer features an app actually wired.
 *
 * Three of the four fields are a prop `ChatComposer` gates its handler on: `!` needs
 * `onShellCommand` (`src/chat/chat-composer.tsx:447`), `?` needs `onHelpToggle` (`:495`), `/` needs
 * a non-empty `commands` (`:300`). Those three default to OFF, so absent really does mean not
 * wired.
 *
 * **`mentions` is the odd one out, and B-071 corrected this comment rather than the code.** The
 * previous text said `@` "needs the mention provider" — measured, it does not.
 * `chat-composer.tsx:303` reads `fileSearch = defaultFileSearch`, so a consumer that passes NO
 * provider still gets a working `@` menu: driven through `ink-testing-library` with no `fileSearch`,
 * typing `@src` returned SIXTEEN live candidates. The real gate is `mention-menu.ts:64` —
 * `if (!token || candidates.length === 0)` — so the predicate is *"the provider in effect returned
 * results"*, never *"a provider was passed"*.
 *
 * Which makes `mentions` the ONE field whose absence under-advertises a feature that works. A
 * truthful consumer, reading this comment, omits it and loses the `@` row from its own help.
 *
 * The code was NOT changed to match the comment, and that was a decision. Dropping the default
 * would compile everywhere, pass all three mention tests (they inject a provider), and silently
 * delete a working feature from every consumer that never passed the prop. The doc was wrong about
 * the code; the code was not wrong about the product.
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
  /**
   * The `@` menu is advertised.
   *
   * Unlike its three siblings this is NOT "a prop was passed": `fileSearch` defaults to a
   * `.gitignore`-aware cwd walk (`chat-composer.tsx:71,303`), so `@` works without one. Set it
   * whenever the composer is mounted, unless you passed `fileSearch: () => []` to switch mentions
   * off deliberately (`chat-composer.tsx:72`).
   */
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
