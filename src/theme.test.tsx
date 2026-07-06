import { Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { TheoTUIProvider, defaultTheme, useTheoTheme } from "./theme.js";
import type { TheoTheme } from "./theme.js";

// T1.1 local one-tick helper — tests/helpers.tsx only lands at T2.1 (SEPA
// resolution 5: documented temporary duplication, extracted in T2.1 REFACTOR).
const tick = async () => new Promise((resolve) => setTimeout(resolve, 0));

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
    const { lastFrame } = render(<Probe />);
    await tick();
    // Ink trims trailing whitespace per line — assert the visible glyph char.
    expect(lastFrame()).toContain(defaultTheme.role.user.glyph.trim());
    expect(captured).toEqual(defaultTheme);
  });

  it("provider_passes_custom_theme_to_consumers", async () => {
    resetCaptured();
    render(
      <TheoTUIProvider theme={{ role: { assistant: { glyph: "◆ " } } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    await tick();
    expect(captured?.role.assistant.glyph).toBe("◆ ");
  });

  it("partial_override_preserves_untouched_token_groups", async () => {
    resetCaptured();
    render(
      <TheoTUIProvider theme={{ role: { user: { glyph: "$ " } } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    await tick();
    expect(captured?.role.user.glyph).toBe("$ ");
    // Leaf-level merge proof: overriding one leaf preserves the sibling leaves.
    expect(captured?.role.user.prefix).toBe(defaultTheme.role.user.prefix);
    expect(captured?.status.error).toBe(defaultTheme.status.error);
    expect(captured?.role.assistant).toEqual(defaultTheme.role.assistant);
  });

  it("empty_theme_override_yields_default_tokens", async () => {
    resetCaptured();
    render(
      <TheoTUIProvider theme={{}}>
        <Probe />
      </TheoTUIProvider>,
    );
    await tick();
    expect(captured).toEqual(defaultTheme);
  });
});
