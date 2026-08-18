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
    // (`context-window-bar.test.tsx:261`). Rendering it through `renderFrame` would NOT work: that
    // helper wraps `ink-testing-library`, which resolves with an empty frame instead of rejecting.
    // That is the HARNESS, not production — a real `render()` prints ink's ERROR panel and exits
    // (B-031). T3.1 asserts the production path with a real render.
    expect(() => UsagePanel({ usage: minimalTurn, contextWindow: 0 })).toThrow(
      TypeError,
    );
    expect(() => UsagePanel({ usage: minimalTurn, contextWindow: 0 })).toThrow(
      "UsagePanel: contextWindow must be a finite number > 0 when given",
    );
  });

  // B-025 T1.4 / ADR D2 — the composite validates what it FORWARDS.
  //
  // `src/agent/agent-timeline.tsx:62` established the reasoning: validation belongs at the
  // composition boundary, so the message names the component the caller actually wrote. This
  // panel guarded `contextWindow` and stopped there — so a bad `inputTokens` failed from inside
  // `ContextWindowBar` and a bad `cost` from inside `CostMeter`, both naming a component the
  // caller never mentioned. Its own ADR D3 argued for this and the argument was not applied.
  //
  // Scope is exactly what the panel passes on: inputTokens, outputTokens, and the optional
  // cacheReadTokens / reasoningTokens / cost. `totalTokens`, `cacheWriteTokens` and `durationMs`
  // are NOT forwarded and are NOT validated here — guarding a field it does not use would be the
  // composite claiming authority over data it never touches.
  it("a_non_finite_input_token_count_is_refused_by_the_panel_itself", () => {
    expect(() =>
      UsagePanel({ usage: { ...minimalTurn, inputTokens: Number.NaN } }),
    ).toThrow(TypeError);
    expect(() =>
      UsagePanel({ usage: { ...minimalTurn, inputTokens: Number.NaN } }),
    ).toThrow("UsagePanel: usage.inputTokens");
  });

  it("a_non_finite_cost_is_refused_by_the_panel_itself", () => {
    // Measured in the B-025 probe: NaN reaches CostMeter and blanks the whole panel — the
    // sections that were fine vanish with the one that was not. Validating only inputTokens was
    // rejected in ADR D2 for exactly this.
    expect(() =>
      UsagePanel({ usage: { ...minimalTurn, cost: Number.NaN } }),
    ).toThrow("UsagePanel: usage.cost");
  });

  it("a_negative_optional_token_count_is_refused_by_the_panel_itself", () => {
    expect(() =>
      UsagePanel({ usage: { ...minimalTurn, cacheReadTokens: -1 } }),
    ).toThrow("UsagePanel: usage.cacheReadTokens");
    expect(() =>
      UsagePanel({ usage: { ...minimalTurn, reasoningTokens: -1 } }),
    ).toThrow("UsagePanel: usage.reasoningTokens");
  });

  it("a_non_finite_output_token_count_is_refused_by_the_panel_itself", () => {
    // `/review` (F-xval-1) found the surviving mutant on the one ADR this slice exists to satisfy:
    // `outputTokens` was IN `FORWARDED_USAGE_FIELDS` and exercised by no test, so deleting it from
    // the list killed nothing. It is forwarded (`tokenCategories` -> `TokenUsageChart`), so a NaN
    // there reproduces the D2 failure mode exactly like `inputTokens` does.
    expect(() =>
      UsagePanel({ usage: { ...minimalTurn, outputTokens: Number.NaN } }),
    ).toThrow("UsagePanel: usage.outputTokens");
  });

  it("the_error_names_UsagePanel_not_a_child", () => {
    let message = "";
    try {
      UsagePanel({ usage: { ...minimalTurn, inputTokens: Number.NaN } });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("UsagePanel");
    // The whole point of the ADR: not ContextWindowBar, which the caller never wrote.
    expect(message).not.toContain("ContextWindowBar");
    // And the offending value, per error-handling.md § 5.
    expect(message).toContain("NaN");
  });

  it("a_turn_that_omits_the_optional_fields_still_renders", async () => {
    // The guard must not turn ABSENT into invalid. `TurnUsage` marks these optional and ADR D2 of
    // B-001 says absent stays absent; a guard that rejected `undefined` would break every turn an
    // agent reports without a cache read.
    const plain = stripAnsi(await renderFrame(<UsagePanel usage={minimalTurn} />));
    expect(plain).toContain("input");
  });

  it("a_present_zero_is_a_measurement_and_is_accepted", async () => {
    // 0 is a reported value, not a missing one. Rejecting it would discard a real measurement.
    const plain = stripAnsi(
      await renderFrame(
        <UsagePanel usage={{ ...minimalTurn, cacheReadTokens: 0, cost: 0 }} />,
      ),
    );
    expect(plain).toContain("cached");
  });

  // TA-1 (review) — every sibling meter pins its rendering in __snapshots__; this one pinned only
  // substrings, so the composed LAYOUT — the thing the component exists to produce — was asserted
  // by nothing. Two snapshots: the full turn and the minimal one, because the difference between
  // them IS ADR D2.
  it("full_turn_layout", async () => {
    expect(
      stripAnsi(
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
      ),
    ).toMatchSnapshot("usage-panel-full-turn");
  });

  it("minimal_turn_layout_omits_what_was_not_reported", async () => {
    expect(
      stripAnsi(
        await renderFrame(
          <UsagePanel usage={minimalTurn} contextWindow={128_000} />,
        ),
      ),
    ).toMatchSnapshot("usage-panel-minimal-turn");
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
