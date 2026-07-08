import { Text } from "ink";
import { createElement, useMemo, type ReactElement } from "react";

import {
  allocateImageId,
  calculateImageCellSize,
  detectImageProtocol,
  encodeITerm2,
  encodeKitty,
  getImageDimensions,
  imageFallback,
  type ImageProtocol,
} from "./renderer/terminal-image.js";

// M21 Image (plan m21-premium-capabilities T2.1, Feature A / ADR A2/A3): the
// inline-image component. On a kitty/iTerm2 terminal it emits an `ink-image`
// host node carrying the protocol escape sequence plus blank filler rows (the
// renderer routes those to `Output.writeRaw`, width-exempt); on any other
// terminal — or unreadable image bytes — it renders the `[Image: …]` text
// fallback. The app supplies the bytes (`base64Data` + `mimeType`); the
// component never does I/O. Faithful to pi's components/image.ts filler-line
// convention (kitty: sequence on the first line; iTerm2: cursor-up + sequence
// on the last line, so cursor accounting stays inside the frame).

export interface ImageProps {
  /** Raw image bytes as base64 (the app reads the file; the component is pure). */
  base64Data: string;
  /** `image/png` | `image/jpeg` | `image/gif` | `image/webp`. */
  mimeType: string;
  /** Max width in terminal cells (default 40). */
  maxWidthCells?: number;
  /** Shown in the text fallback. */
  filename?: string;
  /**
   * Force a protocol (tests / explicit control). Defaults to env detection —
   * `null` on multiplexers and unrecognized terminals (text fallback).
   */
  protocol?: ImageProtocol;
}

function buildImageLines(
  base64Data: string,
  protocol: "kitty" | "iterm2",
  columns: number,
  rows: number,
  imageId: number,
): string[] {
  if (protocol === "kitty") {
    // C=1 (no cursor move): sequence on the first line, blank filler below.
    const sequence = encodeKitty(base64Data, {
      columns,
      rows,
      imageId,
      moveCursor: false,
    });
    return [sequence, ...Array<string>(rows - 1).fill("")];
  }
  // iTerm2 moves the cursor: blank filler first, then move up + draw on the last
  // line so the terminal's cursor accounting stays inside the reserved rows.
  const sequence = encodeITerm2(base64Data, {
    width: columns,
    height: "auto",
    preserveAspectRatio: true,
  });
  const moveUp = rows > 1 ? `\x1b[${rows - 1}A` : "";
  return [...Array<string>(rows - 1).fill(""), moveUp + sequence];
}

export function Image({
  base64Data,
  mimeType,
  maxWidthCells = 40,
  filename,
  protocol,
}: ImageProps): ReactElement {
  const resolvedProtocol =
    protocol === undefined ? detectImageProtocol() : protocol;
  const dimensions = useMemo(
    () => getImageDimensions(base64Data, mimeType),
    [base64Data, mimeType],
  );
  const imageId = useMemo(() => allocateImageId(), []);

  // No protocol, or unreadable bytes → the text fallback.
  if (!resolvedProtocol || !dimensions) {
    return createElement(
      Text,
      {},
      imageFallback(mimeType, dimensions ?? undefined, filename),
    );
  }

  const size = calculateImageCellSize(dimensions, maxWidthCells);
  const lines = buildImageLines(
    base64Data,
    resolvedProtocol,
    size.columns,
    size.rows,
    imageId,
  );
  return createElement("ink-image", {
    internal_image_lines: lines,
    style: { height: lines.length, width: size.columns },
  });
}
