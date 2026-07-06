import { Box } from "ink";
import { describe, expect, it } from "vitest";

// Integration boundary (plan T2.2, wiring pillar b): everything imported
// ONLY through the composition root — exactly as a consumer would.
import {
  ChatMessage,
  ChatThread,
  TheoTUIProvider,
  defaultTheme,
} from "../src/index.js";
import { renderFrame } from "./helpers.js";

describe("public API integration (T2.2)", () => {
  it("public_entry_composes_provider_and_message_for_both_roles", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={{ role: { user: { glyph: "$ " } } }}>
        <Box flexDirection="column">
          <ChatMessage role="user">first question</ChatMessage>
          <ChatMessage role="assistant">first answer</ChatMessage>
        </Box>
      </TheoTUIProvider>,
    );
    // Custom user glyph from the override + default assistant glyph intact.
    expect(frame).toContain("$");
    expect(frame).toContain(defaultTheme.role.assistant.glyph.trim());
    expect(frame).toContain("first question");
    expect(frame).toContain("first answer");
  });

  it("public_entry_renders_with_default_theme_without_provider", async () => {
    const frame = await renderFrame(
      <ChatMessage role="user">no provider needed</ChatMessage>,
    );
    expect(frame).toContain(defaultTheme.role.user.glyph.trim());
    expect(frame).toContain("no provider needed");
  });
});

describe("public API integration (T2.2 — thread scene)", () => {
  it("public_entry_composes_thread_with_provider", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={{ role: { system: { glyph: "§ " } } }}>
        <ChatThread
          messages={[
            { id: "s", role: "system", content: "session notes" },
            { id: "u", role: "user", content: "hi" },
            { id: "a", role: "assistant", content: "hello!" },
          ]}
        />
      </TheoTUIProvider>,
    );
    expect(frame).toContain("§");
    expect(frame).toContain("session notes");
    expect(frame).toContain("hello!");
  });
});
