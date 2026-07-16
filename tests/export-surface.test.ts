import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Public-entry surface contract (plan T0.2, grows with T1.1/T2.1).
// src/index.ts is the composition root — the ONLY public surface of the package.
describe("public entry surface (T0.2)", () => {
  it("public_entry_exposes_version_constant", async () => {
    const mod = await import("../src/index.js");
    // Single source of truth: the exported VERSION must track the manifest
    // (review F-wire-3 — prevents silent drift at the first release bump).
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    expect(mod.VERSION).toBe(pkg.version);
  });

  it("public_entry_exposes_theme_surface", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.TheoTUIProvider).toBe("function");
    expect(typeof mod.useTheoTheme).toBe("function");
    expect(mod.defaultTheme.role.user.glyph).toBe("> ");
    expect(mod.defaultTheme.role.assistant.glyph).toBe("● ");
    expect(mod.defaultTheme.role.system.glyph).toBe("· ");
    // M6: built-ins exported; dark IS the default theme (same object).
    expect(Object.keys(mod.themes).sort()).toEqual([
      "dark",
      "light",
      "no-color",
    ]);
    expect(mod.themes.dark).toBe(mod.defaultTheme);
    // Module-internal by design (M6 — the file's absence-pin pattern):
    expect(mod).not.toHaveProperty("resolveTheme");
    expect(mod).not.toHaveProperty("assertThemeProp");
    expect(mod).not.toHaveProperty("mergeToolStatus");
    expect(mod).not.toHaveProperty("isMonochrome");
  });

  it("public_entry_exposes_chat_message", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ChatMessage).toBe("function");
  });

  it("public_entry_exposes_chat_thread", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ChatThread).toBe("function");
  });

  it("public_entry_exposes_ink_input_provider", async () => {
    const mod = await import("../src/index.js");
    // #41 bridge: makes the custom-renderer interactive components (ChoiceRow,
    // SelectList, Pager, FreeTextInput, decision prompts) receive keyboard
    // input under pure Ink's `render`.
    expect(typeof mod.InkInputProvider).toBe("function");
  });

  it("public_entry_exposes_keyboard_help_surface", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.KeyboardHelp).toBe("function");
    expect(Array.isArray(mod.DEFAULT_COMPOSER_SHORTCUTS)).toBe(true);
    // The `?` toggle chord must be documented in the shipped default list.
    expect(
      mod.DEFAULT_COMPOSER_SHORTCUTS.some(
        (s: { keys: string }) => s.keys === "?",
      ),
    ).toBe(true);
  });

  it("public_entry_exposes_tool_call_surface", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ToolCall).toBe("function");
    expect(typeof mod.ToolCallCard).toBe("function");
    expect(typeof mod.ToolResult).toBe("function");
    // Module-internal by ADR: D1 (indicator width), D7 (truncation helper).
    expect(mod).not.toHaveProperty("STATUS_INDICATOR_WIDTH");
    expect(mod).not.toHaveProperty("truncateLines");
    expect(mod.MAX_RESULT_CHARS).toBe(20000);
  });

  it("manifest_declares_expected_runtime_deps", () => {
    // Dependency contract. M17 T2.1 (plan m17-renderer-skeleton, ADR D1 /
    // 0003): react-reconciler joins the runtime graph — it is the renderer
    // subpath's React host (Ink 7's exact ^0.33.0 pin). Peers stay
    // react-only; react itself is a peerDependency, not a runtime dep.
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "@alcalzone/ansi-tokenize",
      "chalk",
      "cli-boxes",
      "cli-truncate",
      "diff",
      "ignore",
      "ink",
      "ink-spinner",
      "parse-diff",
      "react-reconciler",
      "string-width",
      "widest-line",
      "wrap-ansi",
      "yoga-layout",
    ]);
    expect(pkg.peerDependencies["react"]).toBeDefined();
  });

  it("public_entry_exposes_diff_model", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.parseUnifiedDiff).toBe("function");
    expect(typeof mod.DiffViewer).toBe("function");
    expect(typeof mod.CodeBlock).toBe("function");
    expect(typeof mod.MarkdownText).toBe("function");
    expect(typeof mod.AppStatusBar).toBe("function");
    expect(typeof mod.useTurnElapsed).toBe("function");
    // M15: ChatComposerCommand is type-only — presence pinned by typecheck.
    // M16: ToolCardResult is type-only — presence pinned by typecheck.
    // Module-internal by plan decision (EC-10, D7 precedent):
    expect(mod).not.toHaveProperty("ensureHighlighter");
    expect(mod).not.toHaveProperty("highlightLine");
    expect(mod).not.toHaveProperty("foldDiffLines");
    // PUBLIC readiness seam (DV-5 — review dom-frontend-1):
    expect(typeof mod.preloadHighlighter).toBe("function");
  });

  it("manifest_declares_lowlight_optional_peer", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      peerDependencies: Record<string, string>;
      peerDependenciesMeta: Record<string, { optional?: boolean }>;
    };
    expect(Object.keys(pkg.peerDependencies).sort()).toEqual([
      "ai",
      "figlet",
      "lowlight",
      "react",
    ]);
    expect(pkg.peerDependenciesMeta["lowlight"]?.optional).toBe(true);
    // M27: figlet is also an OPTIONAL peer (renderFigletArt degrades to null).
    expect(pkg.peerDependenciesMeta["figlet"]?.optional).toBe(true);
    // UI-track Step A: `ai` is an OPTIONAL peer (the `./ai-sdk` UIMessage adapter's types).
    expect(pkg.peerDependenciesMeta["ai"]?.optional).toBe(true);
  });

  it("public_entry_exposes_banner_surface", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.Banner).toBe("function");
    expect(typeof mod.renderFigletArt).toBe("function");
    expect(typeof mod.bannerArtWidth).toBe("function");
    expect(mod.bannerArtWidth("ab\nabcd")).toBe(4);
  });

  it("public_entry_exposes_agent_surface", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.AgentTimeline).toBe("function");
    expect(mod.AGENT_EVENT_KINDS).toEqual(["message", "thinking", "tool"]);
    // Runtime union arrays exported for D8 boundary validation (M3):
    expect(mod.CHAT_ROLES).toEqual(["user", "assistant", "system"]);
    expect(mod.TOOL_CALL_STATUSES).toEqual([
      "pending",
      "running",
      "success",
      "failed",
    ]);
    expect(typeof mod.AgentStreaming).toBe("function");
    // Module-internal by plan decision (EC-10, ADR D7 precedent):
    expect(mod).not.toHaveProperty("formatElapsed");
  });

  it("public_entry_exposes_metrics_surface", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ContextWindowBar).toBe("function");
    expect(typeof mod.TokenUsageChart).toBe("function");
    expect(typeof mod.CostMeter).toBe("function");
    // Module-internal by plan decision (M5 ADR D7 — pure cores stay off the
    // entry; a future public formatter export is one line + this pin):
    expect(mod).not.toHaveProperty("renderFillBar");
    expect(mod).not.toHaveProperty("formatPercent");
    expect(mod).not.toHaveProperty("displayPercent");
    expect(mod).not.toHaveProperty("formatTokens");
    expect(mod).not.toHaveProperty("formatCost");
  });

  it("public_entry_exposes_welcome_banner", async () => {
    const mod = await import("../src/index.js");
    // M9 (plan ADR D1): the banner primitive.
    expect(typeof mod.WelcomeBanner).toBe("function");
  });

  it("public_entry_exposes_stream_adapter", async () => {
    const mod = await import("../src/index.js");
    // M7 (plan ADR D8): hook + reducer + initial state are the public trio.
    expect(typeof mod.useAgentStream).toBe("function");
    expect(typeof mod.agentStreamReducer).toBe("function");
    expect(mod.initialAgentStreamState).toMatchObject({
      status: "idle",
      events: [],
      seq: 0,
    });
    // Module-internal by design (the absence-pin pattern): the guards are
    // reducer implementation detail, not API.
    expect(mod).not.toHaveProperty("isShellEnvelope");
    expect(mod).not.toHaveProperty("extractAssistantText");
  });

  it("public_entry_exposes_chat_composer_and_text_buffer", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ChatComposer).toBe("function");
    expect(typeof mod.textBufferReducer).toBe("function");
    expect(mod.initialTextBuffer).toEqual({ text: "", cursorOffset: 0 });
  });

  it("public_entry_exposes_agent_decision_surface", async () => {
    const mod = await import("../src/index.js");
    // M23: the three decision surfaces + the shared ChoiceRow / FreeTextInput.
    expect(typeof mod.ApprovalPrompt).toBe("function");
    expect(typeof mod.QuestionPrompt).toBe("function");
    expect(typeof mod.PlanApproval).toBe("function");
    expect(typeof mod.ChoiceRow).toBe("function");
    expect(typeof mod.FreeTextInput).toBe("function");
    // The pure oracle + the canonical approval triad (values only — the lib
    // never enumerates policy semantics, ADR D3/D5).
    expect(typeof mod.resolveChoiceKey).toBe("function");
    expect(mod.DEFAULT_APPROVAL_CHOICES.map((c) => c.value)).toEqual([
      "once",
      "always",
      "reject",
    ]);
    expect(mod.OTHER_OPTION_VALUE).toBe("__theo_other__");
    // Module-internal by design (the absence-pin pattern): the plan choice set
    // stays private; only resolveChoiceKey + DEFAULT_APPROVAL_CHOICES are public.
    expect(mod).not.toHaveProperty("PLAN_CHOICES");
  });
});
