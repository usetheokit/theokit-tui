import { Box, Text, useFocus, useFocusManager, useInput } from "ink";
import { useId, useReducer, useState } from "react";

import { SLASH_MENU_WINDOW, deriveSlashMenu } from "./slash-menu-model.js";
import type { SlashCommand, SlashMenu } from "./slash-menu-model.js";
import {
  graphemeAt,
  initialTextBuffer,
  textBufferReducer,
} from "./text-buffer.js";
import type { TextBufferAction } from "./text-buffer.js";
import { isMonochrome, useTheoTheme } from "./theme.js";

export type { SlashCommand as ChatComposerCommand } from "./slash-menu-model.js";

export interface ChatComposerProps {
  /**
   * Called with the trimmed buffer text on Enter. Exceptions propagate —
   * the composer never swallows caller errors (plan EC-5).
   */
  onSubmit: (text: string) => void;
  /** Dimmed hint shown while the buffer is empty. */
  placeholder?: string;
  /**
   * Multi-line mode (default): Ctrl+J ALWAYS inserts a newline (it is the
   * literal `\n` byte — works in every terminal); Shift+Enter also inserts
   * one, but ONLY on terminals that encode shift (kitty keyboard protocol) —
   * legacy terminals send plain Enter (plan ADR D3 caveat).
   */
  multiLine?: boolean;
  autoFocus?: boolean;
  /** M15: slash-command menu. Typing `/` at the START of line 1 opens a
   * prefix-filtered menu (↑↓ select, Tab/Enter complete to `/name `, Esc
   * dismisses until the filter changes). Completion only edits the buffer
   * — dispatch/execution stays with the app (declarative contract). */
  commands?: readonly SlashCommand[];
  /** M15: dim affordance line under the composer (e.g. cancel hint). */
  hint?: string;
}

interface ComposerKey {
  return: boolean;
  shift: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  upArrow: boolean;
  downArrow: boolean;
  tab: boolean;
  escape: boolean;
  backspace: boolean;
  delete: boolean;
  ctrl: boolean;
  meta: boolean;
}

/**
 * Shift+Enter chord — ONLY arrives on kitty-protocol terminals (ink 5 needs
 * the kitty handshake; unsynthesizable via test stdin — verified: CSI-u lands
 * as literal text). Unit-tested with a synthetic key object instead.
 * Exported for tests; not part of the package public surface.
 */
export function isShiftReturn(key: ComposerKey): boolean {
  return key.return && key.shift;
}

/**
 * Single source of the newline-vs-submit decision (review F-arch-3): the
 * submit gate is derived from THIS predicate, never re-encoded.
 */
export function isNewlineChord(
  input: string,
  key: ComposerKey,
  multiLine: boolean,
): boolean {
  // Ctrl+J arrives as a literal linefeed with key.return === false.
  return multiLine && (input === "\n" || isShiftReturn(key));
}

function newlineAction(
  input: string,
  key: ComposerKey,
  multiLine: boolean,
): TextBufferAction | undefined {
  return isNewlineChord(input, key, multiLine)
    ? { type: "newline" }
    : undefined;
}

function motionAction(key: ComposerKey): TextBufferAction | undefined {
  if (key.leftArrow) {
    return { type: "move-left" };
  }
  if (key.rightArrow) {
    return { type: "move-right" };
  }
  if (key.backspace || key.delete) {
    // ink maps the 0x7f byte to `delete` on most terminals; both erase back.
    return { type: "delete-backward" };
  }
  return undefined;
}

function insertAction(
  input: string,
  key: ComposerKey,
): TextBufferAction | undefined {
  if (input.length > 0 && !key.ctrl && !key.meta && input !== "\n") {
    return { type: "insert", text: input };
  }
  return undefined;
}

/** Maps one useInput event to a buffer action (undefined = not a buffer op). */
function actionForKey(
  input: string,
  key: ComposerKey,
  multiLine: boolean,
): TextBufferAction | undefined {
  return (
    newlineAction(input, key, multiLine) ??
    motionAction(key) ??
    insertAction(input, key)
  );
}

interface CursorSlices {
  before: string;
  atCursor: string;
  after: string;
}

/**
 * Splits text for inverse-video cursor rendering (space at EOL/newline).
 * Slices by GRAPHEME — never splits a surrogate pair or combining sequence
 * (SEPA iteration-5 finding 1; plan ADR D3).
 */
function cursorSlices(text: string, cursorOffset: number): CursorSlices {
  const before = text.slice(0, cursorOffset);
  const raw = graphemeAt(text, cursorOffset);
  if (raw === "") {
    return { before, atCursor: " ", after: "" };
  }
  if (raw === "\n") {
    // Render a visible cursor cell, then the real newline + rest.
    return { before, atCursor: " ", after: text.slice(cursorOffset) };
  }
  return {
    before,
    atCursor: raw,
    after: text.slice(cursorOffset + raw.length),
  };
}

