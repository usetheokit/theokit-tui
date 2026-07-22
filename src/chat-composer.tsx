import { Box, Text, useFocus, useFocusManager, useInput } from "ink";
import { useEffect, useId, useReducer, useState, type ReactNode } from "react";

import { deriveMentionMenu, findMentionToken } from "./mention-menu-model.js";
import { searchFiles } from "./file-search.js";
import { SLASH_MENU_WINDOW, deriveSlashMenu } from "./slash-menu-model.js";
import type { SlashCommand, SlashMenu } from "./slash-menu-model.js";
import type { LayoutMarginProps } from "./layout-props.js";
import { graphemeAt } from "./text-buffer.js";
import type { TextBufferAction } from "./text-buffer.js";
import {
  editorActionForChord,
  editorReducer,
  seedEditorState,
} from "./composer-editor.js";
import type { Key } from "./renderer/input/key.js";
import { isMonochrome, useTheoTheme } from "./theme.js";

export type { SlashCommand as ChatComposerCommand } from "./slash-menu-model.js";

export interface ChatComposerProps extends LayoutMarginProps {
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
  /**
   * M54 (agent-builder backtrack): seed the buffer with pre-filled text on MOUNT, cursor at end
   * (Codex `restore_user_message_to_composer`). Only read at mount — remount with a changing `key`
   * to re-seed. Omitted ⇒ empty buffer (unchanged for existing consumers).
   */
  initialValue?: string;
  /**
   * M54 (agent-builder backtrack): called with the current buffer text on every change, so the host
   * can enforce a composer-empty precondition (Codex `is_normal_backtrack_mode`). Fires after mount
   * with the initial text and on each edit. Omitted ⇒ no callback (unchanged for existing consumers).
   */
  onChange?: (text: string) => void;
  /** M15: slash-command menu. Typing `/` at the START of line 1 opens a
   * prefix-filtered menu (CASE-SENSITIVE, codex parity — r2-F9); ↑↓
   * select, Tab/Enter complete to `/name `, Esc dismisses until the
   * FILTER TOKEN changes (typing after the completed token does not
   * reopen — erase back into the token does, r2-F10). A multiline draft
   * closes the menu (Enter submits, never completes — r2-F3). Completion
   * only edits the buffer — dispatch/execution stays with the app. */
  commands?: readonly SlashCommand[];
  /** M15: dim affordance line under the composer (e.g. cancel hint). */
  hint?: string;
  /**
   * Draw a rounded border box around the input line (the Claude Code look).
   * Default false (borderless — unchanged for existing consumers). Under a
   * monochrome theme the border degrades to a `single` style (no accent color).
   */
  bordered?: boolean;
  /**
   * M21: the `@`-file-mention provider — fuzzy-ranked cwd-relative paths for a
   * query. Defaults to a `.gitignore`-aware cwd walk; inject for tests or to
   * scope the search. Return `[]` (or omit results) to disable mentions.
   */
  fileSearch?: (query: string, signal?: AbortSignal) => Promise<string[]>;
  /**
   * Bang mode (Claude Code parity): when provided, typing `!` at the START of
   * the buffer enters a distinct "shell mode" (the prompt + hint change); Enter
   * calls THIS with the command (buffer text after the `!`, trimmed) instead of
   * `onSubmit`, and Esc cancels the draft. The library NEVER spawns a process —
   * the consumer decides how to run the command (fail-fast boundary / DIP).
   * Omit it and a leading `!` is plain text submitted through `onSubmit`.
   */
  onShellCommand?: (command: string) => void;
  /**
   * Keyboard-help toggle (Claude Code parity): when provided, pressing `?` on an
   * EMPTY buffer calls this instead of typing the `?` — the app toggles a
   * `KeyboardHelp` panel. A `?` typed mid-text stays literal. Omit it and `?` is
   * always ordinary text (non-breaking).
   */
  onHelpToggle?: () => void;
}

/**
 * Parses a bang-mode buffer. Returns the command (text after a leading `!`,
 * trimmed) when the buffer is `!`-prefixed, else null. A bare `!` yields `""`.
 * Exported for tests; not part of the package public surface.
 */
