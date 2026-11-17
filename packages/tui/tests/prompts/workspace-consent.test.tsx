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
  function Probe({ d }: { d: WorkspaceConsentDeps }) {
    box.current = useWorkspaceConsent(d);
    return createElement("ink-text", {}, "x");
  }
  const app = render(createElement(Probe, { d: deps }));
  const get = () => box.current as WorkspaceConsent;
  const rerender = (d: WorkspaceConsentDeps) => app.rerender(createElement(Probe, { d }));
  return { app, get, rerender };
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
    let saved = false;
    const { app, get } = mount({
      workspaceKey: "/w",
      isTrusted: () => saved,
      persistTrust: async () => {
        await d.promise;
        saved = true;
      },
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
      workspaceKey: "/w",
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
      workspaceKey: "/w",
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
      workspaceKey: "/w",
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
      workspaceKey: "/w",
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

  it("a_rerender_with_new_hooks_refreshes_pendingHooks", async () => {
    const base = {
      workspaceKey: "/w",
      isTrusted: () => true,
      persistTrust: async () => {},
      approveHook: async () => {},
    };
    const { app, get, rerender } = mount({ ...base, listPendingHooks: () => [] });
    await app.flush();
    expect(get().pendingHooks).toEqual([]);
    rerender({ ...base, listPendingHooks: () => [hook("late")] });
    await app.flush();
    expect(get().pendingHooks.map((h) => h.fingerprint)).toEqual(["late"]);
    app.unmount();
  });

  it("switching_workspace_drops_the_previous_trust_and_refusals", async () => {
    const trustedDirs = new Set(["/a"]);
    const depsFor = (dir: string): WorkspaceConsentDeps => ({
      workspaceKey: dir,
      isTrusted: () => trustedDirs.has(dir),
      persistTrust: async () => void trustedDirs.add(dir),
      listPendingHooks: () => [hook("h")],
      approveHook: async () => {},
    });
    const { app, get, rerender } = mount(depsFor("/b"));
    await app.flush();
    await get().trust();
    get().refuseHook("h");
    await app.flush();
    expect(get().trusted).toBe(true);
    expect(get().pendingHooks).toEqual([]);
    rerender(depsFor("/c"));
    await app.flush();
    expect(get().trusted).toBe(false);
    expect(get().pendingHooks.map((h) => h.fingerprint)).toEqual(["h"]);
    app.unmount();
  });

  it("switching_workspace_while_trust_is_pending_shows_the_prompt_for_the_new_dir", async () => {
    const d = deferred();
    const trustedDirs = new Set<string>();
    const depsFor = (dir: string): WorkspaceConsentDeps => ({
      workspaceKey: dir,
      isTrusted: () => trustedDirs.has(dir),
      persistTrust: async () => {
        await d.promise;
        trustedDirs.add(dir);
      },
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    const { app, get, rerender } = mount(depsFor("/a"));
    await app.flush();
    const p = get().trust();
    await app.flush();
    expect(get().trusted).toBe(true);
    rerender(depsFor("/b"));
    await app.flush();
    expect(get().trusted).toBe(false);
    d.resolve();
    await p;
    await app.flush();
    expect(get().trusted).toBe(false);
    app.unmount();
  });

  it("a_failed_write_for_a_previous_dir_does_not_touch_the_new_dir", async () => {
    const d = deferred();
    const depsFor = (dir: string): WorkspaceConsentDeps => ({
      workspaceKey: dir,
      isTrusted: () => dir === "/b",
      persistTrust: () => d.promise,
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    const { app, get, rerender } = mount(depsFor("/a"));
    await app.flush();
    const p = get().trust();
    rerender(depsFor("/b"));
    await app.flush();
    d.reject(new Error("x"));
    await expect(p).rejects.toThrow("x");
    await app.flush();
    expect(get().trusted).toBe(true);
    app.unmount();
  });
});
