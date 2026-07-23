import { describe, expect, it } from "vitest";

import {
  extractAssistantText,
  isShellEnvelope,
  looksLikeUnifiedDiff,
} from "./agent-stream-event.js";
import type { AgentStreamEvent } from "./agent-stream-event.js";

describe("looksLikeUnifiedDiff", () => {
  it("detects a git-style unified diff (hunk + file header)", () => {
    expect(looksLikeUnifiedDiff("--- a\n+++ a\n@@ -1 +1 @@\n-x\n+y\n")).toBe(
      true,
    );
    expect(
      looksLikeUnifiedDiff("diff --git a/x b/x\n@@ -1 +1 @@\n-x\n+y"),
    ).toBe(true);
  });

  it("rejects plain text that merely mentions @@ or ---", () => {
    // A directory listing / prose is NOT a diff: no BOTH signals present.
    expect(looksLikeUnifiedDiff("README.md\ncalc.mjs")).toBe(false);
    expect(looksLikeUnifiedDiff("see @@ below\n--- notes")).toBe(false); // no hunk header
    expect(looksLikeUnifiedDiff("MCP_SUM=111")).toBe(false);
  });
});

// T1.1 (plan m7-stream-adapter, ADR D1): the structural union's guards.
describe("isShellEnvelope", () => {
  it("shell_envelope_detected_structurally", () => {
    const yes = isShellEnvelope({ stdout: "a", stderr: "", exitCode: 0 });
    expect(yes).toBe(true);
    const partial = isShellEnvelope({ stdout: "x" });
    expect(partial).toBe(true);
  });

  it("non_envelope_results_rejected", () => {
    // EC-12: stdout/stderr must be STRINGS when present, exitCode a number.
    for (const bad of [
      null,
      "text",
      42,
      {},
      { random: 1 },
      { exitCode: "0" },
      { stdout: 42 },
      { stderr: {} },
    ]) {
      const out = isShellEnvelope(bad);
      expect(out, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("extractAssistantText", () => {
  it("assistant_text_extracted_from_content_blocks", () => {
    const text = extractAssistantText({
      content: [
        { type: "text", text: "a" },
        { type: "tool_use" },
        { type: "text", text: "b" },
      ],
    });
    expect(text).toBe("ab");
  });

  it("assistant_text_from_string_message", () => {
    // The SDKStatusMessage-widened arm: message may be a plain string.
    const text = extractAssistantText("plain");
    expect(text).toBe("plain");
  });

  it("assistant_text_empty_on_garbage", () => {
    for (const bad of [
      undefined,
      null,
      {},
      { content: "x" },
      { content: [{}] },
    ]) {
      const out = extractAssistantText(bad as never);
      expect(out, JSON.stringify(bad)).toBe("");
    }
  });
});

describe("AgentStreamEvent union", () => {
  it("union_accepts_both_vocabularies_at_type_level", () => {
    const fine: AgentStreamEvent = { type: "text-delta", text: "x" };
    const coarse: AgentStreamEvent = {
      type: "tool_call",
      call_id: "1",
      name: "t",
      status: "running",
    };
    expect(fine.type).toBe("text-delta");
    expect(coarse.call_id).toBe("1");
  });
});
