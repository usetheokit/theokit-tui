// M21 terminal-image (plan m21-premium-capabilities T1.1, Feature A / ADR A1/A3):
// the pure image core — a faithful port of pi's terminal-image.ts
// (references/pi/.../src/terminal-image.ts), reduced to the M21 image surface:
// kitty + iTerm2 encoders, magic-byte dimension extraction, cell-fit sizing, the
// env-based capability matrix, and the text fallback. Hyperlinks / trueColor /
// the tmux-hyperlink probe are dropped (YAGNI — not in the M21 DoD). Capability
// detection takes an injectable env record so it is deterministic in tests (no
// module-level cache, unlike pi — our test discipline injects, not resets).

export type ImageProtocol = "kitty" | "iterm2" | null;

export interface ImageDimensions {
  widthPx: number;
  heightPx: number;
}

export interface CellDimensions {
  widthPx: number;
  heightPx: number;
}

export interface ImageCellSize {
  columns: number;
  rows: number;
}

const DEFAULT_CELL: CellDimensions = { widthPx: 9, heightPx: 18 };

type Env = Record<string, string | undefined>;

interface ImageContext {
  env: Env;
  termProgram: string;
  term: string;
}

/**
 * Ordered rules: the FIRST whose predicate matches decides. `null` protocol
 * results (multiplexers) come first and short-circuit — image protocols are
 * unreliable / corrupting under a multiplexer. A rule table keeps this a
 * single-branch scan instead of a deeply-nested conditional.
 */
const PROTOCOL_RULES: {
  protocol: ImageProtocol;
  match: (c: ImageContext) => boolean;
}[] = [
  {
    protocol: null,
    match: ({ env, term }) =>
      Boolean(env["TMUX"]) ||
      term.startsWith("tmux") ||
      Boolean(env["ZELLIJ"]) ||
      term.startsWith("screen"),
  },
  {
    protocol: "kitty",
    match: ({ env, termProgram }) =>
      Boolean(env["KITTY_WINDOW_ID"]) || termProgram === "kitty",
  },
  {
    protocol: "kitty",
    match: ({ env, termProgram, term }) =>
      termProgram === "ghostty" ||
      term.includes("ghostty") ||
      Boolean(env["GHOSTTY_RESOURCES_DIR"]),
  },
  {
    protocol: "kitty",
    match: ({ env, termProgram }) =>
      Boolean(env["WEZTERM_PANE"]) || termProgram === "wezterm",
  },
  {
    protocol: "kitty",
    match: ({ env, termProgram }) =>
      termProgram === "warpterminal" ||
      Boolean(env["WARP_SESSION_ID"]) ||
      Boolean(env["WARP_TERMINAL_SESSION_UUID"]),
  },
  {
    protocol: "iterm2",
    match: ({ env, termProgram }) =>
      Boolean(env["ITERM_SESSION_ID"]) || termProgram === "iterm.app",
  },
];

/**
 * Map the environment to an inline-image protocol. Conservative by design: any
 * unrecognized terminal — and any multiplexer (tmux / screen / zellij) — yields
 * `null` (text fallback). Env is injected so tests exercise every branch
 * deterministically.
 */
export function detectImageProtocol(env: Env = process.env): ImageProtocol {
  const ctx: ImageContext = {
    env,
    termProgram: env["TERM_PROGRAM"]?.toLowerCase() ?? "",
    term: env["TERM"]?.toLowerCase() ?? "",
  };
  for (const rule of PROTOCOL_RULES) {
    if (rule.match(ctx)) {
      return rule.protocol;
    }
  }
  // WT / vscode / alacritty / jetbrains / unknown: no reliable image support.
  return null;
}

/** Random kitty image id in [1, 0xfffffffe] (injectable rng for determinism). */
export function allocateImageId(rng: () => number = Math.random): number {
  return Math.floor(rng() * 0xfffffffe) + 1;
}

export function encodeKitty(
  base64Data: string,
  options: {
    columns?: number;
    rows?: number;
    imageId?: number;
    /** Whether kitty applies its default cursor movement. Default true. */
    moveCursor?: boolean;
  } = {},
): string {
  const CHUNK_SIZE = 4096;
  const params: string[] = ["a=T", "f=100", "q=2"];
  if (options.moveCursor === false) params.push("C=1");
  if (options.columns) params.push(`c=${options.columns}`);
  if (options.rows) params.push(`r=${options.rows}`);
  if (options.imageId) params.push(`i=${options.imageId}`);

  if (base64Data.length <= CHUNK_SIZE) {
    return `\x1b_G${params.join(",")};${base64Data}\x1b\\`;
  }

  const chunks: string[] = [];
  let offset = 0;
  let isFirst = true;
  while (offset < base64Data.length) {
    const chunk = base64Data.slice(offset, offset + CHUNK_SIZE);
    const isLast = offset + CHUNK_SIZE >= base64Data.length;
    if (isFirst) {
      chunks.push(`\x1b_G${params.join(",")},m=1;${chunk}\x1b\\`);
      isFirst = false;
    } else if (isLast) {
      chunks.push(`\x1b_Gm=0;${chunk}\x1b\\`);
    } else {
      chunks.push(`\x1b_Gm=1;${chunk}\x1b\\`);
    }
    offset += CHUNK_SIZE;
  }
  return chunks.join("");
}

