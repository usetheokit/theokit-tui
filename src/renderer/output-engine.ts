import type { Terminal } from "./terminal.js";

// M17 output engine (plan m17-renderer-skeleton, ADR D2): the differential
// renderer — pi/tui's strategy ladder ported (references/pi/.../src/tui.ts:
// 1335-1475), reduced to the M17 skeleton (no kitty images = M21, no
// overlays = out, no Termux exception = YAGNI). Every terminal write is
// wrapped in CSI-2026 synchronized output (`\x1b[?2026h … \x1b[?2026l`) so
// the screen updates atomically — no flicker. Every full-render fallback
// records a human-readable reason (a renderer bug is undebuggable without
// it). The engine is Terminal-agnostic: it emits strings, so the real
// ProcessTerminal and the @xterm/headless VirtualTerminal both drive it.
//
// M20 (review B1): the live frame is positioned RELATIVE to a tracked cursor
// row, not by absolute `\x1b[row;1H`. Absolute addressing breaks the moment the
// terminal scrolls (graduated scrollback pushing the live frame past the screen
// bottom — the chat steady state): the frame's absolute rows go stale and a
// differential patch lands on the wrong line. Relative moves (`\x1b[nA`/`\x1b[nB`)
// are scroll-invariant — the cursor and the frame's top scroll together — so the
// live frame stays consistent no matter how much history has scrolled above it
// (Ink's log-update uses relative movement for exactly this reason).

const SYNC_BEGIN = "\x1b[?2026h";
const SYNC_END = "\x1b[?2026l";
const CLEAR_SCREEN_HOME = "\x1b[2J\x1b[H"; // clear screen + home (keep scrollback)
const CURSOR_HOME = "\x1b[H";
const CLEAR_LINE = "\x1b[2K";
const CLEAR_TO_END = "\x1b[0J"; // erase from cursor to end of screen

/** Wrap a buffer in synchronized-output so the frame paints atomically. */
function synchronized(body: string): string {
  return SYNC_BEGIN + body + SYNC_END;
}

export class OutputEngine {
  private readonly terminal: Terminal;
  private previousLines: string[] = [];
  private previousWidth = 0;
  private previousHeight = 0;
  /** Whether the first frame has been anchored (absolute) at the screen top. */
  private started = false;
  /**
   * The cursor's row index (0-based) WITHIN the current live frame — i.e.
   * relative to the frame's top line, NOT an absolute screen row. Every seek is
   * a relative move from here, so scrolling (graduated scrollback above the
   * frame) never invalidates a position (review B1).
   */
  private cursorRow = 0;
  /** The reason for the most recent full-render (observability, D2). */
  lastRedrawReason: string | undefined;
  /** Count of full redraws — a spike signals a diff-strategy miss. */
  fullRedrawCount = 0;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  /** Relative move from the tracked cursor row to `target` (column 0). */
  private seekTo(target: number): string {
    const delta = target - this.cursorRow;
    this.cursorRow = target;
    if (delta > 0) {
      return `\x1b[${delta}B\r`;
    }
    if (delta < 0) {
      return `\x1b[${-delta}A\r`;
    }
    return "\r";
  }

  /**
   * Emit graduated scrollback ABOVE the live frame — written ONCE, never
   * tracked in `previousLines`, never re-rendered (Ink's dual-pass Static
   * contract, M20 T1.1 / ADR D1). The current live frame is erased at its top,
   * the static lines are written there (scrolling older history off into the
   * terminal's native scrollback), and the next `render` repaints the live frame
   * at the current — physically lower, possibly scrolled — cursor position.
   */
  writeStatic(staticLines: string[]): void {
    if (staticLines.length === 0) {
      return;
    }
    let buffer = SYNC_BEGIN;
    buffer += this.seekTo(0); // to the top of the current live frame (relative)
    buffer += CLEAR_TO_END; // erase the live frame so static replaces it
    buffer += staticLines.join("\r\n");
    buffer += "\r\n"; // terminate the last static row (advance the cursor)
    buffer += SYNC_END;
    this.terminal.write(buffer);
    // The live frame restarts at the current physical cursor (wherever the
    // static writes + any scroll left it) — relative tracking makes that "row 0".
    this.cursorRow = 0;
    this.started = true; // output is anchored here; the next render is relative
    this.previousLines = []; // force a repaint of the live frame below
  }

