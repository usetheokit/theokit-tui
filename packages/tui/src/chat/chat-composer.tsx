import { Box, useFocus, useFocusManager, useInput } from "ink";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import type { Key } from "../renderer/input/key.js";
import { searchFiles } from "../search/file-search.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";
import type { ComposerVariant } from "./composer/index.js";
import { ComposerFooter, ComposerFrame, InputRow } from "./composer/index.js";
import { editorActionForChord, editorReducer, seedEditorState } from "./composer-editor.js";
import { deriveMentionMenu, findMentionToken } from "./mention-menu.js";
import type { SlashCommand, SlashMenu } from "./slash-menu.js";
import { deriveSlashMenu } from "./slash-menu.js";
import type { TextBufferAction } from "./text-buffer.js";

export type { SlashCommand as ChatComposerCommand } from "./slash-menu.js";

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
   * with the initial text and on each edit — and ONLY then: the callback is read through a ref, so
   * passing a fresh inline arrow on every host render does NOT re-fire it with unchanged text
   * (#59 item 3). No `useCallback` needed on the consumer side. Omitted ⇒ no callback (unchanged
   * for existing consumers).
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
   * How the input line is framed: `"plain"` (nothing), `"border"` (the rounded box `bordered`
   * draws), or `"rules"` — full-width horizontal rules above and below with no sides, the shape
   * Claude Code v2.1.218 uses (#62 item 2).
   *
   * Omit it and the frame follows `bordered`, so every existing consumer is unchanged. Pass it and
   * it WINS over `bordered`: two props naming the same thing have to have an order, and the more
   * specific one is the one the caller reached for on purpose.
   */
  variant?: ComposerVariant;
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
  /**
   * `false` stops the composer re-taking focus on a LOOSE escape — one no menu or shell draft
   * consumed (#59 item 4). Defaults to `true`.
   *
   * The refocus exists because Ink's App blurs the focused input on ESC before subscribers see it,
   * which leaves the composer inert after an app uses ESC to interrupt a turn. An app that maps ESC
   * to a deliberate focus handoff wants the opposite, and had no way to say so: it moved focus, the
   * composer took it straight back, and the two fought over every press.
   *
   * The menu and shell dismissals still refocus regardless — there the composer HANDLED the key,
   * and going inert after its own action is not a handoff.
   */
  refocusOnEscape?: boolean;
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

const defaultFileSearch = (query: string, signal?: AbortSignal): Promise<string[]> =>
  searchFiles(query, signal ? { signal } : {});

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
export function isNewlineChord(input: string, key: ComposerKey, multiLine: boolean): boolean {
  // Ctrl+J arrives as a literal linefeed with key.return === false; Alt+Enter
  // (portable) and Shift+Enter (kitty only) both arrive as key.return.
  return multiLine && (input === "\n" || isAltReturn(key) || isShiftReturn(key));
}

function newlineAction(
  input: string,
  key: ComposerKey,
  multiLine: boolean,
): TextBufferAction | undefined {
  return isNewlineChord(input, key, multiLine) ? { type: "newline" } : undefined;
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

function insertAction(input: string, key: ComposerKey): TextBufferAction | undefined {
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
  return newlineAction(input, key, multiLine) ?? motionAction(key) ?? insertAction(input, key);
}

function useSlashMenuState(
  bufferText: string,
  commands: readonly SlashCommand[],
  complete: (name: string) => void,
) {
  const [selectionIndex, setSelectionIndex] = useState(0);
  const [dismissedFilter, setDismissedFilter] = useState<string | null>(null);
  const probe = deriveSlashMenu(bufferText, commands, selectionIndex, false);
  const dismissed = dismissedFilter !== null && dismissedFilter === probe.filter;
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

  const menu = deriveMentionMenu(text, cursorOffset, candidates, selectionIndex);
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
  variant,
  fileSearch = defaultFileSearch,
  onShellCommand,
  onHelpToggle,
  refocusOnEscape = true,
  initialValue,
  onChange,
  ...margin
}: ChatComposerProps) {
  const [editor, dispatchEditor] = useReducer(editorReducer, initialValue, seedEditorState);
  const buffer = editor.buffer;
  // M54 — surface buffer text to the host (composer-empty precondition for backtrack).
  //
  // The callback travels by REF, not in the dependency list (#59 item 3): the consumer writes
  // `onChange={(t) => something(t)}`, a new function on each of its renders, and depending on that
  // identity re-fired the effect with the text UNCHANGED. The documented contract is "after mount
  // with the initial text, and on every edit" — firing on an identity change is neither. The ref is
  // updated on every render, so the next call always uses the most recent callback.
  //
  // The ref is updated in an EFFECT, not during render: writing to a ref in the component body is a
  // render side effect and this repo has a strict-effects canary. Effects run in declaration order,
  // so this one has already stored the latest callback by the time the one below fires.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.(buffer.text);
  }, [buffer.text]);
  const focusId = useId();
  const { isFocused } = useFocus({ autoFocus, id: focusId });
  const { focus } = useFocusManager();
  const theme = useTheoTheme();
  const { menu, setSelectionIndex, setDismissedFilter, completeSelection } = useSlashMenuState(
    buffer.text,
    commands,
    (name) => {
      dispatchEditor({
        type: "buffer",
        action: { type: "complete-command", name },
      });
    },
  );
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
      setSelectionIndex((menu.clampedIndex - 1 + menu.matches.length) % menu.matches.length);
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
        (mention.menu.clampedIndex - 1 + mention.menu.matches.length) % mention.menu.matches.length,
      );
      return true;
    }
    if (key.downArrow) {
      mention.setSelectionIndex((mention.menu.clampedIndex + 1) % mention.menu.matches.length);
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
    if (key.upArrow && !buffer.text.slice(0, buffer.cursorOffset).includes("\n")) {
      dispatchEditor({ type: "history-prev" });
      return true;
    }
    if (key.downArrow && !buffer.text.slice(buffer.cursorOffset).includes("\n")) {
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
      //
      // Only the LOOSE escape is gated by `refocusOnEscape` (#59 item 4). The menu and shell
      // dismissals above re-take focus too, and they stay unconditional: there the composer HANDLED
      // the key, and letting Ink's blur stand would leave it inert after an action it performed.
      if (key.escape && refocusOnEscape) {
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
        variant={variant ?? (bordered ? "border" : "plain")}
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
