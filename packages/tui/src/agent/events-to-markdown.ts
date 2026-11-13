import type { AgentEvent } from "./agent-event.js";

export interface AgentEventsToMarkdownOptions {
  /** Heading per role. Defaults: user "You", assistant "Assistant", system "System". */
  roleHeadings?: Readonly<Record<string, string>>;
  /** Include tool calls as a line "`<name>` <summary>". Default false. */
  includeTools?: boolean;
}

const DEFAULT_HEADINGS: Readonly<Record<string, string>> = {
  user: "You",
  assistant: "Assistant",
  system: "System",
};

interface TextMessage {
  role: string;
  text: string;
}

// Entries are narrowed as `unknown`: a malformed one is skipped, never thrown on.
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asMessage(value: unknown): TextMessage | undefined {
  const e = asRecord(value);
  if (e === undefined || e.kind !== "message") return undefined;
  if (typeof e.role !== "string" || typeof e.text !== "string") return undefined;
  if (e.text.trim() === "") return undefined;
  return { role: e.role, text: e.text };
}

function toolLine(value: unknown): string | undefined {
  const e = asRecord(value);
  if (e === undefined || e.kind !== "tool" || typeof e.name !== "string") return undefined;
  return typeof e.summary === "string" && e.summary !== ""
    ? `\`${e.name}\` ${e.summary}`
    : `\`${e.name}\``;
}

/** Render the conversation as Markdown: one `## <heading>` section per message. */
export function agentEventsToMarkdown(
  events: readonly AgentEvent[],
  opts: AgentEventsToMarkdownOptions = {},
): string {
  if (!Array.isArray(events)) return "";
  const headings = opts.roleHeadings ?? {};
  const blocks: string[] = [];
  for (const event of events as readonly unknown[]) {
    const message = asMessage(event);
    if (message !== undefined) {
      const heading = headings[message.role] ?? DEFAULT_HEADINGS[message.role] ?? message.role;
      blocks.push(`## ${heading}\n\n${message.text}`);
      continue;
    }
    if (opts.includeTools === true) {
      const line = toolLine(event);
      if (line !== undefined) blocks.push(line);
    }
  }
  return blocks.join("\n\n");
}

/** The newest non-empty assistant message text, or `undefined` when there is none. */
export function lastAssistantText(events: readonly AgentEvent[]): string | undefined {
  if (!Array.isArray(events)) return undefined;
  for (let i = events.length - 1; i >= 0; i--) {
    const message = asMessage(events[i]);
    if (message?.role === "assistant") return message.text;
  }
  return undefined;
}
