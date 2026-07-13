import { Text } from "ink";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import {
  TheoTUIProvider,
  defaultTheme,
  isMonochrome,
  themes,
  useTheoTheme,
} from "./theme.js";
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
    // M26: the status bullet is a `●` (U+25CF) colored by status (Claude Code
    // tool-card parity) — color carries the meaning, one glyph across states.
    expect(defaultTheme.toolStatus.pending).toEqual({
      glyph: "●",
      color: "gray",
    });
    expect(defaultTheme.toolStatus.success).toEqual({
      glyph: "●",
      color: "green",
    });
    expect(defaultTheme.toolStatus.failed).toEqual({
      glyph: "●",
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
    expect(captured?.role.assistant.glyph).toBe("● ");
  });
});

// Collects every color-string leaf of a theme (built-in value audits).
function collectColorStrings(theme: TheoTheme): string[] {
  const values: string[] = [];
  for (const role of Object.values(theme.role)) {
    values.push(role.prefix);
    if (role.text !== undefined) {
      values.push(role.text);
    }
  }
  values.push(...Object.values(theme.status));
  values.push(theme.accent, ...Object.values(theme.code));
  values.push(
    theme.toolStatus.pending.color,
    theme.toolStatus.running.color,
    theme.toolStatus.success.color,
    theme.toolStatus.failed.color,
  );
  return values;
}

