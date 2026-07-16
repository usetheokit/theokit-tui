import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { ChatMessage } from "./chat-message.js";
import { TheoTUIProvider } from "./theme.js";

describe("ChatMessage (T2.1)", () => {
  it("renders_user_message_with_glyph_prefix", async () => {
    const frame = await renderFrame(
      <ChatMessage role="user">hello</ChatMessage>,
    );
    expect(frame).toContain(">");
    expect(frame).toContain("hello");
  });

  it("renders_assistant_message_with_the_bullet_glyph", async () => {
    // M27.1 Claude Code parity: the assistant turn is marked with a `⏺` bullet
    // (aligned width-1 filled circle), distinct from the user's `>` prompt.
    const frame = await renderFrame(
      <ChatMessage role="assistant">hi there</ChatMessage>,
    );
    expect(frame).toContain("⏺");
    expect(frame).toContain("hi there");
  });

  it("user_message_text_renders_dim_the_input_echo", async () => {
    // M27.1: the user turn is the input echo — dim it so the assistant reply
    // (normal) reads as the prominent output (Claude Code contrast).
    const frame = await renderFrame(
      <ChatMessage role="user">my prompt</ChatMessage>,
    );
    expect(frame).toMatch(/\[2m/); // dim SGR on the user text
    expect(frame).toContain("my prompt");
  });

  it("assistant_message_text_is_not_dim", async () => {
    const frame = await renderFrame(
      <ChatMessage role="assistant">the reply</ChatMessage>,
    );
    // The reply is the prominent output — the content is not dim-wrapped.
    // (The bullet may carry color, but the text stays normal weight.)
    expect(frame).toContain("the reply");
    expect(frame).not.toMatch(/\[2mthe reply/);
  });

  it("renders_system_message_with_glyph_prefix", async () => {
    const frame = await renderFrame(
      <ChatMessage role="system">context note</ChatMessage>,
    );
    expect(frame).toContain("·");
    expect(frame).toContain("context note");
  });

  it("system_frame_matches_snapshot_under_forced_color", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <ChatMessage role="system">Session started.</ChatMessage>
      </Box>,
    );
    expect(frame).toMatchSnapshot("chat-message-system");
  });

  it("user_frame_matches_snapshot_under_forced_color", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <ChatMessage role="user">What is Theo?</ChatMessage>
      </Box>,
    );
    expect(frame).toMatchSnapshot("chat-message-user");
  });

  it("assistant_frame_matches_snapshot_under_forced_color", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <ChatMessage role="assistant">Theo is an AI toolkit.</ChatMessage>
      </Box>,
    );
    expect(frame).toMatchSnapshot("chat-message-assistant");
  });

  it("forced_color_canary_ansi_escapes_present", async () => {
    // Canary (SEPA iteration-2): proves FORCE_COLOR=1 held in the worker -
    // catches any future regression of the vitest env pin (ADR D2).
    const frame = await renderFrame(
      <ChatMessage role="user">canary</ChatMessage>,
    );
    expect(frame).toContain("\u001b[");
  });

  it("respects_custom_theme_glyph_via_provider", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={{ role: { assistant: { glyph: "◆ " } } }}>
        <ChatMessage role="assistant">custom</ChatMessage>
      </TheoTUIProvider>,
    );
    expect(frame).toContain("◆");
    expect(frame).toContain("custom");
  });

  it("invalid_role_throws_typed_error_with_clear_message", () => {
    // EC-1 (negative case): the guard is the FIRST statement of ChatMessage —
    // direct invocation fires it before any hook runs (SEPA resolution 1).
    expect(() =>
      ChatMessage({
        // @ts-expect-error — deliberately invalid role (EC-1 negative case)
        role: "model",
        children: "x",
      }),
    ).toThrow(TypeError);
    expect(() =>
      ChatMessage({
        // @ts-expect-error — deliberately invalid role (EC-1 negative case)
        role: "model",
        children: "x",
      }),
    ).toThrow(
      'ChatMessage: invalid role "model" — expected "user" | "assistant" | "system"',
    );
  });

  it("long_content_wraps_inside_narrow_box_without_crash", async () => {
    // EC-3 (edge case): 120 chars of spaced words inside a 20-col box.
    const long = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
    const frame = await renderFrame(
      <Box width={20}>
        <ChatMessage role="user">{long}</ChatMessage>
      </Box>,
    );
    expect(frame.length > 0).toBe(true);
    expect(frame).toContain("word0");
  });

  it("applies_custom_text_color_token_when_defined", async () => {
    // Covers the color-prop branch (default text token is undefined). M27.1: the
    // user turn is also dim (input echo), so green + dim co-apply on the text —
    // the custom color is still emitted, just alongside the `[2m` dim attribute.
    const frame = await renderFrame(
      <TheoTUIProvider theme={{ role: { user: { text: "green" } } }}>
        <ChatMessage role="user">tinted</ChatMessage>
      </TheoTUIProvider>,
    );
    expect(frame).toContain("[32m"); // green foreground still emitted
    expect(frame).toMatch(/\[2m/); // dim (input echo)
    expect(frame).toContain("tinted");
  });

  // The NO_COLOR subprocess probe MOVED to
  // tests/degrade-matrix.integration.test.tsx (M6 T3.2) — one file now owns
  // the 3-scene env matrix; the forced-color canary above stays here to
  // guard the vitest FORCE_COLOR pin.
  it("chat_message_default_off_is_byte_identical", async () => {
    // M13 EC-3: WITHOUT `markdown` (absent OR explicit false) the raw
    // markers render literally, and the two default paths are byte-equal
    // (LIVE comparison — kills the `markdown !== undefined` mutant, r2-F2).
    const md = "**bold** and `code`";
    const absent = await renderFrame(
      <ChatMessage role="assistant">{md}</ChatMessage>,
    );
    const explicitFalse = await renderFrame(
      <ChatMessage role="assistant" markdown={false}>
        {md}
      </ChatMessage>,
    );
    expect(absent).toBe(explicitFalse);
    expect(absent).toContain("**bold**");
    expect(absent).toContain("`code`");
  });

  it("chat_message_markdown_opt_in_renders_styled", async () => {
    const frame = await renderFrame(
      <Box width={60}>
        <ChatMessage role="assistant" markdown>
          {"# Hi\n**bold** and `code`"}
        </ChatMessage>
      </Box>,
    );
    expect(frame).not.toContain("**");
    expect(frame).not.toContain("# Hi");
    expect(frame).toContain("Hi");
    expect(frame).toContain("bold");
  });

  it("chat_message_markdown_requires_string_children", () => {
    const bad = () =>
      ChatMessage({
        role: "assistant",
        markdown: true,
        children: <Text>node</Text>,
      });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow(/markdown/);
  });

  it("renders_glyph_only_for_empty_children", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <ChatMessage role="user">{""}</ChatMessage>
      </Box>,
    );
    expect(frame).toContain(">");
    // Snapshot proves glyph-only output — no stray content (review F-tests-3).
    expect(frame).toMatchSnapshot("chat-message-empty");
  });
});