/**
 * Multi-line chat input on a grapheme-aware buffer (plan ADR D3).
 * Enter submits (whitespace-only is a no-op); the buffer clears on submit.
 *
 * Environment caveats (review F-dom-2/F-dom-5):
 * - Requires a raw-mode-capable stdin (real TTY). Gate the mount on
 *   `process.stdin.isTTY` in non-interactive contexts, as `examples/chat.tsx`
 *   does — ink's `useInput` throws otherwise.
 * - Under NO_COLOR the inverse-video cursor is invisible (ANSI-only
 *   affordance); typed text still renders. A visible fallback is an M6 item.
 *
 * Key caveat: ink conflates Backspace (0x7f) and Delete into erase-BACKWARD
 * on most terminals; forward-delete is reducer-reachable (`delete-forward`)
 * but not key-bound at M1 (same YAGNI posture as home/end).
 */
// Single source for the degrade cursor glyph (review arch-3 — one knowledge,
// one site). U+258F, EAW-Ambiguous — same class as the shipped █/░ bars.
const NO_COLOR_CURSOR_MARKER = "▏";

/** Placeholder-branch cursor cell (M6 D8): visible marker under monochrome
 * themes (chalk level 0 strips the inverse attribute). */
function PlaceholderCursor({ marker }: { marker: boolean }) {
  return marker ? (
    <Text>{NO_COLOR_CURSOR_MARKER}</Text>
  ) : (
    <Text inverse> </Text>
  );
}

/** Text-branch cursor cell (M6 D8): the marker before the char under
 * monochrome themes, inverse styling otherwise. Known cosmetic scope
 * (review dom-frontend-3): the marker adds +1 column in monochrome mode,
 * so exact-fit lines clip one column earlier than the colored render. */
function CursorCell({
  atCursor,
  focused,
  marker,
}: {
  atCursor: string;
  focused: boolean;
  marker: boolean;
}) {
  if (marker) {
    return (
      <>
        {NO_COLOR_CURSOR_MARKER}
        {atCursor}
      </>
    );
  }
  return <Text inverse={focused}>{atCursor}</Text>;
}

/** The windowed slash-menu rows (gemini SuggestionsDisplay reduced). */
function SlashMenuList({ menu, accent }: { menu: SlashMenu; accent: string }) {
  const visible = menu.matches.slice(
    menu.windowStart,
    menu.windowStart + SLASH_MENU_WINDOW,
  );
  return (
    <Box flexDirection="column" paddingLeft={2}>
      {menu.overflowUp && <Text dimColor>▲</Text>}
      {visible.map((command, index) => {
        const active = menu.windowStart + index === menu.clampedIndex;
        return (
          <Box key={command.name}>
            {/* exactOptionalPropertyTypes: omit `color`, never undefined
                (the SEPA iteration-4 house idiom). */}
            <Text {...(active ? { color: accent } : {})}>
              {active ? "❯ " : "  "}/{command.name}
            </Text>
            <Text dimColor>
              {"  "}
              {command.description}
            </Text>
          </Box>
        );
      })}
      {menu.overflowDown && <Text dimColor>▼</Text>}
      {menu.matches.length > SLASH_MENU_WINDOW && (
        <Text dimColor>
          ({menu.clampedIndex + 1}/{menu.matches.length})
        </Text>
      )}
    </Box>
  );
}

/** M15 D1: menu state DERIVES from the buffer; only selection + the
 * dismissal latch (keyed by filter text — a filter change reopens) are
 * component state. Bundled here so the composer stays under the
 * complexity budget. */
function useSlashMenuState(
  bufferText: string,
  commands: readonly SlashCommand[],
  complete: (name: string) => void,
) {
  const [selectionIndex, setSelectionIndex] = useState(0);
  const [dismissedFilter, setDismissedFilter] = useState<string | null>(null);
  const probe = deriveSlashMenu(bufferText, commands, selectionIndex, false);
  const dismissed =
    dismissedFilter !== null && dismissedFilter === probe.filter;
  const menu: SlashMenu = dismissed ? { ...probe, open: false } : probe;
  const completeSelection = (): void => {
    const chosen = menu.matches[menu.clampedIndex];
    if (chosen !== undefined) {
      complete(chosen.name);
      setSelectionIndex(0);
      // Latch the completed name: the exact-match menu would stay open as
      // a stuck one-row list otherwise (plan D3) — typing reopens.
      setDismissedFilter(chosen.name);
    }
  };
  return { menu, setSelectionIndex, setDismissedFilter, completeSelection };
}

