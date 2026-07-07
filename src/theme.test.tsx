import { Text } from "ink";
import { beforeEach, describe, expect, it } from "vitest";

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
  beforeEach(() => {
    resetCaptured();
  });

  it("use_theo_theme_returns_default_tokens_without_provider", async () => {
    const frame = await renderFrame(<Probe />);
    // Ink trims trailing whitespace per line — assert the visible glyph char.
    expect(frame).toContain(defaultTheme.role.user.glyph.trim());
    expect(captured).toEqual(defaultTheme);
  });

  it("provider_passes_custom_theme_to_consumers", async () => {
    await renderFrame(
      <TheoTUIProvider theme={{ role: { assistant: { glyph: "◆ " } } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.role.assistant.glyph).toBe("◆ ");
  });

  it("partial_override_preserves_untouched_token_groups", async () => {
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
    await renderFrame(
      <TheoTUIProvider>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured).toEqual(defaultTheme);
  });

  it("provider_with_explicit_undefined_theme_yields_default_tokens", async () => {
    await renderFrame(
      <TheoTUIProvider theme={undefined}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured).toEqual(defaultTheme);
  });

  it("nested_provider_resets_to_default_plus_own_override", async () => {
    // Pins the documented M0 nesting semantics: inner provider does NOT
    // compose with the outer one (review F-dom-3; composition lands at M6).
    await renderFrame(
      <TheoTUIProvider theme={{ role: { user: { glyph: "$ " } } }}>
        <TheoTUIProvider theme={{ role: { assistant: { glyph: "◆ " } } }}>
          <Probe />
        </TheoTUIProvider>
      </TheoTUIProvider>,
    );
    expect(captured?.role.assistant.glyph).toBe("◆ ");
    // Outer override is discarded — user resets to the default glyph.
    expect(captured?.role.user.glyph).toBe(defaultTheme.role.user.glyph);
  });

  it("default_theme_exposes_system_tokens", () => {
    expect(defaultTheme.role.system.glyph).toBe("· ");
    expect(defaultTheme.role.system.prefix).toBe("gray");
  });

  it("system_tokens_overridable_via_provider", async () => {
    resetCaptured();
    await renderFrame(
      <TheoTUIProvider theme={{ role: { system: { glyph: "§ " } } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.role.system.glyph).toBe("§ ");
    // Leaf preservation for the new group too.
    expect(captured?.role.system.prefix).toBe(defaultTheme.role.system.prefix);
  });

  it("empty_theme_override_yields_default_tokens", async () => {
    await renderFrame(
      <TheoTUIProvider theme={{}}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured).toEqual(defaultTheme);
  });
});

// M6 T1.1 (plan m6-theme-robustness, ADR D1): semantic growth — new groups
// with BYTE-IDENTICAL defaults (the values are today's module constants).
describe("theme token growth (M6 T1.1)", () => {
  beforeEach(() => {
    resetCaptured();
  });

  it("default_theme_carries_new_groups_with_todays_values", () => {
    const t = defaultTheme;
    expect(t.name).toBe("dark");
    expect(t.accent).toBe("cyan");
    expect(t.code.keyword).toBe("blue");
    expect(t.code.builtin).toBe("cyan");
    expect(t.code.number).toBe("green");
    expect(t.code.string).toBe("yellow");
    expect(t.code.regexp).toBe("red");
    expect(t.code.comment).toBe("gray");
    expect(t.code.variable).toBe("magenta");
  });

  it("default_tool_status_matches_current_visuals", () => {
    expect(defaultTheme.toolStatus.pending).toEqual({
      glyph: "o",
      color: "gray",
    });
    expect(defaultTheme.toolStatus.success).toEqual({
      glyph: "✓",
      color: "green",
    });
    expect(defaultTheme.toolStatus.failed).toEqual({
      glyph: "x",
      color: "red",
    });
    // running carries NO glyph slot — ink-spinner animates (D1).
    expect(defaultTheme.toolStatus.running).toEqual({ color: "yellow" });
  });

  it("new_groups_are_frozen", () => {
    expect(Object.isFrozen(defaultTheme.code)).toBe(true);
    expect(Object.isFrozen(defaultTheme.toolStatus)).toBe(true);
    expect(Object.isFrozen(defaultTheme.toolStatus.pending)).toBe(true);
  });

  it("override_merges_accent_leaf", async () => {
    await renderFrame(
      <TheoTUIProvider theme={{ accent: "magenta" }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.accent).toBe("magenta");
    expect(captured?.code.keyword).toBe("blue");
  });

  it("override_merges_code_group_leaf", async () => {
    await renderFrame(
      <TheoTUIProvider theme={{ code: { string: "cyan" } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.code.string).toBe("cyan");
    expect(captured?.code.keyword).toBe("blue");
  });

  it("override_merges_tool_status_leaf", async () => {
    await renderFrame(
      <TheoTUIProvider theme={{ toolStatus: { failed: { glyph: "✗" } } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.toolStatus.failed.glyph).toBe("✗");
    // Leaf sibling preserved.
    expect(captured?.toolStatus.failed.color).toBe("red");
  });

  it("override_marks_theme_name_custom", async () => {
    await renderFrame(
      <TheoTUIProvider theme={{ accent: "magenta" }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.name).toBe("custom");
  });

  it("m0_override_calls_unchanged", async () => {
    // The M0 contract intact: existing two-group overrides behave identically.
    await renderFrame(
      <TheoTUIProvider
        theme={{
          role: { user: { glyph: "$ " } },
          status: { error: "redBright" },
        }}
      >
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.role.user.glyph).toBe("$ ");
    expect(captured?.status.error).toBe("redBright");
    expect(captured?.role.assistant.glyph).toBe("✦ ");
  });
});
