import xterm from "@xterm/headless";

import type { Terminal } from "../../src/renderer/terminal.js";

// M17 test oracle (plan ADR D3) — a REAL terminal emulator as the
// screen-state source of truth. Ported from pi/tui's VirtualTerminal
// (references/pi/.../test/virtual-terminal.ts) reduced to the M17 surface.
// The engine writes ANSI/CSI here; asserts read the emulator's rendered
// buffer (getLine().translateToString) — NOT the raw byte stream. A
// separate `writes` spy captures the stream for the diff-strategy oracles.
const XtermTerminal = xterm.Terminal;

export class VirtualTerminal implements Terminal {
  private xterm: InstanceType<typeof XtermTerminal>;
  private _columns: number;
  private _rows: number;
  /** Every write() payload, in order — the diff-strategy spy. */
  readonly writes: string[] = [];

  constructor(columns = 80, rows = 24) {
    this._columns = columns;
    this._rows = rows;
    this.xterm = new XtermTerminal({
      cols: columns,
      rows,
      disableStdin: true,
      allowProposedApi: true,
    });
  }

  get columns(): number {
    return this._columns;
  }

  get rows(): number {
    return this._rows;
  }

  write(data: string): void {
    this.writes.push(data);
    this.xterm.write(data);
  }

  hideCursor(): void {
    this.write("\x1b[?25l");
  }

  showCursor(): void {
    this.write("\x1b[?25h");
  }

  /** Resize the emulator (drives the engine's width/height fallbacks). */
  resize(columns: number, rows: number): void {
    this._columns = columns;
    this._rows = rows;
    this.xterm.resize(columns, rows);
  }

  /** Flush pending writes so the buffer reflects everything written. */
  async flush(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.xterm.write("", () => {
        resolve();
      });
    });
  }

  /**
   * The visible viewport as trimmed lines (trailing blank lines dropped) —
   * the screen-state oracle. Call after `await flush()`.
   */
  screenLines(): string[] {
    const buffer = this.xterm.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < this._rows; i++) {
      const line = buffer.getLine(buffer.viewportY + i);
      lines.push(line ? line.translateToString(true) : "");
    }
    // Drop trailing empty rows — the viewport pads to `rows`.
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    return lines;
  }

  /** Concatenated write stream — for asserting CSI presence / diff scope. */
  writeStream(): string {
    return this.writes.join("");
  }
}
