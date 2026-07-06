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
    ]);
    expect(Object.keys(pkg.peerDependencies)).toEqual(["react"]);
  });

  it("public_entry_exposes_chat_composer_and_text_buffer", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ChatComposer).toBe("function");
    expect(typeof mod.textBufferReducer).toBe("function");
    expect(mod.initialTextBuffer).toEqual({ text: "", cursorOffset: 0 });
  });
});