export function ChatComposer({
  onSubmit,
  placeholder = "",
  multiLine = true,
  autoFocus = true,
  commands = [],
  hint,
}: ChatComposerProps) {
  const [buffer, dispatch] = useReducer(textBufferReducer, initialTextBuffer);
  const focusId = useId();
  const { isFocused } = useFocus({ autoFocus, id: focusId });
  const { focus } = useFocusManager();
  const theme = useTheoTheme();
  const { menu, setSelectionIndex, setDismissedFilter, completeSelection } =
    useSlashMenuState(buffer.text, commands, (name) => {
      dispatch({ type: "complete-command", name });
    });

  // M15 D2: menu keys intercept BEFORE buffer actions and never leak.
  // Returns true when the key was consumed by the menu.
  const handleMenuKey = (input: string, key: ComposerKey): boolean => {
    if (!menu.open) {
      return false;
    }
    if (key.upArrow) {
      setSelectionIndex(
        (menu.clampedIndex - 1 + menu.matches.length) % menu.matches.length,
      );
      return true;
    }
    if (key.downArrow) {
      setSelectionIndex((menu.clampedIndex + 1) % menu.matches.length);
      return true;
    }
    if (key.tab || (key.return && !isNewlineChord(input, key, multiLine))) {
      completeSelection();
      return true;
    }
    if (key.escape) {
      setDismissedFilter(menu.filter);
      // ink's App handler already BLURRED on this very ESC (its focus
      // reset runs before useInput subscribers — ink App.tsx:258);
      // menu-dismiss must not cost the composer its focus, so take it
      // back. Outside the menu, ESC keeps ink's default blur.
      focus(focusId);
      return true;
    }
    return false;
  };

  const handleBufferKey = (input: string, key: ComposerKey): void => {
    if (key.return && !isNewlineChord(input, key, multiLine)) {
      const text = buffer.text.trim();
      if (text.length > 0) {
        // onSubmit BEFORE clear: a throwing handler propagates (EC-5) AND
        // the user's draft survives (review F-dom-6).
        onSubmit(text);
        dispatch({ type: "clear" });
      }
      return;
    }
    const action = actionForKey(input, key, multiLine);
    if (action !== undefined) {
      dispatch(action);
    }
  };

  useInput(
    (input, key) => {
      const composerKey = key as unknown as ComposerKey;
      if (!handleMenuKey(input, composerKey)) {
        handleBufferKey(input, composerKey);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      <InputRow
        buffer={buffer}
        placeholder={placeholder}
        isFocused={isFocused}
        monochrome={isMonochrome(theme)}
        glyph={theme.role.user.glyph}
        prefixColor={theme.role.user.prefix}
      />
      {menu.open && <SlashMenuList menu={menu} accent={theme.accent} />}
      {hint !== undefined && hint !== "" && (
        <Box paddingLeft={2}>
          <Text dimColor>{hint}</Text>
        </Box>
      )}
    </Box>
  );
}

/** The single input line (glyph + text/placeholder + cursor cell).
 * M6 D8: at chalk level 0 the inverse attribute is stripped — the cursor
 * vanishes. Under MONOCHROME themes (degrade as DATA) a visible marker
 * carries the affordance instead; colored-mode bytes unchanged. Known
 * scope (EC-1): TERM=dumb/bare-pipe with a COLORED theme keeps the
 * invisible inverse — NO_COLOR is the standard opt-out. */
function InputRow({
  buffer,
  placeholder,
  isFocused,
  monochrome,
  glyph,
  prefixColor,
}: {
  buffer: { text: string; cursorOffset: number };
  placeholder: string;
  isFocused: boolean;
  monochrome: boolean;
  glyph: string;
  prefixColor: string;
}) {
  const { before, atCursor, after } = cursorSlices(
    buffer.text,
    buffer.cursorOffset,
  );
  const showPlaceholder = buffer.text.length === 0 && placeholder.length > 0;
  const noColorMarker = monochrome && isFocused;
  return (
    <Box>
      <Text color={prefixColor}>{glyph}</Text>
      {showPlaceholder ? (
        <Box>
          {isFocused && <PlaceholderCursor marker={noColorMarker} />}
          <Text dimColor>{placeholder}</Text>
        </Box>
      ) : (
        <Text>
          {before}
          {/* Cursor cell only while focused (review F-dom-4 — plan: "cursor
              shows when focused"); blurred composers render plain text. */}
          <CursorCell
            atCursor={atCursor}
            focused={isFocused}
            marker={noColorMarker}
          />
          {after}
        </Text>
      )}
    </Box>
  );
}