export function parseShellCommand(text: string): string | null {
  if (!text.startsWith("!")) {
    return null;
  }
  return text.slice(1).trim();
}

/** The hint shown while the composer is in bang (shell-command) mode. */
const SHELL_MODE_HINT = "shell mode · Enter runs the command · esc cancels";

/** The InputRow prompt (glyph + color) for the current mode. Shell mode drops
 * the user glyph so the typed `!` reads as the prompt (Claude Code look:
 * `! git status`) and recolors to accent; normal mode uses the user role. */
function promptFor(
  shellMode: boolean,
  theme: ReturnType<typeof useTheoTheme>,
): { glyph: string; prefixColor: string } {
  return shellMode
    ? { glyph: "", prefixColor: theme.accent }
    : { glyph: theme.role.user.glyph, prefixColor: theme.role.user.prefix };
}

const defaultFileSearch = (
  query: string,
  signal?: AbortSignal,
): Promise<string[]> => searchFiles(query, signal ? { signal } : {});

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
 * Alt(Meta)+Enter chord — arrives as `\x1b\r` → `{ name:"return", meta:true }`
 * in EVERY terminal (the meta-prefix escape, unlike Shift+Enter which needs the
 * kitty protocol). This is the portable "break the line" chord (Claude Code
 * parity). Exported for tests; not part of the package public surface.
 */