// M6 T1.2 (plan m6-theme-robustness, ADRs D2/D3/D4): built-ins + union prop
// + the NO_COLOR swap (OURS — the installed chalk chain has none).
describe("built-in themes + provider resolution (M6 T1.2)", () => {
  beforeEach(() => {
    resetCaptured();
  });

  it("selects_builtin_by_name", async () => {
    await renderFrame(
      <TheoTUIProvider theme="light">
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.name).toBe("light");
    expect(captured?.accent).toBe("blue");
  });

  it("light_theme_is_named_ansi16_only", () => {
    // D3: no hex in built-ins — hex would fork snapshots between the local
    // level-1 pin and GH Actions' forced level 3.
    for (const value of collectColorStrings(themes.light)) {
      expect(value).not.toMatch(/^#/);
    }
  });

  it("no_color_theme_zeroes_colors_keeps_glyphs", () => {
    const nc = themes["no-color"];
    expect(nc.status.error).toBe("");
    expect(nc.accent).toBe("");
    expect(nc.code.keyword).toBe("");
    expect(nc.toolStatus.success.glyph).toBe("●");
    expect(nc.role.user.glyph).toBe("> ");
    expect(nc.name).toBe("no-color");
  });

  it("pair_form_merges_onto_named_base", async () => {
    await renderFrame(
      <TheoTUIProvider
        theme={{ base: "light", override: { accent: "magenta" } }}
      >
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.accent).toBe("magenta");
    expect(captured?.role.user.prefix).toBe(themes.light.role.user.prefix);
    expect(captured?.name).toBe("custom");
  });

  it("plain_override_still_merges_onto_dark", async () => {
    // The M0 degenerate case — base dark.
    await renderFrame(
      <TheoTUIProvider theme={{ accent: "magenta" }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.code.keyword).toBe("blue");
  });

  it("no_color_env_wins_over_prop", async () => {
    // In-process — the swap is THEME-layer (gemini test shape); a fresh mount
    // re-runs the provider memo which reads the env.
    vi.stubEnv("NO_COLOR", "1");
    try {
      await renderFrame(
        <TheoTUIProvider theme="light">
          <Probe />
        </TheoTUIProvider>,
      );
      expect(captured?.name).toBe("no-color");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("empty_no_color_env_is_not_set", async () => {
    // The vitest pin contract (D4): NO_COLOR="" means NOT set.
    vi.stubEnv("NO_COLOR", "");
    try {
      await renderFrame(
        <TheoTUIProvider theme="light">
          <Probe />
        </TheoTUIProvider>,
      );
      expect(captured?.name).toBe("light");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("no_color_swap_discards_all_overrides_including_glyphs", async () => {
    // EC-7: full-swap semantics — glyph overrides revert to the
    // tested-readable defaults too (documented).
    vi.stubEnv("NO_COLOR", "1");
    try {
      await renderFrame(
        <TheoTUIProvider theme={{ role: { user: { glyph: "$ " } } }}>
          <Probe />
        </TheoTUIProvider>,
      );
      expect(captured?.role.user.glyph).toBe("> ");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("unknown_theme_name_throws_typed", () => {
    const call = () =>
      TheoTUIProvider({ theme: "solarized" as never, children: null });
    expect(call).toThrow(TypeError);
    expect(call).toThrow("unknown theme");
  });

  it("unknown_pair_key_throws_typed", () => {
    const call = () =>
      TheoTUIProvider({
        theme: { base: "dark", extra: 1 } as never,
        children: null,
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow("extra");
  });

  it("invalid_theme_values_throw_our_typed_error", () => {
    // EC-5: never the engine's bare `in`-operator error; arrays rejected.
    for (const bad of [null, 42, []]) {
      const call = () =>
        TheoTUIProvider({ theme: bad as never, children: null });
      expect(call).toThrow(TypeError);
      expect(call).toThrow("TheoTUIProvider: theme must be");
    }
  });

  it("degenerate_forms_pin_name_semantics", async () => {
    // EC-6: identity is FORM-based, not value-based.
    await renderFrame(
      <TheoTUIProvider theme={{ base: "light" }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.name).toBe("light");
    expect(captured).toBe(themes.light);

    resetCaptured();
    await renderFrame(
      <TheoTUIProvider theme={{ base: "light", override: {} }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.name).toBe("light");
    expect(captured).toBe(themes.light);

    resetCaptured();
    await renderFrame(
      <TheoTUIProvider theme={{ accent: "cyan" }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.name).toBe("custom");
  });

  it("pair_form_invalid_override_throws_our_typed_error", () => {
    // review arch-1: null/string/array overrides must hit OUR guard, never
    // the engine's Object.keys TypeError (or silently mislabel as custom).
    for (const bad of [null, "light", []]) {
      const call = () =>
        TheoTUIProvider({
          theme: { base: "dark", override: bad } as never,
          children: null,
        });
      expect(call).toThrow(TypeError);
      expect(call).toThrow("TheoTUIProvider: theme must be");
    }
  });

  it("pair_form_unknown_base_throws_typed", () => {
    // review tests-5: the unknown-name negative through the PAIR form.
    const call = () =>
      TheoTUIProvider({
        theme: { base: "solarized" } as never,
        children: null,
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow('unknown theme "solarized"');
  });

  it("no_color_theme_has_every_color_leaf_empty", () => {
    // review tests-4: audit EVERY leaf, not a sample.
    for (const value of collectColorStrings(themes["no-color"])) {
      expect(value).toBe("");
    }
    expect(isMonochrome(themes["no-color"])).toBe(true);
    expect(isMonochrome(themes.dark)).toBe(false);
  });

  it("customized_no_color_base_stays_monochrome", async () => {
    // review arch-2/dom-frontend-1: identity says "custom", DATA says
    // monochrome — degrade-aware branches must follow the data.
    await renderFrame(
      <TheoTUIProvider
        theme={{
          base: "no-color",
          override: { role: { user: { glyph: ">> " } } },
        }}
      >
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.name).toBe("custom");
    expect(captured ? isMonochrome(captured) : false).toBe(true);
  });

  it("pair_form_without_base_merges_onto_dark", async () => {
    // The `base ?? "dark"` default branch: an override-only pair form.
    await renderFrame(
      <TheoTUIProvider theme={{ override: { accent: "magenta" } }}>
        <Probe />
      </TheoTUIProvider>,
    );
    expect(captured?.accent).toBe("magenta");
    expect(captured?.code.keyword).toBe("blue");
    expect(captured?.name).toBe("custom");
  });

  it("builtin_selection_is_referentially_stable", async () => {
    const captures: TheoTheme[] = [];
    function Capture() {
      captures.push(useTheoTheme());
      return null;
    }
    const { render } = await import("ink-testing-library");
    const instance = render(
      <TheoTUIProvider theme="dark">
        <Capture />
      </TheoTUIProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.rerender(
      <TheoTUIProvider theme="dark">
        <Capture />
      </TheoTUIProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.unmount();
    expect(captures.length).toBeGreaterThanOrEqual(2);
    expect(captures[0]).toBe(captures[captures.length - 1]);
    expect(captures[0]).toBe(themes.dark);
  });
});
