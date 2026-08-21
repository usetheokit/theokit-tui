import { describe, expect, it } from "vitest";

import { bannerArtWidth, renderFigletArt } from "../../src/branding/figlet-art.js";

// M27 — the pure width helper + the OPTIONAL-peer figlet generator.

describe("bannerArtWidth (T1.1)", () => {
  it("is_the_widest_line", () => {
    expect(bannerArtWidth("ab\nabcd\nabc")).toBe(4);
  });
  it("empty_art_is_zero", () => {
    expect(bannerArtWidth("")).toBe(0);
  });
  it("counts_display_width_for_cjk", () => {
    // 名 is a wide (2-cell) glyph — display width, not codepoint count.
    expect(bannerArtWidth("名前")).toBe(4);
  });
});

describe("renderFigletArt (T3.1 — optional peer)", () => {
  it("returns_null_when_figlet_is_absent", async () => {
    // The repo does NOT install figlet — the default loader import fails and the
    // helper degrades to null (never throws) so the app falls back to the name.
    await expect(renderFigletArt("Theo")).resolves.toBeNull();
  });

  it("generates_art_via_an_injected_figlet_loader", async () => {
    const fake = { textSync: (t: string) => `<<${t}>>` };
    const art = await renderFigletArt("Hi", "Standard", async () => fake);
    expect(art).toBe("<<Hi>>");
  });

  it("returns_null_on_an_unknown_font", async () => {
    const throwing = {
      textSync: () => {
        throw new Error("Unknown font");
      },
    };
    const art = await renderFigletArt("Hi", "Nope", async () => throwing);
    expect(art).toBeNull();
  });

  it("passes_the_font_option_to_textSync", async () => {
    let seen: unknown;
    const spy = {
      textSync: (_t: string, opts: unknown) => {
        seen = opts;
        return "x";
      },
    };
    await renderFigletArt("Hi", "Slant", async () => spy);
    expect(seen).toMatchObject({ font: "Slant" });
  });
});
