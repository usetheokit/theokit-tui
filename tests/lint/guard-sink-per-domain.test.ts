/**
 * B-028 — the guard sink is REACHED, per domain, not merely imported.
 *
 * `render-guards-report.test.ts` checks that each component file imports the sink. That is a real
 * gate and it has a real hole, stated rather than implied: a file can import the sink and still
 * leave one throw bare. These tests close the hole per domain by driving a guard and asserting a
 * record actually arrives.
 *
 * Per DOMAIN and not one global test, because the failure being prevented is per call-site: a
 * global test goes green as soon as ANY component reports, which is exactly the state B-025 left
 * the package in — one wired consumer and 20 silent files that looked covered.
 *
 * Each case asserts BOTH halves of `rules/error-handling.md` § 3.1: the record arrives AND the
 * error still propagates. Dropping either would break the contract 37 `toThrow` assertions rest on.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentTimeline } from "../../src/agent/agent-timeline.js";
import { WelcomeBanner } from "../../src/branding/welcome-banner.js";
import { ChatMessage } from "../../src/chat/chat-message.js";
import { DiffViewer } from "../../src/diff/diff-viewer.js";
import { CodeBlock } from "../../src/markdown/code-block.js";
import { ProgressBar } from "../../src/metrics/progress-bar.js";
import { WindowedList } from "../../src/prompts/windowed-list.js";
import { createFrameBudget } from "../../src/renderer/frame-budget.js";
import { Notice } from "../../src/status/notice.js";
import { TodoList } from "../../src/status/todo-list.js";
import { TheoTUIProvider } from "../../src/theme/theme.js";
import { ToolCall } from "../../src/tools/tool-call.js";

let records: string[] = [];
let realWrite: typeof process.stderr.write;

beforeEach(() => {
  records = [];
  realWrite = process.stderr.write;
  process.stderr.write = ((chunk: unknown): boolean => {
    const text = typeof chunk === "string" ? chunk : String(chunk);
    if (text.includes("[theokit/tui]")) {
      records.push(text);
      return true;
    }
    return realWrite.call(process.stderr, chunk as string);
  }) as typeof process.stderr.write;
});

afterEach(() => {
  process.stderr.write = realWrite;
});

/**
 * Components are called as plain functions, which is how this package tests boundary guards:
 * a guard sits above the first hook precisely so it is reachable this way, and rendering through
 * `ink-testing-library` resolves with an empty frame instead of rejecting.
 */
function expectRecorded(component: string, invoke: () => unknown): void {
  expect(invoke).toThrow(TypeError);
  expect(records.join("")).toContain(component);
}

describe("the guard sink is reached in every domain", () => {
  it("agent", () => {
    expectRecorded("AgentTimeline", () =>
      AgentTimeline({
        events: [{ kind: "message", role: "not-a-role", text: "x" }] as never,
      }),
    );
  });

  it("branding", () => {
    expectRecorded("WelcomeBanner", () =>
      WelcomeBanner({ name: "   " } as never),
    );
  });

  it("chat", () => {
    expectRecorded("ChatMessage", () =>
      ChatMessage({ role: "not-a-role" as never, children: "x" }),
    );
  });

  it("diff", () => {
    expectRecorded("DiffViewer", () =>
      DiffViewer({ patch: "", maxLines: 0 } as never),
    );
  });

  it("markdown", () => {
    expectRecorded("CodeBlock", () =>
      CodeBlock({ code: "x", maxLines: 0 } as never),
    );
  });

  it("metrics", () => {
    expectRecorded("ProgressBar", () => ProgressBar({ percent: Number.NaN }));
  });

  it("prompts", () => {
    expectRecorded("WindowedList", () =>
      WindowedList({ items: ["a"], window: 0 } as never),
    );
  });

  it("status", () => {
    expectRecorded("Notice", () =>
      Notice({ variant: "not-a-variant" as never, children: "x" }),
    );
  });

  it("status — a second call site in the same domain", () => {
    // TodoList's guard is a loop-body duplicate check, a different SHAPE from Notice's union check.
    // One per domain is the floor, not the ceiling, where the shapes genuinely differ.
    expectRecorded("TodoList", () =>
      TodoList({
        items: [
          { id: "a", text: "x" },
          { id: "a", text: "y" },
        ],
      } as never),
    );
  });

  it("theme", () => {
    expectRecorded("TheoTUIProvider", () =>
      TheoTUIProvider({
        theme: "not-a-builtin" as never,
        children: "x" as never,
      }),
    );
  });

  it("tools", () => {
    expectRecorded("ToolCall", () =>
      ToolCall({ name: "x", status: "not-a-status" as never }),
    );
  });

  it("renderer", () => {
    // B-075 — the first guard in this domain. `createFrameBudget` is a factory rather than a
    // component, so it is called directly; the F10 idiom that makes components reachable as
    // plain functions is unnecessary here.
    expectRecorded("createFrameBudget", () =>
      createFrameBudget({ frameBudgetMs: Number.NaN }),
    );
  });
});
