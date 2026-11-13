import { describe, expect, it } from "vitest";

import type { AgentEvent } from "../../src/agent/agent-event.js";
import { agentEventsToMarkdown, lastAssistantText } from "../../src/agent/events-to-markdown.js";

const msg = (id: string, role: "user" | "assistant" | "system", text: string): AgentEvent => ({
  id,
  kind: "message",
  role,
  text,
});

describe("agentEventsToMarkdown", () => {
  it("writes a heading per message", () => {
    const events = [msg("1", "user", "hi"), msg("2", "assistant", "hello")];
    expect(agentEventsToMarkdown(events)).toBe("## You\n\nhi\n\n## Assistant\n\nhello");
  });

  it("uses roleHeadings, then the system default", () => {
    const events = [msg("1", "assistant", "hello"), msg("2", "system", "s")];
    expect(agentEventsToMarkdown(events, { roleHeadings: { assistant: "Theo" } })).toBe(
      "## Theo\n\nhello\n\n## System\n\ns",
    );
  });

  it("uses an unknown role as its own heading", () => {
    const events = [
      { id: "1", kind: "message", role: "tool", text: "x" },
    ] as unknown as AgentEvent[];
    expect(agentEventsToMarkdown(events)).toBe("## tool\n\nx");
  });

  it("leaves out empty messages and thinking events", () => {
    const events: AgentEvent[] = [
      msg("1", "user", "hi"),
      msg("2", "assistant", "  "),
      { id: "3", kind: "thinking", text: "hmm" },
    ];
    expect(agentEventsToMarkdown(events)).toBe("## You\n\nhi");
  });

  it("adds tool lines only with includeTools", () => {
    const events: AgentEvent[] = [
      msg("1", "user", "hi"),
      { id: "2", kind: "tool", name: "read", status: "success", summary: "a.ts" } as AgentEvent,
      { id: "3", kind: "tool", name: "bash", status: "success" } as AgentEvent,
    ];
    expect(agentEventsToMarkdown(events)).toBe("## You\n\nhi");
    expect(agentEventsToMarkdown(events, { includeTools: true })).toBe(
      "## You\n\nhi\n\n`read` a.ts\n\n`bash`",
    );
  });

  it("skips malformed entries without throwing", () => {
    const events = [
      null,
      42,
      { kind: "message", role: 1 },
      { kind: "message", role: "user", text: 5 },
      { kind: "tool" },
      msg("1", "user", "ok"),
    ] as unknown as AgentEvent[];
    expect(() => agentEventsToMarkdown(events, { includeTools: true })).not.toThrow();
    expect(agentEventsToMarkdown(events, { includeTools: true })).toBe("## You\n\nok");
    expect(agentEventsToMarkdown(undefined as unknown as AgentEvent[])).toBe("");
  });
});

describe("lastAssistantText", () => {
  it("returns the newest non-empty assistant text", () => {
    const events = [
      msg("1", "assistant", "first"),
      msg("2", "assistant", "last"),
      msg("3", "assistant", ""),
      msg("4", "user", "u"),
    ];
    expect(lastAssistantText(events)).toBe("last");
  });

  it("returns undefined when there is none", () => {
    expect(lastAssistantText([msg("1", "user", "u")])).toBeUndefined();
    expect(lastAssistantText([null, 1] as unknown as AgentEvent[])).toBeUndefined();
    expect(lastAssistantText(undefined as unknown as AgentEvent[])).toBeUndefined();
  });
});
