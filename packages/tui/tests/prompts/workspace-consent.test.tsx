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

  it("trust_stays_when_persist_resolves_but_isTrusted_still_reports_false", async () => {
    const { app, get } = mount({
      workspaceKey: "/w",
      isTrusted: () => false,
      persistTrust: async () => {},
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    await app.flush();
    await get().trust();
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

  it("a_late_write_for_an_earlier_visit_of_the_same_dir_does_not_touch_the_new_session", async () => {
    const first = deferred();
    const second = deferred();
    const queue = [first, second];
    const depsFor = (dir: string): WorkspaceConsentDeps => ({
      workspaceKey: dir,
      isTrusted: () => false,
      persistTrust: () => (queue.shift() as ReturnType<typeof deferred>).promise,
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    const { app, get, rerender } = mount(depsFor("/a"));
    await app.flush();
    const p1 = get().trust();
    rerender(depsFor("/b"));
    await app.flush();
    rerender(depsFor("/a"));
    await app.flush();
    const p2 = get().trust();
    await app.flush();
    expect(get().trusted).toBe(true);
    first.reject(new Error("old"));
    await expect(p1).rejects.toThrow("old");
    await app.flush();
    expect(get().trusted).toBe(true); // the old failure must not roll back the new optimistic trust
    second.resolve();
    await p2;
    app.unmount();
  });

  it("a_retained_trust_callback_persists_through_its_own_workspace_deps", async () => {
    const persisted: string[] = [];
    const depsFor = (dir: string): WorkspaceConsentDeps => ({
      workspaceKey: dir,
      isTrusted: () => false,
      persistTrust: async () => void persisted.push(dir),
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    const { app, get, rerender } = mount(depsFor("/a"));
    await app.flush();
    const trustA = get().trust;
    rerender(depsFor("/b"));
    await app.flush();
    await trustA();
    await app.flush();
    expect(persisted).toEqual(["/a"]);
    expect(get().trusted).toBe(false);
    app.unmount();
  });

  it("trust_uses_the_latest_persistTrust_of_the_current_session", async () => {
    const calls: string[] = [];
    const base = {
      workspaceKey: "/w",
      isTrusted: () => false,
      listPendingHooks: () => [],
      approveHook: async () => {},
    };
    const { app, get, rerender } = mount({
      ...base,
      persistTrust: async () => void calls.push("old"),
    });
    await app.flush();
    rerender({ ...base, persistTrust: async () => void calls.push("new") });
    await app.flush();
    await get().trust();
    expect(calls).toEqual(["new"]);
    app.unmount();
  });

  it("a_retained_approveHook_stays_bound_to_its_own_workspace", async () => {
    const approved: string[] = [];
    const mk = (key: string) => ({
      workspaceKey: key,
      isTrusted: () => true,
      persistTrust: async () => {},
      listPendingHooks: () => [],
      approveHook: async (fp: string) => void approved.push(`${key}:${fp}`),
    });
    const { app, get, rerender } = mount(mk("/a"));
    await app.flush();
    const retained = get().approveHook;
    rerender(mk("/b"));
    await app.flush();
    await retained("h1");
    expect(approved).toEqual(["/a:h1"]);
    app.unmount();
  });

  it("concurrent_trust_calls_share_one_save_and_one_outcome", async () => {
    const d = deferred();
    let n = 0;
    const { app, get } = mount({
      workspaceKey: "/w",
      isTrusted: () => false,
      persistTrust: async () => {
        n++;
        await d.promise;
      },
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    await app.flush();
    const p1 = get().trust();
    const p2 = get().trust();
    const err = new Error("disk");
    d.reject(err);
    await expect(p1).rejects.toBe(err);
    await expect(p2).rejects.toBe(err);
    await app.flush();
    expect(n).toBe(1);
    expect(get().trusted).toBe(false);
    app.unmount();
  });

  it("trust_can_be_retried_after_a_failed_save", async () => {
    let n = 0;
    let saved = false;
    const { app, get } = mount({
      workspaceKey: "/w",
      isTrusted: () => saved,
      persistTrust: async () => {
        if (n++ === 0) throw new Error("first");
        saved = true;
      },
      listPendingHooks: () => [],
      approveHook: async () => {},
    });
    await app.flush();
    await expect(get().trust()).rejects.toThrow("first");
    await get().trust();
    await app.flush();
    expect(get().trusted).toBe(true);
    app.unmount();
  });
});
