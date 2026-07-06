import { execFileSync } from "node:child_process";

import { Box } from "ink";
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

  it("renders_assistant_message_with_glyph_prefix", async () => {
    const frame = await renderFrame(
      <ChatMessage role="assistant">hi there</ChatMessage>,
    );
    expect(frame).toContain("✦");
    expect(frame).toContain("hi there");
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
    // Covers the color-prop branch (default text token is undefined).
    const frame = await renderFrame(
      <TheoTUIProvider theme={{ role: { user: { text: "green" } } }}>
        <ChatMessage role="user">tinted</ChatMessage>
      </TheoTUIProvider>,
    );
    // green foreground = ESC[32m under FORCE_COLOR=1.
    expect(frame).toContain("[32mtinted");
  });

  // Subprocess spawn (~1-2s; slower under coverage instrumentation) — explicit
  // timeout keeps the test deterministic under load (M0 review F-tests-5).
  it(
    "no_color_render_contains_text_without_ansi_escapes",
    { timeout: 20000 },
    () => {
      // Fresh subprocess with NO_COLOR set BEFORE module load (chalk pins its
      // color level at import time — in-process stubEnv cannot degrade it).
      const out = execFileSync(
        "pnpm",
        ["exec", "tsx", "tests/fixtures/no-color-probe.tsx"],
        {
          encoding: "utf8",
          // Kills the child at the deadline — the it-level timeout cannot
          // interrupt a synchronous execFileSync (review tests-3).
          timeout: 20000,
          env: {
            PATH: process.env["PATH"] ?? "",
            HOME: process.env["HOME"] ?? "",
            NO_COLOR: "1",
          },
        },
      );
      expect(out).not.toContain("\u001b[");
      expect(out).toContain(">");
      expect(out).toContain("plain text probe");
      // M1 (T4.2): all three role glyphs distinguishable without color.
      expect(out).toContain("·");
      expect(out).toContain("✦");
      expect(out).toContain("degraded but readable");
      // M2 (T3.1): tool statuses + shell envelope readable without color —
      // the stderr LABEL is the color-independence mechanism (EC-13).
      expect(out).toContain("✓");
      expect(out).toContain("ok-tool");
      // Line-anchored (review tests-1/wire-3): bare toContain("o"/"x") is
      // vacuous — "o" lives in "ok-tool", "x" in "exit path".
      expect(out).toMatch(/^o\s+queued-tool/m);
      expect(out).toMatch(/^x\s+broken-tool/m);
      expect(out).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+running-tool/mu);
      expect(out).toContain("stderr:");
      expect(out).toContain("exited 2");
    },
  );

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
