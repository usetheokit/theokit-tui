import { Box, Text } from "ink";

import { isMonochrome, useTheoTheme } from "./theme.js";

// A presentational keyboard-shortcut help panel (Claude Code's `?` overlay).
// The library ships the PANEL + a default shortcut list; the app owns WHEN to
// show it (a boolean toggle, or `useOverlay().push` for an Esc-dismissable
// overlay) and WHICH shortcuts to list. `ChatComposer.onHelpToggle` fires the
// toggle when `?` is pressed on an empty buffer (parity with Claude Code).

export interface KeyboardShortcut {
  /** The key or chord, e.g. `"Alt+Enter"` or `"↑ ↓"`. */
  keys: string;
  /** What the chord does, one line. */
  description: string;
}

export interface KeyboardHelpProps {
  /** The rows to render (see `DEFAULT_COMPOSER_SHORTCUTS` for a ready set). */
  shortcuts: readonly KeyboardShortcut[];
  /** Panel title (default `"Keyboard shortcuts"`). */
  title?: string;
}

/**
 * The `ChatComposer`'s built-in chords — spread into a `KeyboardHelp` panel as
 * a starting point, then extend or replace with app-specific entries. Every
 * entry here reflects a chord the composer actually handles (`keybindings.ts` +
 * the slash/mention/bang modes); `Ctrl+C` is the app/runtime quit convention.
 */
export const DEFAULT_COMPOSER_SHORTCUTS: readonly KeyboardShortcut[] = [
  { keys: "Enter", description: "Send the message" },
  { keys: "Alt+Enter / Ctrl+J", description: "Insert a newline" },
  { keys: "/", description: "Open the command menu" },
  { keys: "@", description: "Mention a file / browse paths" },
  { keys: "!", description: "Run a shell command" },
  { keys: "?", description: "Toggle this help" },
  { keys: "↑ ↓", description: "History (empty line) / menu navigation" },
  { keys: "Esc", description: "Dismiss the menu / cancel" },
  { keys: "Ctrl+A / Ctrl+E", description: "Jump to line start / end" },
  { keys: "Alt+B / Alt+F", description: "Move a word back / forward" },
  { keys: "Ctrl+W", description: "Delete the word before the cursor" },
  { keys: "Ctrl+U / Ctrl+K", description: "Delete to line start / end" },
  { keys: "Ctrl+Y", description: "Yank (paste the last kill)" },
  { keys: "Ctrl+C", description: "Quit" },
];

/**
 * A bordered panel listing keyboard shortcuts (keys column + description).
 * Presentational only — no input handling; the caller decides visibility and
 * dismissal. Degrades to a `single` border with no accent under a monochrome
 * theme (same idiom as the composer's bordered box).
 */
export function KeyboardHelp({
  shortcuts,
  title = "Keyboard shortcuts",
}: KeyboardHelpProps) {
  const theme = useTheoTheme();
  const mono = isMonochrome(theme);
  const accentText = mono ? {} : { color: theme.accent };
  const keyWidth = Math.max(0, ...shortcuts.map((s) => s.keys.length)) + 2;
  return (
    <Box
      flexDirection="column"
      borderStyle={mono ? "single" : "round"}
      paddingX={1}
      {...(mono ? {} : { borderColor: theme.accent })}
    >
      <Text bold {...accentText}>
        {title}
      </Text>
      {shortcuts.map((shortcut) => (
        <Box key={shortcut.keys}>
          <Box flexShrink={0} width={keyWidth}>
            <Text {...accentText}>{shortcut.keys}</Text>
          </Box>
          <Text dimColor>{shortcut.description}</Text>
        </Box>
      ))}
    </Box>
  );
}
