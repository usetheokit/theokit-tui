import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type {
  InteractionUpdate,
  SDKAssistantMessage,
  SDKMessage,
  SDKStatusMessage,
  SDKThinkingMessage,
  SDKToolUseMessage,
} from "@theokit/sdk";

import type { AgentStreamEvent } from "../src/agent-stream-event.js";
import {
  agentStreamReducer,
  initialAgentStreamState,
} from "../src/agent-stream-reducer.js";

// T3.1 (plan m7-stream-adapter, ADR D3): the drift tripwire. @theokit/sdk is
// an import-type-only devDependency — runtime-erased, consumed ONLY here.
// The tripwire contract: when a new sdk minor renames/retypes a stream field,
// `pnpm typecheck` FAILS on the assignment below NAMING the drifted member —
// at install time, not in production. The theo-ui mirror drifts today
// precisely because it lacks this check (tsc-proven in the blueprint).

describe("sdk drift tripwire (D3)", () => {
  it("sdk_types_assignable_to_structural_union", () => {
    // _typecheck only: the assertion IS the compile. Whole union first (the
    // strongest check — it fails if ANY member drifts), then per-member
    // diagnostics so a failure names the culprit directly.
    const _all: AgentStreamEvent = {} as SDKMessage;
    const _assistant: AgentStreamEvent = {} as SDKAssistantMessage;
    const _thinking: AgentStreamEvent = {} as SDKThinkingMessage;
    const _toolUse: AgentStreamEvent = {} as SDKToolUseMessage;
    // The whole-union blocker the mirror never fixed: SDKStatusMessage's
    // `message?: string` arm — our union widens `message` to accept it.
    const _status: AgentStreamEvent = {} as SDKStatusMessage;
    // The fine vocabulary (onDelta's {update} payloads) under REAL names —
    // "text-delta" hyphenated, never the mirror's fictional "text_delta".
    const _update: AgentStreamEvent = {} as InteractionUpdate;
    const witnesses = [_all, _assistant, _thinking, _toolUse, _status, _update];
    expect(witnesses).toHaveLength(6);
  });

  it("canonical_sdk_script_folds_to_expected_state", () => {
    // Value-level drift the types cannot catch: a canonical script shaped
    // EXACTLY like the SDK builders construct events (agent_id/run_id
    // present, coarse vocabulary), folded through the real reducer.
    const script: AgentStreamEvent[] = [
      { type: "system", message: "boot" } as AgentStreamEvent,
      { type: "user", message: { content: [{ type: "text", text: "hi" }] } },
      { type: "thinking", text: "planning the answer" },
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "running it" }, { type: "tool_use" }],
        },
      },
      {
        type: "tool_call",
        call_id: "call_1",
        name: "shell",
        status: "running",
        args: { command: "echo ok" },
      },
      {
        type: "tool_call",
        call_id: "call_1",
        name: "shell",
        status: "completed",
        result: { stdout: "ok", stderr: "", exitCode: 0 },
      },
      { type: "done" },
    ];
    const final = script.reduce(agentStreamReducer, initialAgentStreamState);
    expect(final.status).toBe("done");
    expect(final.streaming.active).toBe(false);
    const thinking = final.events.find((event) => event.kind === "thinking");
    expect(thinking).toMatchObject({ text: "planning the answer" });
    const message = final.events.find((event) => event.kind === "message");
    expect(message).toMatchObject({ role: "assistant", text: "running it" });
    const tool = final.events.find((event) => event.id === "tool-call_1");
    expect(tool).toMatchObject({
      name: "shell",
      status: "success",
      shell: { stdout: "ok", exitCode: 0 },
    });
    expect(tool).not.toHaveProperty("output");
  });

  it("manifest_keeps_sdk_out_of_runtime_graph", () => {
    // The coupling discipline (deps-audit 2026-07-07): the sdk exists ONLY
    // as a devDependency — consumers never inherit it.
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    // M17 added react-reconciler; M18 added yoga-layout + Ink's text libs
    // (wrap/truncate/width/tokenize) to the runtime graph — the renderer's
    // layout + measurement engine. The sdk stays devDependency-only.
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "@alcalzone/ansi-tokenize",
      "chalk",
      "cli-boxes",
      "cli-truncate",
      "diff",
      "ignore",
      "ink",
      "ink-spinner",
      "parse-diff",
      "react-reconciler",
      "string-width",
      "widest-line",
      "wrap-ansi",
      "yoga-layout",
    ]);
    expect(pkg.peerDependencies).not.toHaveProperty("@theokit/sdk");
    expect(pkg.devDependencies["@theokit/sdk"]).toMatch(/^\^2\./);
  });
});
