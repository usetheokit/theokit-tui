import { describe, expect, it } from "vitest";

import {
  allocateImageId,
  calculateImageCellSize,
  deleteKittyImage,
  detectImageProtocol,
  encodeITerm2,
  encodeKitty,
  getImageDimensions,
  imageFallback,
  isImageLine,
} from "./terminal-image.js";

// M21 T1.1 (plan m21-premium-capabilities, Feature A): the pure image core —
// kitty/iTerm2 encoders, magic-byte dimension extraction, cell-fit sizing, the
// env-based capability matrix (injected — no real terminal), and the text
// fallback. Faithful port of pi's terminal-image.ts, reduced to the M21 image
// surface (no hyperlinks/trueColor/tmux-probe — YAGNI).

const ESC = String.fromCharCode(27);

describe("kitty encoder (M21 T1.1)", () => {
  it("encodes_a_single_sequence_with_the_protocol_params", () => {
    const out = encodeKitty("QUJD", {
      columns: 10,
      rows: 3,
      moveCursor: false,
    });
    expect(out.startsWith(ESC + "_G")).toBe(true);
    expect(out).toContain("a=T");
    expect(out).toContain("f=100");
    expect(out).toContain("q=2");
    expect(out).toContain("C=1"); // moveCursor:false
    expect(out).toContain("c=10");
    expect(out).toContain("r=3");
    expect(out.endsWith(ESC + "\\")).toBe(true);
    expect(out).toContain(";QUJD");
  });

  it("chunks_payloads_larger_than_4096_bytes", () => {
    const big = "A".repeat(5000);
    const out = encodeKitty(big);
    expect(out).toContain("m=1"); // first/middle chunks
    expect(out).toContain("m=0"); // last chunk
    // Two chunks (5000 = 4096 + 904).
    expect(out.split(ESC + "_G").length - 1).toBe(2);
  });

  it("emits_a_middle_chunk_for_payloads_over_two_chunks", () => {
    const out = encodeKitty("A".repeat(9000), { imageId: 7 }); // 3 chunks
    expect(out).toContain("i=7"); // imageId param
    expect(out.split(ESC + "_G").length - 1).toBe(3);
    // The middle chunk is `m=1` with NO leading params.
    expect(out).toContain(ESC + "_Gm=1;");
  });
});

describe("iterm2 encoder (M21 T1.1)", () => {
  it("wraps_osc_1337_with_inline_and_base64_name", () => {
    const out = encodeITerm2("QUJD", {
      width: 10,
      height: "auto",
      name: "pic.png",
    });
    expect(out.startsWith(ESC + "]1337;File=")).toBe(true);
    expect(out).toContain("inline=1");
    expect(out).toContain("width=10");
    expect(out).toContain("height=auto");
    // name is base64-encoded.
    expect(out).toContain(`name=${Buffer.from("pic.png").toString("base64")}`);
    expect(out.endsWith(":QUJD" + String.fromCharCode(7))).toBe(true);
  });
});

describe("magic-byte dimensions (M21 T1.1)", () => {
  it("extracts_png_dimensions", () => {
    // Minimal PNG header: signature + IHDR width=800 height=600.
    const buf = Buffer.alloc(24);
    buf[0] = 0x89;
    buf[1] = 0x50;
    buf[2] = 0x4e;
    buf[3] = 0x47;
    buf.writeUInt32BE(800, 16);
    buf.writeUInt32BE(600, 20);
    const dims = getImageDimensions(buf.toString("base64"), "image/png");
    expect(dims).toEqual({ widthPx: 800, heightPx: 600 });
  });

  it("returns_null_for_malformed_data", () => {
    expect(getImageDimensions("bm90YXBuZw==", "image/png")).toBeNull();
    expect(getImageDimensions("QUJD", "image/unknown")).toBeNull();
  });

  it("returns_null_when_the_png_signature_is_wrong", () => {
    // 24 bytes (passes the length guard) but not a PNG signature.
    const buf = Buffer.alloc(24, 0x01);
    expect(getImageDimensions(buf.toString("base64"), "image/png")).toBeNull();
  });

  it("extracts_webp_vp8_and_vp8l_dimensions", () => {
    const vp8 = Buffer.alloc(30);
    vp8.write("RIFF", 0, "ascii");
    vp8.write("WEBP", 8, "ascii");
    vp8.write("VP8 ", 12, "ascii");
    vp8.writeUInt16LE(200, 26);
    vp8.writeUInt16LE(150, 28);
    expect(getImageDimensions(vp8.toString("base64"), "image/webp")).toEqual({
      widthPx: 200,
      heightPx: 150,
    });

    const vp8l = Buffer.alloc(30);
    vp8l.write("RIFF", 0, "ascii");
    vp8l.write("WEBP", 8, "ascii");
    vp8l.write("VP8L", 12, "ascii");
    // width-1 (14 bits) then height-1 (14 bits) at bit offset in the u32 at 21.
    vp8l.writeUInt32LE((100 - 1) | ((50 - 1) << 14), 21);
    expect(getImageDimensions(vp8l.toString("base64"), "image/webp")).toEqual({
      widthPx: 100,
      heightPx: 50,
    });
  });
});

