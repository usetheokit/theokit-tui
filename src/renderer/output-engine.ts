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

const SYNC_BEGIN = "\x1b[?2026h";
const SYNC_END = "\x1b[?2026l";
const CLEAR_SCREEN_HOME = "\x1b[2J\x1b[H\x1b[3J"; // screen + home + scrollback
const CLEAR_LINE = "\x1b[2K";
const CURSOR_HOME = "\x1b[H";

/** Wrap a buffer in synchronized-output so the frame paints atomically. */
function synchronized(body: string): string {
  return SYNC_BEGIN + body + SYNC_END;
}

/** Move to an absolute row (1-based CSI row;1H) then column 0. */
function moveToRow(row: number): string {
  return `\x1b[${row + 1};1H`;
}

export class OutputEngine {
  private readonly terminal: Terminal;
  private previousLines: string[] = [];
  private previousWidth = 0;
  private previousHeight = 0;
  /** The reason for the most recent full-render (observability, D2). */
  lastRedrawReason: string | undefined;
  /** Count of full redraws — a spike signals a diff-strategy miss. */
  fullRedrawCount = 0;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  /**
   * Render `newLines` to the terminal, writing only what changed. Picks a
   * strategy in pi's order; falls back to a full clear+redraw (with a
   * logged reason) when a differential update cannot preserve correctness.
   */
  render(newLines: string[]): void {
    const width = this.terminal.columns;
    const height = this.terminal.rows;
    const widthChanged = this.previousWidth !== 0 && this.previousWidth !== width;
    const heightChanged =
      this.previousHeight !== 0 && this.previousHeight !== height;

    if (this.previousLines.length === 0 && !widthChanged && !heightChanged) {
      this.fullRender(newLines, width, height, false, "first render");
      return;
    }
    if (widthChanged) {
      this.fullRender(
        newLines,
        width,
        height,
        true,
        `terminal width changed (${this.previousWidth} -> ${width})`,
      );
      return;
    }
    if (heightChanged) {
      this.fullRender(
        newLines,
        width,
        height,
        true,
        `terminal height changed (${this.previousHeight} -> ${height})`,
      );
      return;
    }
    // Shrink is handled by the differential deleted-tail path (rows removed
    // off the end are cleared individually) — no full redraw needed while we
    // hold the exact previous frame. Viewport-scroll shrink is M18 territory.
    this.differentialRender(newLines, width, height);
  }

  /** Full clear + redraw; records the reason and bumps the counter. */
  private fullRender(
    newLines: string[],
    width: number,
    height: number,
    clear: boolean,
    reason: string,
  ): void {
    this.fullRedrawCount += 1;
    this.lastRedrawReason = reason;
    let buffer = SYNC_BEGIN;
    if (clear) {
      buffer += CLEAR_SCREEN_HOME;
    } else {
      buffer += CURSOR_HOME;
    }
    buffer += newLines.join("\r\n");
    buffer += SYNC_END;
    this.terminal.write(buffer);
    this.commit(newLines, width, height);
  }

  /** Line-diff: rewrite only the changed row range (pi :1370-1440). */
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
      const oldLine = i < this.previousLines.length ? this.previousLines[i] : "";
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

  /** Clear the rows removed off the end (pi :1420-1440 reduced). */
  private deletedTailBody(newLines: string[]): string {
    const extra = this.previousLines.length - newLines.length;
    const cleared = Array.from({ length: extra }, () => CLEAR_LINE);
    return moveToRow(newLines.length) + cleared.join("\r\n");
  }

  /** Rewrite the changed span, one cleared row per line. */
  private changedSpanBody(
    newLines: string[],
    firstChanged: number,
    lastChanged: number,
  ): string {
    const rows: string[] = [];
    for (let row = firstChanged; row <= lastChanged; row++) {
      const line = row < newLines.length ? newLines[row] : "";
      rows.push(CLEAR_LINE + line);
    }
    return moveToRow(firstChanged) + rows.join("\r\n");
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