/** Delete a kitty image by id (frees the data too — uppercase I). */
export function deleteKittyImage(imageId: number): string {
  return `\x1b_Ga=d,d=I,i=${imageId},q=2\x1b\\`;
}

export function encodeITerm2(
  base64Data: string,
  options: {
    width?: number | string;
    height?: number | string;
    name?: string;
    preserveAspectRatio?: boolean;
    inline?: boolean;
  } = {},
): string {
  const params: string[] = [`inline=${options.inline === false ? 0 : 1}`];
  if (options.width !== undefined) params.push(`width=${options.width}`);
  if (options.height !== undefined) params.push(`height=${options.height}`);
  if (options.name) {
    params.push(`name=${Buffer.from(options.name).toString("base64")}`);
  }
  if (options.preserveAspectRatio === false) {
    params.push("preserveAspectRatio=0");
  }
  return `\x1b]1337;File=${params.join(";")}:${base64Data}\x07`;
}

export function calculateImageCellSize(
  imageDimensions: ImageDimensions,
  maxWidthCells: number,
  maxHeightCells?: number,
  cell: CellDimensions = DEFAULT_CELL,
): ImageCellSize {
  const maxWidth = Math.max(1, Math.floor(maxWidthCells));
  const maxHeight =
    maxHeightCells === undefined
      ? undefined
      : Math.max(1, Math.floor(maxHeightCells));
  const imageWidth = Math.max(1, imageDimensions.widthPx);
  const imageHeight = Math.max(1, imageDimensions.heightPx);

  const widthScale = (maxWidth * cell.widthPx) / imageWidth;
  const heightScale =
    maxHeight === undefined
      ? widthScale
      : (maxHeight * cell.heightPx) / imageHeight;
  const scale = Math.min(widthScale, heightScale);

  const columns = Math.ceil((imageWidth * scale) / cell.widthPx);
  const rows = Math.ceil((imageHeight * scale) / cell.heightPx);
  return {
    columns: Math.max(1, Math.min(maxWidth, columns)),
    rows: Math.max(
      1,
      maxHeight === undefined ? rows : Math.min(maxHeight, rows),
    ),
  };
}

function getPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return null;
  }
  return {
    widthPx: buffer.readUInt32BE(16),
    heightPx: buffer.readUInt32BE(20),
  };
}

function getJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8)
    return null;
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1]!;
    if (marker >= 0xc0 && marker <= 0xc2) {
      return {
        widthPx: buffer.readUInt16BE(offset + 7),
        heightPx: buffer.readUInt16BE(offset + 5),
      };
    }
    if (offset + 3 >= buffer.length) return null;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function getGifDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 10) return null;
  const sig = buffer.subarray(0, 6).toString("ascii");
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;
  return { widthPx: buffer.readUInt16LE(6), heightPx: buffer.readUInt16LE(8) };
}

function getWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;
  if (
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8 ") {
    return {
      widthPx: buffer.readUInt16LE(26) & 0x3fff,
      heightPx: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    if (buffer.length < 25) return null;
    const bits = buffer.readUInt32LE(21);
    return {
      widthPx: (bits & 0x3fff) + 1,
      heightPx: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8X") {
    return {
      widthPx: (buffer[24]! | (buffer[25]! << 8) | (buffer[26]! << 16)) + 1,
      heightPx: (buffer[27]! | (buffer[28]! << 8) | (buffer[29]! << 16)) + 1,
    };
  }
  return null;
}

/** Intrinsic pixel dimensions from magic bytes — no decode, no dependency. */
export function getImageDimensions(
  base64Data: string,
  mimeType: string,
): ImageDimensions | null {
  // Buffer.from(…, "base64") is lenient (never throws — invalid chars are
  // dropped), and every parser is length-guarded, so no try/catch is needed.
  const buffer = Buffer.from(base64Data, "base64");
  switch (mimeType) {
    case "image/png":
      return getPngDimensions(buffer);
    case "image/jpeg":
      return getJpegDimensions(buffer);
    case "image/gif":
      return getGifDimensions(buffer);
    case "image/webp":
      return getWebpDimensions(buffer);
    default:
      return null;
  }
}

/** The `[Image: name [mime] WxH]` placeholder for terminals without support. */
export function imageFallback(
  mimeType: string,
  dimensions?: ImageDimensions,
  filename?: string,
): string {
  const parts: string[] = [];
  if (filename) parts.push(filename);
  parts.push(`[${mimeType}]`);
  if (dimensions) parts.push(`${dimensions.widthPx}x${dimensions.heightPx}`);
  return `[Image: ${parts.join(" ")}]`;
}
