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
});
