import { Box, Text } from "ink";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { Image } from "../../src/index.js";
import { createRenderer } from "../../src/renderer/index.js";
import { Output } from "../../src/renderer/output/output-grid.js";
import { VirtualTerminal } from "./virtual-terminal.js";

// M21 T2.1 (plan m21-premium-capabilities, ADR A2): the image wiring — a
// raw-passthrough line (width-exempt, emitted verbatim) + row-span filler so an
// image reserves the correct vertical space without desyncing the differential
// diff. Ink's Static + our M20 scroll-invariant engine underneath. A tiny 1x1
// PNG is the fixture; the protocol is injected so tests are deterministic.

const ESC = String.fromCharCode(27);

// A minimal valid PNG (1x1) as base64 — magic bytes + IHDR are what we read.
function png1x1(): string {
  const buf = Buffer.alloc(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf.writeUInt32BE(1, 16);
  buf.writeUInt32BE(1, 20);
  return buf.toString("base64");
}

async function settle(term: VirtualTerminal): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await term.flush();
}

describe("output-grid writeRaw (M21 T2.1)", () => {
  it("emits_a_raw_line_verbatim_without_remeasuring", () => {
    const out = new Output({ width: 10, height: 3 });
    const seq = ESC + "_Ga=T,f=100;QUJD" + ESC + "\\";
    out.writeRaw(0, seq);
    const { output } = out.get();
    const lines = output.split("\n");
    // The escape survives byte-for-byte (not tokenized / width-measured).
    expect(lines[0]).toBe(seq);
    // Rows below the raw line stay blank (filler).
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("");
  });
});

describe("Image component (M21 T2.1)", () => {
  it("emits_kitty_bytes_on_a_kitty_terminal", async () => {
    const term = new VirtualTerminal(40, 12);
    const r = createRenderer(term);
    r.render(
      createElement(Image, {
        base64Data: png1x1(),
        mimeType: "image/png",
        protocol: "kitty",
      }),
    );
    await settle(term);
    expect(term.writeStream()).toContain(ESC + "_G");
    r.unmount();
  });

  it("emits_iterm2_bytes_with_a_cursor_up_prefix_on_an_iterm2_terminal", async () => {
    const term = new VirtualTerminal(40, 12);
    const r = createRenderer(term);
    r.render(
      createElement(Image, {
        base64Data: png1x1(),
        mimeType: "image/png",
        protocol: "iterm2",
        maxWidthCells: 20,
      }),
    );
    await settle(term);
    const stream = term.writeStream();
    expect(stream).toContain(ESC + "]1337;File=");
    expect(stream).toContain("inline=1");
    r.unmount();
  });

  it("falls_back_to_text_on_an_unsupported_terminal", async () => {
    const term = new VirtualTerminal(40, 12);
    const r = createRenderer(term);
    r.render(
      createElement(Image, {
        base64Data: png1x1(),
        mimeType: "image/png",
        filename: "pic.png",
        protocol: null,
      }),
    );
    await settle(term);
    expect(term.screenLines().join("\n")).toContain("[Image: pic.png");
    r.unmount();
  });

  it("does_not_re_emit_an_unchanged_image_when_a_line_in_the_span_changes", async () => {
    // Review HIGH: an image between two rows that BOTH change (span crosses the
    // image) must NOT re-blast the escape (perf + duplicate kitty placement).
    function App({ top, bottom }: { top: string; bottom: string }) {
      return createElement(
        Box,
        { flexDirection: "column" },
        createElement(Text, {}, `T:${top}`),
        createElement(Image, {
          base64Data: png1x1(),
          mimeType: "image/png",
          protocol: "kitty",
        }),
        createElement(Text, {}, `B:${bottom}`),
      );
    }
    const term = new VirtualTerminal(40, 30);
    const r = createRenderer(term);
    r.render(createElement(App, { top: "1", bottom: "1" }));
    await settle(term);
    r.render(createElement(App, { top: "2", bottom: "2" })); // span crosses image
    await settle(term);
    // The kitty escape hit the wire exactly once (first render only).
    expect(term.writeStream().split(ESC + "_G").length - 1).toBe(1);
    r.unmount();
  });

  it("frees_the_kitty_image_on_unmount", async () => {
    const term = new VirtualTerminal(40, 12);
    const r = createRenderer(term);
    r.render(
      createElement(Image, {
        base64Data: png1x1(),
        mimeType: "image/png",
        protocol: "kitty",
      }),
    );
    await settle(term);
    r.unmount();
    await new Promise((res) => setTimeout(res, 0));
    // The delete-image escape (a=d,d=I) was written on unmount (no leak).
    expect(term.writeStream()).toContain("a=d,d=I");
  });

  it("differential_update_below_an_image_lands_correctly", async () => {
    // Regression-grade (mirrors M20 B1): an image reserves its rows; a live line
    // BELOW it updates in place without corrupting the image or other rows.
    function App({ label }: { label: string }) {
      return createElement(
        Box,
        { flexDirection: "column" },
        createElement(Image, {
          base64Data: png1x1(),
          mimeType: "image/png",
          protocol: "kitty",
        }),
        createElement(Text, {}, `L:${label}`),
      );
    }
    const term = new VirtualTerminal(40, 14);
    const r = createRenderer(term);
    r.render(createElement(App, { label: "one" }));
    await settle(term);
    r.render(createElement(App, { label: "two" }));
    await settle(term);
    const screen = term.screenLines().join("\n");
    expect(screen).toContain("L:two");
    expect(screen).not.toContain("L:one");
    r.unmount();
  });
});
