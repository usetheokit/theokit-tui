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
    expect(mod.defaultTheme.role.assistant.glyph).toBe("✦ ");
    expect(mod.defaultTheme.role.system.glyph).toBe("· ");
    // M6: built-ins exported; dark IS the default theme (same object).
    expect(Object.keys(mod.themes).sort()).toEqual([
      "dark",
      "light",
      "no-color",
    ]);
    expect(mod.themes.dark).toBe(mod.defaultTheme);
  });

  it("public_entry_exposes_chat_message", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ChatMessage).toBe("function");
  });

  it("public_entry_exposes_chat_thread", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ChatThread).toBe("function");
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

  it("manifest_declares_only_ink_and_ink_spinner_runtime_deps", () => {
    // T1.1 dependency contract: ink-spinner is the FIRST new runtime dep
    // since M0 (plan ADR D2); peers stay react-only.
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "ink",
      "ink-spinner",
      "parse-diff",
    ]);
    expect(pkg.peerDependencies["react"]).toBeDefined();
  });

  it("public_entry_exposes_diff_model", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.parseUnifiedDiff).toBe("function");
    expect(typeof mod.DiffViewer).toBe("function");
    expect(typeof mod.CodeBlock).toBe("function");
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
      "lowlight",
      "react",
    ]);
    expect(pkg.peerDependenciesMeta["lowlight"]?.optional).toBe(true);
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

  it("public_entry_exposes_chat_composer_and_text_buffer", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ChatComposer).toBe("function");
    expect(typeof mod.textBufferReducer).toBe("function");
    expect(mod.initialTextBuffer).toEqual({ text: "", cursorOffset: 0 });
  });
});
