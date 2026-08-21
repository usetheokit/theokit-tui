// M17 renderer — Terminal seam (plan m17-renderer-skeleton, ADR D3). The
// output engine writes to THIS interface, never to process.stdout directly
// (DIP — rules/architecture.md § 2), so the real ProcessTerminal and the
// @xterm/headless VirtualTerminal test oracle are interchangeable. Shape
// borrowed from pi/tui's Terminal (references/pi/.../src/terminal.ts:52-82),
// reduced to the M17 skeleton surface (no input/resize callbacks, no kitty
// — those arrive with M19).

export interface Terminal {
  /** Visible columns of the viewport. */
  readonly columns: number;
  /** Visible rows of the viewport. */
  readonly rows: number;
  /** Write a raw byte string (may contain ANSI/CSI sequences). */
  write(data: string): void;
  /** Hide the hardware cursor (`\x1b[?25l`). */
  hideCursor(): void;
  /** Show the hardware cursor (`\x1b[?25h`). */
  showCursor(): void;
}

/**
 * Real terminal backed by `process.stdout`. Columns/rows read at access
 * time (a live resize is reflected on the next render — M17 does not yet
 * subscribe to SIGWINCH; that is M18/M19 territory).
 */
export class ProcessTerminal implements Terminal {
  get columns(): number {
    return process.stdout.columns ?? 80;
  }

  get rows(): number {
    return process.stdout.rows ?? 24;
  }

  write(data: string): void {
    process.stdout.write(data);
  }

  hideCursor(): void {
    process.stdout.write("\x1b[?25l");
  }

  showCursor(): void {
    process.stdout.write("\x1b[?25h");
  }
}
