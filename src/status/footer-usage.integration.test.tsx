import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { AppStatusBar } from "./app-status-bar.js";
import {
  readTurnUsage,
  type UIMessageLike,
} from "../agent/messages-to-events.js";
import { stripAnsi } from "../format/ansi.js";

// eslint-disable-next-line no-control-regex

/**
 * Reproduces the EXACT footer wiring the scaffolded `tui/App.tsx` uses (create-theokit templates): read
 * each thread message's per-turn usage via `readTurnUsage`, render the last turn's input tokens against the
 * model's context window + the session cost through `AppStatusBar`. This is the deterministic render proof
 * of the composition a live LLM turn drives — the seam only works end-to-end if usage lands on
 * `message.metadata` (proven in theo's consume-ui-message-stream boundary test) AND the App reads it here.
 */
function Footer({
  thread,
  contextWindow,
}: {
  thread: readonly UIMessageLike[];
  contextWindow: number;
}): React.ReactElement {
  const usages = thread.map(readTurnUsage).filter((u) => u !== undefined);
  const lastUsage = usages.at(-1);
  const sessionCost = usages.reduce((sum, u) => sum + (u.cost ?? 0), 0);
  const tokens = lastUsage
    ? { used: lastUsage.inputTokens, limit: contextWindow }
    : undefined;
  return (
    <AppStatusBar
      model="gpt-4o-mini"
      tokens={tokens}
      cost={sessionCost > 0 ? sessionCost : undefined}
      state="idle"
    />
  );
}

const turn = (id: string, metadata: unknown): UIMessageLike => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text: "…" }],
  metadata,
});

describe("scaffold TUI footer — usage wiring (Front 1 render proof)", () => {
  it("shows context tokens (last-turn input / window) + summed session cost after turns report usage", () => {
    const thread: UIMessageLike[] = [
      {
        id: "greeting",
        role: "assistant",
        parts: [{ type: "text", text: "hi" }],
      },
      { id: "u1", role: "user", parts: [{ type: "text", text: "q1" }] },
      turn("a1", {
        usage: { inputTokens: 8000, outputTokens: 120, totalTokens: 8120 },
        cost: 0.0012,
        durationMs: 900,
      }),
      { id: "u2", role: "user", parts: [{ type: "text", text: "q2" }] },
      turn("a2", {
        usage: { inputTokens: 12300, outputTokens: 200, totalTokens: 12500 },
        cost: 0.0009,
        durationMs: 1100,
      }),
    ];
    const frame = stripAnsi(
      render(<Footer thread={thread} contextWindow={128_000} />).lastFrame() ??
        "",
    );
    // Context window = the LAST turn's input tokens (12.3k) over the model window (128k).
    expect(frame).toContain("12.3k/128k");
    // Session cost = 0.0012 + 0.0009 = 0.0021 → CostMeter renders a sub-cent approx with `$`.
    expect(frame).toContain("$");
    expect(frame).toContain("cost");
    expect(frame).toContain("idle");
  });

  it("omits tokens + cost before any turn reports usage (only greeting/user turns)", () => {
    const thread: UIMessageLike[] = [
      {
        id: "greeting",
        role: "assistant",
        parts: [{ type: "text", text: "hi" }],
      },
      { id: "u1", role: "user", parts: [{ type: "text", text: "q1" }] },
    ];
    const frame = stripAnsi(
      render(<Footer thread={thread} contextWindow={128_000} />).lastFrame() ??
        "",
    );
    expect(frame).not.toContain("/128k");
    expect(frame).not.toContain("$");
    expect(frame).toContain("gpt-4o-mini");
    expect(frame).toContain("idle");
  });
});
