import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { TheoTUIProvider, defaultTheme, useTheoTheme } from "./theme.js";
import type { TheoTheme } from "./theme.js";

let captured: TheoTheme | undefined;

// Reset via function call — keeps TS from narrowing `captured` to `undefined`
// inside each test body (assignment-based narrowing would type it `never`).
function resetCaptured() {
  captured = undefined;
}

function Probe() {
  captured = useTheoTheme();
  return <Text>{captured.role.user.glyph}</Text>;
}

describe("theme stub (T1.1)", () => {
  it("use_theo_theme_returns_default_tokens_without_provider", async () => {
    resetCaptured();
    const frame = await renderFrame(<Probe />);
    // Ink trims trailing whitespace per line — assert the visible glyph char.
    expect(frame).toContain(defaultTheme.role.user.glyph.trim());
    expect(captured).toEqual(defaultTheme);
  });

  it("provider_passes_custom_theme_to_consumers", async () => {
    resetCaptured();
    await renderFrame(
      <TheoTUIProvider theme={{ role: { assistant: { glyph: "◆ " } } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.role.assistant.glyph).toBe("◆ ");
  });

  it("partial_override_preserves_untouched_token_groups", async () => {
    resetCaptured();
    await renderFrame(
      <TheoTUIProvider theme={{ role: { user: { glyph: "$ " } } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.role.user.glyph).toBe("$ ");
    // Leaf-level merge proof: overriding one leaf preserves the sibling leaves.
    expect(captured?.role.user.prefix).toBe(defaultTheme.role.user.prefix);
    expect(captured?.status.error).toBe(defaultTheme.status.error);
    expect(captured?.role.assistant).toEqual(defaultTheme.role.assistant);
  });

  it("provider_without_theme_prop_yields_default_tokens", async () => {
    resetCaptured();
    await renderFrame(
      <TheoTUIProvider>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured).toEqual(defaultTheme);
  });

  it("empty_theme_override_yields_default_tokens", async () => {
    resetCaptured();
    await renderFrame(
      <TheoTUIProvider theme={{}}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured).toEqual(defaultTheme);
  });
});
