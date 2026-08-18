import { describe, expect, it } from "vitest";

import type { TurnUsage } from "../agent/messages-to-events.js";
import { renderFrame } from "../../tests/fixtures/helpers.js";
import { UsagePanel } from "./usage-panel.js";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001B\[[0-9;]*m/g;
const stripAnsi = (value: string): string => value.replace(ANSI_RE, "");

/** The minimum a turn always reports. Optional fields are added per test, never by default —
 *  the whole point of D2 is that absent stays absent. */
const minimalTurn: TurnUsage = {
  inputTokens: 12_000,
  outputTokens: 3_000,
  totalTokens: 15_000,
};

// B-001 (plan b001-usage-panel, ADRs D1/D2/D3): the composed usage panel.
describe("UsagePanel", () => {
  it("renders_only_the_categories_the_turn_reported", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <UsagePanel usage={minimalTurn} contextWindow={128_000} />,
      ),
    );
    expect(plain).toContain("input");
    expect(plain).toContain("output");
    // D2 — absent is absent. A row here would claim a measured zero the agent never reported.
    expect(plain).not.toContain("cached");
    expect(plain).not.toContain("reasoning");
  });

  it("omits_the_cost_meter_when_the_turn_reported_no_cost", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <UsagePanel usage={minimalTurn} contextWindow={128_000} />,
      ),
    );
    expect(plain).not.toContain("cost");
  });

  it("renders_every_category_the_turn_did_report", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <UsagePanel
          usage={{
            ...minimalTurn,
            cacheReadTokens: 800,
            reasoningTokens: 450,
            cost: 0.42,
          }}
          contextWindow={128_000}
        />,
      ),
    );
    expect(plain).toContain("cached");
    expect(plain).toContain("reasoning");
    expect(plain).toContain("cost");
  });

  it("defaults_to_context_then_tokens_then_cost", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <UsagePanel
          usage={{ ...minimalTurn, cost: 0.42 }}
          contextWindow={128_000}
        />,
      ),
    );
    expect(plain.indexOf("%")).toBeLessThan(plain.indexOf("input"));
    expect(plain.indexOf("input")).toBeLessThan(plain.indexOf("cost"));
  });

  it("renders_the_sections_in_the_order_the_caller_declared", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <UsagePanel
          usage={{ ...minimalTurn, cost: 0.42 }}
          contextWindow={128_000}
          order={["cost", "tokens", "context"]}
        />,
      ),
    );
    expect(plain.indexOf("cost")).toBeLessThan(plain.indexOf("input"));
    expect(plain.indexOf("input")).toBeLessThan(plain.indexOf("%"));
  });

  // D3 / EC-2 — `ContextWindowBar` THROWS on a non-positive limit, and a throw in render ends the
  // Ink session. `TurnUsage` carries no window, so a consumer whose model declares none must be
  // able to say so. Omitting the prop degrades to the absolute count the meter already supports.
  it("renders_the_absolute_count_when_no_context_window_is_given", async () => {
    const plain = stripAnsi(
      await renderFrame(<UsagePanel usage={minimalTurn} />),
    );
    expect(plain).not.toContain("%");
    expect(plain).toContain("input");
  });

  // D3, the other half — the guard above keeps an ABSENT window from crashing; an explicit
  // non-positive one is a programming error and must still fail loudly (error-handling.md § 2).
  // Nothing asserted this until a mutation run showed the omission: removing the guard leaves the
  // suite green, because `tsc` — not vitest — is what catches it (TS2375 under
  // exactOptionalPropertyTypes). The behavioural half needed its own test.
  it("throws_a_typed_error_naming_itself_on_a_non_positive_context_window", () => {
    // Called as a function, which is how this domain tests boundary guards
    // (`context-window-bar.test.tsx:261`). Rendering it would NOT work: React catches a throw
    // during render, so `renderFrame` resolves with an empty frame instead of rejecting —
    // measured, not assumed, and the reason the first draft of this test was wrong.
    expect(() => UsagePanel({ usage: minimalTurn, contextWindow: 0 })).toThrow(
      TypeError,
    );
    expect(() => UsagePanel({ usage: minimalTurn, contextWindow: 0 })).toThrow(
      "UsagePanel: contextWindow must be a finite number > 0 when given",
    );
  });

  // EC-3 — disabling every section yields silence, not an empty frame.
  it("renders_nothing_when_every_section_is_disabled", async () => {
    const plain = stripAnsi(
      await renderFrame(
        <UsagePanel usage={minimalTurn} contextWindow={128_000} order={[]} />,
      ),
    );
    expect(plain.trim()).toBe("");
  });
});
