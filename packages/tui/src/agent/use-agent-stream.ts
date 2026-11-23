import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { AgentEvent } from "./agent-event.js";
import type { AgentStreamEvent } from "./agent-stream-event.js";
import type { AgentStreamState } from "./agent-stream-reducer.js";
import { agentStreamReducer, initialAgentStreamState } from "./agent-stream-reducer.js";
import type { MessagesToEventsOptions, UIMessageLike } from "./messages-to-events.js";
import { messagesToAgentEvents } from "./messages-to-events.js";

// The react seam (plan m7-stream-adapter ADR D4): a sequential awaited loop
// over an async-iterable stream, folding each event through the pure reducer.
// The mirror's 57-line loop hardened: cancelled flag checked after EVERY
// await, iterator.return?.() on cleanup, reset dispatch at effect start
// (StrictMode's double-invoked effect run-1 becomes invisible), and a
// cancel() escape hatch that rides done's terminal fold (EC-2).

/**
 * The stream source: an async iterable, or a factory returning one.
 *
 * HOIST OR MEMOIZE FACTORIES — the source identity is the effect dependency,
 * so an inline arrow restarts the stream on every render (EC-7). A NEW
 * identity deliberately restarts: state resets and refolds from scratch
 * (fresh seq/ids) — reconnect-by-refold rides exactly this contract (D5).
 *
 * Under React StrictMode (dev, strict-effects reconcilers) pass a FACTORY:
 * a raw generator instance is closed by the run-1 cleanup's return() and
 * the remount refolds it as an instant clean done (review F-10).
 */
export type AgentStreamSource =
  | AsyncIterable<AgentStreamEvent>
  | (() => AsyncIterable<AgentStreamEvent>);

export interface UseAgentStreamResult extends AgentStreamState {
  /** Stops consumption (iterator.return) and folds the terminal done. */
  cancel: () => void;
}

/**
 * Options for {@link useAgentStream}. Extends {@link MessagesToEventsOptions} so a seeded
 * transcript is projected with the SAME tool formatting the surface uses everywhere else.
 */
export interface UseAgentStreamOptions extends MessagesToEventsOptions {
  /**
   * Messages already in the thread — a resumed session's transcript (#179).
   *
   * They are projected through {@link messagesToAgentEvents} and returned as a PREFIX of `events`,
   * ahead of everything the live stream folds. Being a prefix rather than a seeded fold is what
   * makes the two things a resumed surface needs work at once:
   *
   * - a NEW `source` identity resets the fold (the D5 reconnect-by-refold contract) and the history
   *   is untouched — it was never part of the fold to reset;
   * - a transcript read asynchronously can arrive AFTER mount and still render.
   *
   * `status`/`streaming` describe the live stream only: seeding leaves an unstarted hook `idle`,
   * because nothing has streamed.
   *
   * KNOWN LIMIT: the projection ids (`{messageId}::mN`, the raw `toolCallId`) and the fold's minted
   * ids (`msg-N`, `tool-{call_id}`) live in disjoint namespaces, so a tool that was ALREADY in the
   * transcript and is re-emitted by the live stream renders twice, under both ids. Seed the history
   * that precedes the stream, not the turn the stream is about to replay.
   */
  initialMessages?: readonly UIMessageLike[];
}

/** Shared empty seed — a stable identity, so the no-seed path never re-allocates `events`. */
const NO_SEED: readonly AgentEvent[] = [];

/** Internal wrapper action — a structural ENVELOPE (review F-2), so a
 * producer emitting `{type: "__reset__"}` can never reach the reset branch
 * (EC-4: the hook resets its own state between sources; producers cannot —
 * their unknown types fold to no-op in the public reducer). */
type HookAction = { kind: "fold"; event: AgentStreamEvent } | { kind: "reset" };

function hookReducer(state: AgentStreamState, action: HookAction): AgentStreamState {
  if (action.kind === "reset") {
    return initialAgentStreamState;
  }
  return agentStreamReducer(state, action.event);
}

/** Teardown return() rejections have nowhere to rise (review F-4) — a
 * producer whose finally-block cleanup fails must not become an unhandled
 * rejection that kills the consumer CLI. Swallowing HERE is the contract. */
function swallowTeardown(result: Promise<unknown> | undefined): void {
  void result?.catch(() => {});
}

interface StreamControl {
  cancelled: boolean;
  iterator?: AsyncIterator<AgentStreamEvent>;
}

export function useAgentStream(
  source?: AgentStreamSource,
  options?: UseAgentStreamOptions,
): UseAgentStreamResult {
  const [state, dispatch] = useReducer(hookReducer, initialAgentStreamState);
  const controlRef = useRef<StreamControl>({ cancelled: false });

  useEffect(() => {
    if (source === undefined) {
      return undefined;
    }
    const control: StreamControl = { cancelled: false };
    controlRef.current = control;
    dispatch({ kind: "reset" });
    void (async () => {
      try {
        // Factory resolution INSIDE the try: a synchronously-throwing
        // source becomes the error state, never an unhandled rejection.
        const iterable = typeof source === "function" ? source() : source;
        const iterator = iterable[Symbol.asyncIterator]();
        control.iterator = iterator;
        for (;;) {
          const result = await iterator.next();
          if (control.cancelled) {
            return;
          }
          if (result.done === true) {
            // Synthetic terminal — no SDK stream emits "done" (D1).
            dispatch({ kind: "fold", event: { type: "done" } });
            return;
          }
          dispatch({ kind: "fold", event: result.value });
        }
      } catch (thrown) {
        if (control.cancelled) {
          return;
        }
        const message = thrown instanceof Error ? thrown.message : String(thrown);
        dispatch({
          kind: "fold",
          event: { type: "error", error: { message } },
        });
      }
    })();
    return () => {
      control.cancelled = true;
      swallowTeardown(control.iterator?.return?.());
    };
  }, [source]);

  // Destructured so the memo's dependencies are the VALUES, not an options object a
  // consumer re-creates on every render.
  const initialMessages = options?.initialMessages;
  const exploreTools = options?.exploreTools;
  const formatToolHeader = options?.formatToolHeader;
  const formatToolResult = options?.formatToolResult;
  const seeded = useMemo<readonly AgentEvent[]>(() => {
    if (initialMessages === undefined || initialMessages.length === 0) {
      return NO_SEED;
    }
    return messagesToAgentEvents(initialMessages, {
      ...(exploreTools === undefined ? {} : { exploreTools }),
      ...(formatToolHeader === undefined ? {} : { formatToolHeader }),
      ...(formatToolResult === undefined ? {} : { formatToolResult }),
    });
  }, [initialMessages, exploreTools, formatToolHeader, formatToolResult]);

  const events = useMemo(
    () => (seeded.length === 0 ? state.events : [...seeded, ...state.events]),
    [seeded, state.events],
  );

  const cancel = useCallback(() => {
    const control = controlRef.current;
    if (control.cancelled) {
      return;
    }
    control.cancelled = true;
    swallowTeardown(control.iterator?.return?.());
    dispatch({ kind: "fold", event: { type: "done" } });
  }, []);

  return { ...state, events, cancel };
}
