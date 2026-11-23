import { Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type { AgentSessionCommand } from "../../src/agent/agent-session.js";
import { AgentSession } from "../../src/agent/agent-session.js";
import type { AgentStreamEvent } from "../../src/agent/agent-stream-event.js";

// A scripted agent: each turn is a gate the test opens, so "streaming" is a state the test holds.
function scriptedAgent() {
  const sent: string[] = [];
  const aborted: boolean[] = [];
  const gates: Array<(events: AgentStreamEvent[]) => void> = [];
  const stream = (message: string, signal: AbortSignal) => {
    sent.push(message);
    const index = aborted.push(false) - 1;
    signal.addEventListener("abort", () => {
      aborted[index] = true;
    });
    return {
      [Symbol.asyncIterator]() {
        let pending: Promise<AgentStreamEvent[]> | undefined;
        let delivered = false;
        return {
          next: async (): Promise<IteratorResult<AgentStreamEvent>> => {
            if (delivered) {
              return { done: true, value: undefined };
            }
            pending ??= new Promise((resolve) => gates.push(resolve));
            const events = await pending;
            const [first] = events;
            delivered = true;
            return first === undefined
              ? { done: true, value: undefined }
              : { done: false, value: first };
          },
          return: async (): Promise<IteratorResult<AgentStreamEvent>> => ({
            done: true,
            value: undefined,
          }),
        };
      },
    };
  };
  return {
    stream,
    sent,
    aborted,
    finishTurn: (text: string) => gates.shift()?.([{ type: "text-delta", text }]),
  };
}

type App = ReturnType<typeof render>;

// Focus lands in mount effects and a lone ESC is held briefly by the input parser: wait by time.
async function settle(_app?: App) {
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

async function type(app: App, text: string) {
  app.stdin.write(text);
  await settle(app);
  app.stdin.write("\r");
  await settle(app);
}

describe("AgentSession", () => {
  it("shows_a_sent_message_and_the_reply_in_the_transcript", async () => {
    const agent = scriptedAgent();
    const app = render(<AgentSession stream={agent.stream} />);
    await settle(app);
    await type(app, "hello agent");
    expect(app.lastFrame()).toContain("hello agent");
    agent.finishTurn("hi human");
    await settle(app);
    expect(app.lastFrame()).toContain("hi human");
    app.unmount();
  });

  it("esc_interrupts_a_running_turn", async () => {
    const agent = scriptedAgent();
    const app = render(<AgentSession stream={agent.stream} />);
    await settle(app);
    await type(app, "go");
    app.stdin.write("\x1b");
    await settle(app);
    expect(agent.aborted).toEqual([true]);
    expect(app.lastFrame()).toContain("Interrupted by user");
    app.unmount();
  });

  it("sends_a_message_typed_during_streaming_after_the_turn_ends", async () => {
    const agent = scriptedAgent();
    const app = render(<AgentSession stream={agent.stream} />);
    await settle(app);
    await type(app, "first");
    await type(app, "second");
    expect(agent.sent).toEqual(["first"]);
    expect(app.lastFrame()).toContain("1 queued");
    agent.finishTurn("one");
    await settle(app);
    expect(agent.sent).toEqual(["first", "second"]);
    agent.finishTurn("two");
    await settle(app);
    expect(app.lastFrame()).toContain("second");
    expect(app.lastFrame()).toContain("two");
    app.unmount();
  });

  it("runs_a_slash_command_from_the_registry_without_sending_it", async () => {
    const agent = scriptedAgent();
    const ran: string[] = [];
    const commands: AgentSessionCommand[] = [
      { name: "note", description: "take a note", run: (args) => ran.push(args) },
    ];
    const app = render(<AgentSession stream={agent.stream} commands={commands} />);
    await settle(app);
    await type(app, "/note remember this");
    expect(ran).toEqual(["remember this"]);
    expect(agent.sent).toEqual([]);
    app.unmount();
  });

  it("render_override_replaces_the_default_item_and_footer", async () => {
    const agent = scriptedAgent();
    const renderItem = (event: { kind: string }) => <Text>{`ITEM:${event.kind}`}</Text>;
    const app = render(
      <AgentSession
        stream={agent.stream}
        renderItem={renderItem}
        renderFooter={({ running }) => <Text>{running ? "FOOT:running" : "FOOT:idle"}</Text>}
      />,
    );
    await settle(app);
    expect(app.lastFrame()).toContain("FOOT:idle");
    await type(app, "override me");
    expect(app.lastFrame()).toContain("ITEM:message");
    expect(app.lastFrame()).not.toContain("override me");
    expect(app.lastFrame()).toContain("FOOT:running");
    app.unmount();
  });
});