export function isAltReturn(key: ComposerKey): boolean {
  return key.return && key.meta;
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
  // Ctrl+J arrives as a literal linefeed with key.return === false; Alt+Enter
  // (portable) and Shift+Enter (kitty only) both arrive as key.return.
  return (
    multiLine && (input === "\n" || isAltReturn(key) || isShiftReturn(key))
  );
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

/**
 * Maps one useInput event to a buffer action (undefined = not a buffer op).
 * Exported for the M19 renderer input-stack compat proof — the new stack must
 * drive this EXACT mapping identically (not a hand-copy).
 */
export function actionForKey(
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
            {/* name column never shrinks; the description truncates —
                a long description must not interleave with the name
                (review r2-F4, the gemini SuggestionsDisplay shape). */}
            <Box flexShrink={0}>
              {/* exactOptionalPropertyTypes: omit `color`, never undefined
                  (the SEPA iteration-4 house idiom). */}
              <Text {...(active ? { color: accent } : {})}>
                {active ? "❯ " : "  "}
                {menu.sigil ?? "/"}
                {command.name}
              </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
              <Text dimColor wrap="truncate-end">
                {"  "}
                {command.description}
              </Text>
            </Box>
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

/** M21: the `@`-mention menu — candidates are fetched async (abortable) as the
 * mention token changes; the menu derives from them + the buffer. */
function useMentionMenuState(
  text: string,
  cursorOffset: number,
  fileSearch: (query: string, signal?: AbortSignal) => Promise<string[]>,
  complete: (path: string, from: number, to: number) => void,
) {
  const [selectionIndex, setSelectionIndex] = useState(0);
  const [candidates, setCandidates] = useState<readonly string[]>([]);
  const token = findMentionToken(text, cursorOffset);
  const query = token?.query ?? null;

  useEffect(() => {
    if (query === null) {
      setCandidates([]);
      return;
    }
    const controller = new AbortController();
    fileSearch(query, controller.signal)
      .then((paths) => {
        if (!controller.signal.aborted) {
          setCandidates(paths);
        }
      })
      .catch(() => setCandidates([]));
    return () => controller.abort();
  }, [query, fileSearch]);

  const menu = deriveMentionMenu(
    text,
    cursorOffset,
    candidates,
    selectionIndex,
  );
  const completeSelection = (): void => {
    const chosen = menu.matches[menu.clampedIndex];
    if (chosen && token) {
      complete(chosen.name, token.start, cursorOffset);
      setSelectionIndex(0);
    }
  };
  return { menu, setSelectionIndex, completeSelection };
}

export function ChatComposer({
  onSubmit,
  placeholder = "",
  multiLine = true,
  autoFocus = true,
  commands = [],
  hint,
  bordered = false,
  fileSearch = defaultFileSearch,
  onShellCommand,
  onHelpToggle,
  initialValue,
  onChange,
  ...margin
}: ChatComposerProps) {
  const [editor, dispatchEditor] = useReducer(
    editorReducer,
    initialValue,
    seedEditorState,
  );
  const buffer = editor.buffer;
  // M54 — surface buffer text to the host (composer-empty precondition for backtrack).
  useEffect(() => {
    onChange?.(buffer.text);
  }, [buffer.text, onChange]);
  const focusId = useId();
  const { isFocused } = useFocus({ autoFocus, id: focusId });
  const { focus } = useFocusManager();
  const theme = useTheoTheme();
  const { menu, setSelectionIndex, setDismissedFilter, completeSelection } =
    useSlashMenuState(buffer.text, commands, (name) => {
      dispatchEditor({
        type: "buffer",
        action: { type: "complete-command", name },
      });
    });
  const mention = useMentionMenuState(
    buffer.text,
    buffer.cursorOffset,
    fileSearch,
    (path, from, to) => {
      dispatchEditor({
        type: "buffer",
        action: { type: "complete-mention", path, from, to },
      });
    },
  );

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

  // M21: the `@`-mention menu keys. Same shape as the slash menu (↑↓ select,
  // Tab/Enter complete, Esc closes) but no dismissal latch — moving off the
  // `@`-token closes it naturally. Takes priority when its token is active
  // (ADR-C2). Returns true when consumed.
  const handleMentionKey = (input: string, key: ComposerKey): boolean => {
    if (!mention.menu.open) {
      return false;
    }
    if (key.upArrow) {
      mention.setSelectionIndex(
        (mention.menu.clampedIndex - 1 + mention.menu.matches.length) %
          mention.menu.matches.length,
      );
      return true;
    }
    if (key.downArrow) {
      mention.setSelectionIndex(
        (mention.menu.clampedIndex + 1) % mention.menu.matches.length,
      );
      return true;
    }
    if (key.tab || (key.return && !isNewlineChord(input, key, multiLine))) {
      mention.completeSelection();
      return true;
    }
    return false;
  };

  // M21: the emacs editor chords (kill-ring, word-nav, yank, undo) + history
  // recall, resolved via the M19 keymap and applied to the pure editor reducer.
  // Runs after the menu, before the plain buffer keys. Returns true when consumed.
  const handleEditorKey = (input: string, key: ComposerKey): boolean => {
    // History recall on arrows, gated to the first/last visual line (multiline
    // drafts keep the arrow for cursor movement — the composer owns this gate).
    if (
      key.upArrow &&
      !buffer.text.slice(0, buffer.cursorOffset).includes("\n")
    ) {
      dispatchEditor({ type: "history-prev" });
      return true;
    }
    if (
      key.downArrow &&
      !buffer.text.slice(buffer.cursorOffset).includes("\n")
    ) {
      dispatchEditor({ type: "history-next" });
      return true;
    }
    const editorAction = editorActionForChord(input, key as unknown as Key);
    if (!editorAction) {
      return false;
    }
    dispatchEditor(editorAction);
    return true;
  };

  // Bang mode is active only when a shell handler is wired AND the buffer opens
  // with `!` — otherwise a leading `!` is ordinary text (non-breaking default).
  const shellMode = onShellCommand !== undefined && buffer.text.startsWith("!");

  // Enter: run the `!`-command via onShellCommand (bang mode) OR submit via
  // onSubmit. Both fire BEFORE clear so a throwing handler propagates (EC-5)
  // and the draft survives (review F-dom-6); `submit` also records history.
  const submitOrRun = (): void => {
    const text = buffer.text.trim();
    if (text.length === 0) {
      return;
    }
    const command = onShellCommand ? parseShellCommand(text) : null;
    if (command !== null) {
      if (command.length > 0) {
        onShellCommand!(command);
        dispatchEditor({ type: "submit", entry: text });
      }
      return; // bare `!` is a no-op; never falls through to onSubmit
    }
    onSubmit(text);
    dispatchEditor({ type: "submit", entry: text });
  };

  const handleBufferKey = (input: string, key: ComposerKey): void => {
    if (key.return && !isNewlineChord(input, key, multiLine)) {
      submitOrRun();
      return;
    }
    const action = actionForKey(input, key, multiLine);
    if (action !== undefined) {
      dispatchEditor({ type: "buffer", action });
    }
  };

  // Bang mode: Esc cancels the draft (clears the buffer, leaving shell mode).
  // Reclaims focus the same way the menu-esc does — ink's App blurs on Esc.
  const handleShellKey = (key: ComposerKey): boolean => {
    if (shellMode && key.escape) {
      dispatchEditor({ type: "buffer", action: { type: "clear" } });
      focus(focusId);
      return true;
    }
    return false;
  };

  // `?` on an empty buffer toggles the app's keyboard-help panel instead of
  // typing the char (Claude Code parity); mid-text it stays a literal `?`.
  const handleHelpKey = (input: string, key: ComposerKey): boolean => {
    if (
      onHelpToggle !== undefined &&
      input === "?" &&
      buffer.text.length === 0 &&
      !key.ctrl &&
      !key.meta
    ) {
      onHelpToggle();
      return true;
    }
    return false;
  };

  useInput(
    (input, key) => {
      const composerKey = key as unknown as ComposerKey;
      // The `@`-mention menu takes priority when active (ADR-C2), then the
      // slash menu, then the emacs editor chords, then the plain buffer.
      if (handleMentionKey(input, composerKey)) {
        return;
      }
      if (handleMenuKey(input, composerKey)) {
        return;
      }
      if (handleShellKey(composerKey)) {
        return;
      }
      // Ink's App handler BLURS the focused input on ESC (before subscribers). When ESC is not a
      // menu/shell dismissal, the host app has likely used it to interrupt a streaming turn — re-take
      // focus so the composer stays usable afterwards instead of going inert (theokit-tui#… / #10).
      if (key.escape) {
        focus(focusId);
      }
      if (handleHelpKey(input, composerKey)) {
        return;
      }
      if (handleEditorKey(input, composerKey)) {
        return;
      }
      handleBufferKey(input, composerKey);
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column" {...margin}>
      <ComposerFrame
        bordered={bordered}
        monochrome={isMonochrome(theme)}
        accent={theme.accent}
      >
        <InputRow
          buffer={buffer}
          placeholder={placeholder}
          isFocused={isFocused}
          monochrome={isMonochrome(theme)}
          {...promptFor(shellMode, theme)}
        />
      </ComposerFrame>
      <ComposerFooter
        menu={menu}
        mentionMenu={mention.menu}
        accent={theme.accent}
        hint={hint}
        shellMode={shellMode}
      />
    </Box>
  );
}

/** The menus (slash + mention) and the dim hint line below the input. */
function ComposerFooter({
  menu,
  mentionMenu,
  accent,
  hint,
  shellMode,
}: {
  menu: SlashMenu;
  mentionMenu: SlashMenu;
  accent: string;
  hint: string | undefined;
  shellMode: boolean;
}) {
  // Shell mode overrides the caller's hint with the bang-mode affordance line.
  const shown = shellMode ? SHELL_MODE_HINT : hint;
  return (
    <>
      {menu.open && <SlashMenuList menu={menu} accent={accent} />}
      {mentionMenu.open && <SlashMenuList menu={mentionMenu} accent={accent} />}
      {shown !== undefined && shown !== "" && (
        <Box paddingLeft={2}>
          <Text dimColor>{shown}</Text>
        </Box>
      )}
    </>
  );
}

/** Wraps the input line in a rounded box when `bordered` (Claude Code look);
 * degrades to a `single` border with no accent under a monochrome theme. */
function ComposerFrame({
  bordered,
  monochrome,
  accent,
  children,
}: {
  bordered: boolean;
  monochrome: boolean;
  accent: string;
  children: ReactNode;
}) {
  if (!bordered) {
    return <>{children}</>;
  }
  return (
    <Box
      borderStyle={monochrome ? "single" : "round"}
      paddingX={1}
      {...(monochrome ? {} : { borderColor: accent })}
    >
      {children}
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