describe("cell-fit sizing (M21 T1.1)", () => {
  it("fits_within_the_max_width_preserving_aspect", () => {
    // 800x600 into max 40 cells wide, default cell 9x18.
    const size = calculateImageCellSize({ widthPx: 800, heightPx: 600 }, 40);
    expect(size.columns).toBeGreaterThan(0);
    expect(size.columns).toBeLessThanOrEqual(40);
    expect(size.rows).toBeGreaterThan(0);
  });
});

describe("capability matrix (M21 T1.1) — env injected", () => {
  it("maps_env_to_protocol", () => {
    expect(detectImageProtocol({ KITTY_WINDOW_ID: "1" })).toBe("kitty");
    expect(detectImageProtocol({ TERM_PROGRAM: "kitty" })).toBe("kitty");
    expect(detectImageProtocol({ TERM_PROGRAM: "ghostty" })).toBe("kitty");
    expect(detectImageProtocol({ WEZTERM_PANE: "0" })).toBe("kitty");
    expect(detectImageProtocol({ ITERM_SESSION_ID: "x" })).toBe("iterm2");
    expect(detectImageProtocol({ TERM_PROGRAM: "iterm.app" })).toBe("iterm2");
  });

  it("forces_null_under_multiplexers_and_unsupported_terminals", () => {
    expect(
      detectImageProtocol({ TMUX: "/tmp/tmux", KITTY_WINDOW_ID: "1" }),
    ).toBeNull();
    expect(detectImageProtocol({ TERM: "screen-256color" })).toBeNull();
    expect(
      detectImageProtocol({ ZELLIJ: "0", KITTY_WINDOW_ID: "1" }),
    ).toBeNull();
    expect(detectImageProtocol({ TERM_PROGRAM: "vscode" })).toBeNull();
    expect(detectImageProtocol({})).toBeNull(); // unknown → conservative
  });
});

