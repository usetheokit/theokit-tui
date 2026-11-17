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
   * Identifies the workspace (its directory, say). When it changes, the optimistic trust and the
   * session refusals of the previous workspace are dropped. Pass it whenever one mounted component
   * can be pointed at another directory.
   */
  workspaceKey?: string;
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
  key: string | undefined;
  /** Set by `trust()`; `null` means "ask `isTrusted()`". */
  trusted: boolean | null;
  refused: ReadonlySet<string>;
}

const fresh = (key: string | undefined): SessionState => ({
  key,
  trusted: null,
  refused: new Set(),
});

export function useWorkspaceConsent(deps: WorkspaceConsentDeps): WorkspaceConsent {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [stored, setStored] = useState<SessionState>(() => fresh(deps.workspaceKey));
  const [, setTick] = useState(0);

  // A different workspace starts from scratch (state derived during render, no stale frame).
  let session = stored;
  if (stored.key !== deps.workspaceKey) {
    session = fresh(deps.workspaceKey);
    setStored(session);
  }
  const key = session.key;

  // Read on every render, so hooks that appear after mount (loaded once trust is granted, or for
  // a new workspace) are never hidden behind a cached list.
  const trusted = session.trusted ?? deps.isTrusted();
  const pendingHooks = deps.listPendingHooks().filter((h) => !session.refused.has(h.fingerprint));

  const trust = useCallback(async () => {
    const set = (value: boolean | null) =>
      setStored((prev) => (prev.key === key ? { ...prev, trusted: value } : prev));
    set(true);
    try {
      await depsRef.current.persistTrust();
    } catch (err) {
      set(false);
      throw err;
    }
  }, [key]);

  const approveHook = useCallback(async (fingerprint: string) => {
    await depsRef.current.approveHook(fingerprint);
    setTick((n) => n + 1); // re-read the store
  }, []);

  const refuseHook = useCallback(
    (fingerprint: string) => {
      setStored((prev) =>
        prev.key === key ? { ...prev, refused: new Set(prev.refused).add(fingerprint) } : prev,
      );
    },
    [key],
  );

  return { trusted, pendingHooks, trust, approveHook, refuseHook };
}
