import {
  type StyledChar,
  styledCharsFromTokens,
  styledCharsToString,
  tokenize,
} from "@alcalzone/ansi-tokenize";
import stringWidth from "string-width";

// M18 output-grid (plan m18-yoga-layout, ADR D2): the cell-grid rasterizer — a
// faithful port of Ink's output.js, reduced to the M18 surface (NO clips: no
// shipped component uses overflow/clip — YAGNI). A height×width grid of styled
// cells preserves trailing padding rows that a naive line-walk cannot, places
// wide (CJK) characters across two cells, applies per-line transformers, and
// collapses to `\n`-joined rows with `trimEnd()` — byte-parity with Ink.

type Transformer = (line: string, index: number) => string;

interface WriteOp {
  x: number;
  y: number;
  text: string;
  transformers: Transformer[];
}

const spaceCell = (): StyledChar => ({
  type: "char",
  value: " ",
  fullWidth: false,
  styles: [],
});

/** Memoized width + tokenization (Ink's OutputCaches, trimmed to what we use). */
class Caches {
  private readonly widths = new Map<string, number>();
  private readonly styled = new Map<string, StyledChar[]>();

  width(text: string): number {
    let cached = this.widths.get(text);
    if (cached === undefined) {
      cached = stringWidth(text);
      this.widths.set(text, cached);
    }
    return cached;
  }

  styledChars(line: string): StyledChar[] {
    let cached = this.styled.get(line);
    if (cached === undefined) {
      cached = styledCharsFromTokens(tokenize(line));
      this.styled.set(line, cached);
    }
    return cached;
  }
}

export class Output {
  readonly width: number;
  readonly height: number;
  private readonly operations: WriteOp[] = [];
  private readonly caches = new Caches();
  /**
   * Rows that carry a verbatim escape sequence (inline image, M21 T2.1 / ADR
   * A2). Such a row is emitted byte-for-byte and NEVER measured / tokenized —
   * an image escape has display width 0 but real content that `string-width`
   * and the cell tokenizer would corrupt. The filler rows of a multi-row image
   * are ordinary blank grid rows; only the sequence row is raw.
   */
  private readonly rawLines = new Map<number, string>();

  constructor(options: { width: number; height: number }) {
    this.width = options.width;
    this.height = options.height;
  }

  write(x: number, y: number, text: string, options: { transformers: Transformer[] }): void {
    if (!text) {
      return;
    }
    this.operations.push({ x, y, text, transformers: options.transformers });
  }

  /** Place a verbatim (width-exempt) escape sequence on row `y` (ADR A2). */
  writeRaw(y: number, text: string): void {
    this.rawLines.set(y, text);
  }

  /** Rasterize the grid to `{ output, height }`. */
  get(): { output: string; height: number } {
    const grid: StyledChar[][] = [];
    for (let y = 0; y < this.height; y++) {
      const row: StyledChar[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push(spaceCell());
      }
      grid.push(row);
    }

    for (const operation of this.operations) {
      this.applyWrite(grid, operation);
    }

    const output = grid
      .map((line, y) =>
        this.rawLines.has(y) ? this.rawLines.get(y)! : styledCharsToString(line).trimEnd(),
      )
      .join("\n");
    return { output, height: grid.length };
  }

  private applyWrite(grid: StyledChar[][], operation: WriteOp): void {
    const { x, transformers } = operation;
    const lines = operation.text.split("\n");
    let offsetY = 0;
    for (const [index, rawLine] of lines.entries()) {
      const currentLine = grid[operation.y + offsetY];
      // Line missing when the text is taller than the grid — drop it.
      if (!currentLine) {
        offsetY++;
        continue;
      }
      let line = rawLine;
      for (const transformer of transformers) {
        line = transformer(line, index);
      }
      this.placeLine(currentLine, x, line);
      offsetY++;
    }
  }

  /** Place a single (transformed) line's styled chars into the grid row. */
  private placeLine(currentLine: StyledChar[], x: number, line: string): void {
    const characters = this.caches.styledChars(line);
    if (characters.length === 0) {
      return;
    }
    this.cleanOverwrittenWideLead(currentLine, x);
    let offsetX = x;
    for (const character of characters) {
      offsetX = this.placeChar(currentLine, offsetX, character);
    }
    // A dangling wide-char placeholder just past the write becomes a space.
    if (currentLine[offsetX]?.value === "") {
      currentLine[offsetX] = spaceCell();
    }
  }

  /** Blank a wide char's leading cell when a write lands on its trailing half. */
  private cleanOverwrittenWideLead(currentLine: StyledChar[], offsetX: number): void {
    if (
      currentLine[offsetX]?.value === "" &&
      offsetX > 0 &&
      this.caches.width(currentLine[offsetX - 1]?.value ?? "") > 1
    ) {
      currentLine[offsetX - 1] = spaceCell();
    }
  }

  /** Write one styled char (+ trailing placeholders for wide chars); return next x. */
  private placeChar(currentLine: StyledChar[], offsetX: number, character: StyledChar): number {
    currentLine[offsetX] = character;
    const characterWidth = Math.max(1, this.caches.width(character.value));
    for (let i = 1; i < characterWidth; i++) {
      currentLine[offsetX + i] = {
        type: "char",
        value: "",
        fullWidth: false,
        styles: character.styles,
      };
    }
    return offsetX + characterWidth;
  }
}