describe("more magic-byte parsers (M21 T1.1)", () => {
  it("extracts_jpeg_dimensions", () => {
    // SOI + APP0-ish segment we skip + SOF0 with height=480 width=640.
    const buf = Buffer.from([
      0xff,
      0xd8, // SOI
      0xff,
      0xe0,
      0x00,
      0x04,
      0x00,
      0x00, // APP0, length=4 (skip 2 payload)
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x01,
      0xe0,
      0x02,
      0x80, // SOF0 h=480 w=640
    ]);
    // pad so the loop bound (length-9) is satisfied.
    const padded = Buffer.concat([buf, Buffer.alloc(10)]);
    expect(getImageDimensions(padded.toString("base64"), "image/jpeg")).toEqual(
      {
        widthPx: 640,
        heightPx: 480,
      },
    );
  });

  it("extracts_gif_dimensions", () => {
    const buf = Buffer.alloc(10);
    buf.write("GIF89a", 0, "ascii");
    buf.writeUInt16LE(320, 6);
    buf.writeUInt16LE(240, 8);
    expect(getImageDimensions(buf.toString("base64"), "image/gif")).toEqual({
      widthPx: 320,
      heightPx: 240,
    });
  });

  it("extracts_webp_vp8x_dimensions", () => {
    const buf = Buffer.alloc(30);
    buf.write("RIFF", 0, "ascii");
    buf.write("WEBP", 8, "ascii");
    buf.write("VP8X", 12, "ascii");
    // VP8X stores width-1 / height-1 as 24-bit LE at 24 / 27.
    buf[24] = (100 - 1) & 0xff;
    buf[27] = (50 - 1) & 0xff;
    expect(getImageDimensions(buf.toString("base64"), "image/webp")).toEqual({
      widthPx: 100,
      heightPx: 50,
    });
  });

  it("returns_null_for_a_non_webp_riff", () => {
    const buf = Buffer.alloc(30);
    buf.write("RIFF", 0, "ascii");
    buf.write("AVI ", 8, "ascii");
    expect(getImageDimensions(buf.toString("base64"), "image/webp")).toBeNull();
  });

  it("returns_null_for_an_unknown_webp_chunk", () => {
    const buf = Buffer.alloc(30);
    buf.write("RIFF", 0, "ascii");
    buf.write("WEBP", 8, "ascii");
    buf.write("XXXX", 12, "ascii"); // not VP8/VP8L/VP8X
    expect(getImageDimensions(buf.toString("base64"), "image/webp")).toBeNull();
  });

  it("jpeg_with_no_sof_marker_returns_null", () => {
    // SOI + one valid non-SOF segment (APP0) that advances the scan past the
    // end → the loop exits without an SOF → terminal null.
    const buf = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      Buffer.alloc(14),
    ]);
    expect(getImageDimensions(buf.toString("base64"), "image/jpeg")).toBeNull();
  });

  it("jpeg_scan_skips_padding_and_bails_on_a_bad_segment", () => {
    // A padding byte at the scan start (skip branch) then a segment with an
    // invalid length < 2 (bail branch) — both defensive paths in the SOF scan.
    const buf = Buffer.from([
      0xff,
      0xd8, // SOI
      0x00, // padding → skip
      0xff,
      0xe0,
      0x00,
      0x01, // APP0 with length=1 (< 2) → return null
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    expect(getImageDimensions(buf.toString("base64"), "image/jpeg")).toBeNull();
  });
});

describe("kitty/iterm2 helpers (M21 T1.1)", () => {
  it("allocates_an_image_id_from_the_injected_rng", () => {
    expect(allocateImageId(() => 0)).toBe(1);
    expect(allocateImageId(() => 0.5)).toBeGreaterThan(1);
  });

  it("emits_a_kitty_delete_sequence", () => {
    expect(deleteKittyImage(42)).toContain("a=d,d=I,i=42");
  });

  it("iterm2_honours_inline_false_and_no_aspect", () => {
    const out = encodeITerm2("QUJD", {
      inline: false,
      preserveAspectRatio: false,
    });
    expect(out).toContain("inline=0");
    expect(out).toContain("preserveAspectRatio=0");
  });

  it("detects_the_slow_path_image_line_with_a_cursor_up_prefix", () => {
    const line = String.fromCharCode(27) + "[2A" + encodeKitty("QUJD");
    expect(isImageLine(line)).toBe(true);
  });

  it("cell_fit_respects_a_max_height", () => {
    const size = calculateImageCellSize({ widthPx: 800, heightPx: 600 }, 40, 5);
    expect(size.rows).toBeLessThanOrEqual(5);
  });
});

describe("more capability branches (M21 T1.1)", () => {
  it("maps_warp_and_ghostty_and_wezterm_variants", () => {
    expect(detectImageProtocol({ WARP_SESSION_ID: "x" })).toBe("kitty");
    expect(detectImageProtocol({ GHOSTTY_RESOURCES_DIR: "/x" })).toBe("kitty");
    expect(detectImageProtocol({ TERM: "xterm-ghostty" })).toBe("kitty");
    expect(detectImageProtocol({ TERM_PROGRAM: "wezterm" })).toBe("kitty");
    expect(detectImageProtocol({ TERM: "tmux-256color" })).toBeNull();
  });
});

describe("image line detection + fallback (M21 T1.1)", () => {
  it("detects_an_image_escape_line", () => {
    expect(isImageLine(encodeKitty("QUJD"))).toBe(true);
    expect(isImageLine(encodeITerm2("QUJD"))).toBe(true);
    expect(isImageLine("plain text")).toBe(false);
  });

  it("renders_a_text_fallback_for_unsupported_terminals", () => {
    expect(
      imageFallback("image/png", { widthPx: 800, heightPx: 600 }, "pic.png"),
    ).toBe("[Image: pic.png [image/png] 800x600]");
  });
});
