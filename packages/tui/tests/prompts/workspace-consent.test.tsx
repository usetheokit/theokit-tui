import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "../renderer/itl-adapter.js";
import {
  type ReviewableHook,
  type WorkspaceConsent,
  type WorkspaceConsentDeps,
  useWorkspaceConsent,
} from "../../src/prompts/workspace-consent.js";

const hook = (fp: string): ReviewableHook => ({
  fingerprint: fp,
  event: "PreToolUse",
  command: `run ${fp}`,
  status: "new",
});

function mount(deps: WorkspaceConsentDeps) {
  const box: { current: WorkspaceConsent | undefined } = { current: undefined };
  function Probe() {
    box.current = useWorkspaceConsent(deps);
    return createElement("ink-text", {}, "x");
  }
  const app = render(createElement(Probe));
  const get = () => box.current as WorkspaceConsent;
  return { app, get };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useWorkspaceConsent", () => {
  it("trust_is_optimistic_and_stays_when_persist_resolves", async () => {
    const d = deferred();
    const { app, get } = mount({
      isTrusted: () => false,
      persistTrust: () => d.promise,
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    await app.flush();
    expect(get().trusted).toBe(false);
    const p = get().trust();
    await app.flush();
    expect(get().trusted).toBe(true);
    d.resolve();
    await p;
    await app.flush();
    expect(get().trusted).toBe(true);
    app.unmount();
  });

  it("trust_rolls_back_and_rethrows_the_same_error_when_persist_rejects", async () => {
    const boom = new Error("disk full");
    const { app, get } = mount({
      isTrusted: () => false,
      persistTrust: () => Promise.reject(boom),
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    await app.flush();
    const p = get().trust();
    await expect(p).rejects.toBe(boom);
    await app.flush();
    expect(get().trusted).toBe(false);
    app.unmount();
  });

  it("refuseHook_removes_the_hook_without_calling_approveHook", async () => {
    const approved: string[] = [];
    const { app, get } = mount({
      isTrusted: () => true,
      persistTrust: async () => {},
      listPendingHooks: () => [hook("a"), hook("b")],
      approveHook: async (fp) => {
        approved.push(fp);
      },
    });
    await app.flush();
    get().refuseHook("a");
    await app.flush();
    expect(get().pendingHooks.map((h) => h.fingerprint)).toEqual(["b"]);
    expect(approved).toEqual([]);
    app.unmount();
  });

  it("approveHook_rejecting_keeps_the_hook_pending_and_rejects", async () => {
    const boom = new Error("cannot write");
    const { app, get } = mount({
      isTrusted: () => true,
      persistTrust: async () => {},
      listPendingHooks: () => [hook("a")],
      approveHook: () => Promise.reject(boom),
    });
    await app.flush();
    await expect(get().approveHook("a")).rejects.toBe(boom);
    await app.flush();
    expect(get().pendingHooks.map((h) => h.fingerprint)).toEqual(["a"]);
    app.unmount();
  });

  it("approveHook_resolving_re_reads_the_store", async () => {
    const pending = [hook("a"), hook("b")];
    const { app, get } = mount({
      isTrusted: () => true,
      persistTrust: async () => {},
      listPendingHooks: () => [...pending],
      approveHook: async (fp) => {
        pending.splice(
          pending.findIndex((h) => h.fingerprint === fp),
          1,
        );
      },
    });
    await app.flush();
    await get().approveHook("a");
    await app.flush();
    expect(get().pendingHooks.map((h) => h.fingerprint)).toEqual(["b"]);
    app.unmount();
  });
});
