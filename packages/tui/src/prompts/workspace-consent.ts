import { useCallback, useMemo, useRef, useState } from "react";

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
  /** Must reflect the store: it is read on every render and is true once `persistTrust` resolved. */
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
  /** Optimistic value while `trust()` is saving; `null` means "ask `isTrusted()`". */
  trusted: boolean | null;
  refused: ReadonlySet<string>;
}

const fresh = (id: number, key: string | undefined): SessionState => ({
  id,
  key,
  trusted: null,
  refused: new Set(),
});

export function useWorkspaceConsent(deps: WorkspaceConsentDeps): WorkspaceConsent {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const nextId = useRef(1);
  const [stored, setStored] = useState<SessionState>(() => fresh(0, deps.workspaceKey));
  const [, setTick] = useState(0);
  // The deps of the render that started the session: `trust()` of that session persists through
  // them, never through the deps of a workspace the component has since been pointed at.
  const sessionDeps = useRef(deps);

  // A different workspace starts from scratch (state derived during render, no stale frame).
  let session = stored;
  if (stored.key !== deps.workspaceKey) {
    session = fresh(nextId.current++, deps.workspaceKey);
    sessionDeps.current = deps;
    setStored(session);
  }
  const sessionId = session.id;

  // Read on every render, so hooks that appear after mount (loaded once trust is granted, or for
  // a new workspace) are never hidden behind a cached list.
  const trusted = session.trusted ?? deps.isTrusted();
  const pendingHooks = deps.listPendingHooks().filter((h) => !session.refused.has(h.fingerprint));

  // Captured when the session's callback is created, so a later session's deps cannot replace it.
  const persist = useMemo(() => sessionDeps.current.persistTrust, [sessionId]);
  const trust = useCallback(async () => {
    const set = (value: boolean | null) =>
      setStored((prev) => (prev.id === sessionId ? { ...prev, trusted: value } : prev));
    set(true);
    try {
      await persist();
      // Saved: from here the store is the source of truth again, so the answer follows
      // `isTrusted()` and cannot leak into another directory.
      set(null);
    } catch (err) {
      set(false);
      throw err;
    }
  }, [sessionId, persist]);

  const approveHook = useCallback(async (fingerprint: string) => {
    await depsRef.current.approveHook(fingerprint);
    setTick((n) => n + 1); // re-read the store
  }, []);

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
