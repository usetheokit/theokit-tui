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

export function useWorkspaceConsent(deps: WorkspaceConsentDeps): WorkspaceConsent {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [trusted, setTrusted] = useState<boolean>(() => deps.isTrusted());
  const [refused, setRefused] = useState<ReadonlySet<string>>(() => new Set());
  const [epoch, setEpoch] = useState(0);

  // `epoch` is the recompute trigger: the store is read again after each successful approval.
  // biome-ignore lint/correctness/useExhaustiveDependencies: epoch forces a re-read of the store
  const listed = useMemo(() => depsRef.current.listPendingHooks(), [epoch]);
  const pendingHooks = useMemo(
    () => listed.filter((h) => !refused.has(h.fingerprint)),
    [listed, refused],
  );

  const trust = useCallback(async () => {
    setTrusted(true);
    try {
      await depsRef.current.persistTrust();
    } catch (err) {
      setTrusted(false);
      throw err;
    }
  }, []);

  const approveHook = useCallback(async (fingerprint: string) => {
    await depsRef.current.approveHook(fingerprint);
    setEpoch((n) => n + 1);
  }, []);

  const refuseHook = useCallback((fingerprint: string) => {
    setRefused((prev) => new Set(prev).add(fingerprint));
  }, []);

  return { trusted, pendingHooks, trust, approveHook, refuseHook };
}
