import { useCallback, useRef, useState } from "react";

// useWorkspaceConsent — the UI-side state for the two gates an agent opening a repository it did
// not write must pass: trust the directory, then review each project hook before it runs. The
// stores (`TrustStore`, `HookApprovalStore`, …) come in as plain functions, so this package
// imports neither `@theokit/agents` nor `@theokit/sdk`.

/** A project hook waiting for the user's decision. */
export interface ReviewableHook {
  fingerprint: string;
  event: string;
  command: string;
  status: "new" | "modified";
  /** For a `modified` hook: the command that was approved before. */
  previousCommand?: string;
}

export interface WorkspaceConsentDeps {
  /**
   * The workspace directory. Optional, but pass it whenever one mounted component can be pointed
   * at another directory: each change starts a new session, dropping the optimistic trust, the
   * session refusals and any pending `trust()` result of the previous one.
   */
  workspaceKey?: string;
  /** Read on every render until `trust()` is called; after that the session keeps `true`. */
  isTrusted: () => boolean;
  persistTrust: () => Promise<void>;
  listPendingHooks: () => readonly ReviewableHook[];
  approveHook: (fingerprint: string) => Promise<void>;
}

export interface WorkspaceConsent {
  trusted: boolean;
  /** Hooks still to review; excludes hooks refused this session. */
  pendingHooks: readonly ReviewableHook[];
  /** Optimistic: applied at once, rolled back and rethrown when `persistTrust` rejects. */
  trust(): Promise<void>;
  /** The hook stays pending (and the promise rejects) when `approveHook` rejects. */
  approveHook(fingerprint: string): Promise<void>;
  /** Session-only: nothing is persisted, `approveHook` is not called. */
  refuseHook(fingerprint: string): void;
}

interface SessionState {
  /** Unique per session: a workspace switched away from and back to is a new session. */
  id: number;
  key: string | undefined;
  /** Set by `trust()` (kept once saved, `false` after a rollback); `null` means "ask `isTrusted()`". */
  trusted: boolean | null;
  refused: ReadonlySet<string>;
}

const fresh = (id: number, key: string | undefined): SessionState => ({
  id,
  key,
  trusted: null,
  refused: new Set(),
});

/** What one session's callbacks share: its latest deps and its in-flight trust save. */
interface SessionHandle {
  deps: WorkspaceConsentDeps;
  inflight: Promise<void> | undefined;
}

export function useWorkspaceConsent(deps: WorkspaceConsentDeps): WorkspaceConsent {
  const nextId = useRef(1);
  const [stored, setStored] = useState<SessionState>(() => fresh(0, deps.workspaceKey));
  const [, setTick] = useState(0);
  // Callbacks of a session use that session's latest deps; once the session ends its handle is no
  // longer updated, so a retained callback never reaches the store of another workspace.
  const handleRef = useRef<SessionHandle>({ deps, inflight: undefined });

  // A different workspace starts from scratch (state derived during render, no stale frame).
  let session = stored;
  if (stored.key !== deps.workspaceKey) {
    session = fresh(nextId.current++, deps.workspaceKey);
    handleRef.current = { deps, inflight: undefined };
    setStored(session);
  }
  const handle = handleRef.current;
  handle.deps = deps;
  const sessionId = session.id;

  // Read on every render, so hooks that appear after mount (loaded once trust is granted, or for
  // a new workspace) are never hidden behind a cached list.
  const trusted = session.trusted ?? deps.isTrusted();
  const pendingHooks = deps.listPendingHooks().filter((h) => !session.refused.has(h.fingerprint));

  const trust = useCallback(() => {
    // Concurrent calls share one save and one outcome.
    if (handle.inflight !== undefined) return handle.inflight;
    const set = (value: boolean | null) =>
      setStored((prev) => (prev.id === sessionId ? { ...prev, trusted: value } : prev));
    set(true);
    const run = (async () => {
      try {
        // Saved: the optimistic `true` stays for this session (a new `workspaceKey` drops it),
        // whether or not `isTrusted()` has caught up.
        await handle.deps.persistTrust();
      } catch (err) {
        set(false);
        throw err;
      }
    })();
    handle.inflight = run;
    const clear = () => {
      handle.inflight = undefined;
    };
    run.then(clear, clear);
    return run;
  }, [handle, sessionId]);

  const approveHook = useCallback(
    async (fingerprint: string) => {
      await handle.deps.approveHook(fingerprint);
      setTick((n) => n + 1); // re-read the store
    },
    [handle],
  );

  const refuseHook = useCallback(
    (fingerprint: string) => {
      setStored((prev) =>
        prev.id === sessionId ? { ...prev, refused: new Set(prev.refused).add(fingerprint) } : prev,
      );
    },
    [sessionId],
  );

  return { trusted, pendingHooks, trust, approveHook, refuseHook };
}