  /**
   * Render `newLines` to the terminal, writing only what changed. Picks a
   * strategy in pi's order; falls back to a full redraw (with a logged reason)
   * when a differential update cannot preserve correctness.
   */
  render(newLines: string[]): void {
    const width = this.terminal.columns;
    const height = this.terminal.rows;
    const widthChanged =
      this.previousWidth !== 0 && this.previousWidth !== width;
    const heightChanged =
      this.previousHeight !== 0 && this.previousHeight !== height;

    if (widthChanged || heightChanged) {
      const which = widthChanged ? "width" : "height";
      const from = widthChanged ? this.previousWidth : this.previousHeight;
      const to = widthChanged ? width : height;
      // A resize re-anchors the live frame at the screen top. Graduated history
      // already scrolled into native scrollback is NOT re-emitted (the
      // fullStaticOutput accumulator is the tracked follow-up — review H1).
      this.resizeRender(
        newLines,
        width,
        height,
        `terminal ${which} changed (${from} -> ${to})`,
      );
      return;
    }
    if (this.previousLines.length === 0) {
      if (!this.started) {
        this.firstRender(newLines, width, height);
      } else {
        this.relativeFullRender(newLines, width, height);
      }
      return;
    }
    this.differentialRender(newLines, width, height);
  }

  /** First-ever frame: anchor absolutely at the screen top, then track relative. */
  private firstRender(newLines: string[], width: number, height: number): void {
    this.started = true;
    this.fullRedrawCount += 1;
    this.lastRedrawReason = "first render";
    this.terminal.write(synchronized(CURSOR_HOME + newLines.join("\r\n")));
    this.cursorRow = Math.max(0, newLines.length - 1);
    this.commit(newLines, width, height);
  }

  /** Resize: clear the visible screen (keep native scrollback) and redraw. */
  private resizeRender(
    newLines: string[],
    width: number,
    height: number,
    reason: string,
  ): void {
    this.fullRedrawCount += 1;
    this.lastRedrawReason = reason;
    this.terminal.write(
      synchronized(CLEAR_SCREEN_HOME + newLines.join("\r\n")),
    );
    this.cursorRow = Math.max(0, newLines.length - 1);
    this.commit(newLines, width, height);
  }

  /** Repaint the whole live frame at the current (relative) cursor — post-static. */
  private relativeFullRender(
    newLines: string[],
    width: number,
    height: number,
  ): void {
    this.fullRedrawCount += 1;
    this.lastRedrawReason = "static graduated — repaint live frame";
    const rows = newLines.map((line) => CLEAR_LINE + line);
    this.terminal.write(synchronized(this.seekTo(0) + rows.join("\r\n")));
    this.cursorRow = Math.max(0, newLines.length - 1);
    this.commit(newLines, width, height);
  }

  /** Line-diff: rewrite only the changed row range (pi :1370-1440), relative. */
  private differentialRender(
    newLines: string[],
    width: number,
    height: number,
  ): void {
    const [firstChanged, lastChanged] = this.changedRange(newLines);
    if (firstChanged === -1) {
      // No change — do not touch the terminal (idempotence).
      this.commit(newLines, width, height);
      return;
    }
    const deletedTail =
      newLines.length < this.previousLines.length &&
      firstChanged >= newLines.length;
    const body = deletedTail
      ? this.deletedTailBody(newLines)
      : this.changedSpanBody(newLines, firstChanged, lastChanged);
    this.terminal.write(synchronized(body));
    this.commit(newLines, width, height);
  }

  /** [first, last] changed row indices, or [-1, -1] when nothing changed. */
  private changedRange(newLines: string[]): [number, number] {
    let firstChanged = -1;
    let lastChanged = -1;
    const maxLen = Math.max(newLines.length, this.previousLines.length);
    for (let i = 0; i < maxLen; i++) {
      const oldLine =
        i < this.previousLines.length ? this.previousLines[i] : "";
      const newLine = i < newLines.length ? newLines[i] : "";
      if (oldLine !== newLine) {
        if (firstChanged === -1) {
          firstChanged = i;
        }
        lastChanged = i;
      }
    }
    return [firstChanged, lastChanged];
  }

  /** Clear the rows removed off the end (pi :1420-1440 reduced), relative. */
  private deletedTailBody(newLines: string[]): string {
    const extra = this.previousLines.length - newLines.length;
    const seek = this.seekTo(newLines.length);
    const cleared = Array.from({ length: extra }, () => CLEAR_LINE);
    this.cursorRow = newLines.length + extra - 1;
    return seek + cleared.join("\r\n");
  }

  /** Rewrite the changed span, one cleared row per line, relative. */
  private changedSpanBody(
    newLines: string[],
    firstChanged: number,
    lastChanged: number,
  ): string {
    const seek = this.seekTo(firstChanged);
    const rows: string[] = [];
    for (let row = firstChanged; row <= lastChanged; row++) {
      const line = row < newLines.length ? newLines[row] : "";
      rows.push(CLEAR_LINE + line);
    }
    this.cursorRow = lastChanged;
    return seek + rows.join("\r\n");
  }

  /** Persist the frame as the new baseline. */
  private commit(newLines: string[], width: number, height: number): void {
    this.previousLines = newLines;
    this.previousWidth = width;
    this.previousHeight = height;
  }

  /** Restore the cursor and end any open synchronized-output (teardown). */
  teardown(): void {
    this.terminal.write(SYNC_END);
    this.terminal.showCursor();
  }
}
