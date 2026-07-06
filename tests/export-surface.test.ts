import { describe, expect, it } from "vitest";

// Public-entry surface contract (plan T0.2, grows with T1.1/T2.1).
// src/index.ts is the composition root — the ONLY public surface of the package.
describe("public entry surface (T0.2)", () => {
  it("public_entry_exposes_version_constant", async () => {
    const mod = await import("../src/index.js");
    expect(mod.VERSION).toBe("0.0.0");
  });

  it("public_entry_exposes_theme_surface", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.TheoTUIProvider).toBe("function");
    expect(typeof mod.useTheoTheme).toBe("function");
    expect(mod.defaultTheme.role.user.glyph).toBe("> ");
    expect(mod.defaultTheme.role.assistant.glyph).toBe("✦ ");
  });

  it("public_entry_exposes_chat_message", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.ChatMessage).toBe("function");
  });
});
