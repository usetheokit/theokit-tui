import { Text } from "ink";
import { render } from "ink-testing-library";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentStreamEvent } from "./agent-stream-event.js";
import { useAgentStream } from "./use-agent-stream.js";
import type {
  AgentStreamSource,
  UseAgentStreamResult,
} from "./use-agent-stream.js";

// T2.1 (plan m7-stream-adapter, ADR D4): the react seam. Probe component +
// timer-free fakes (pull generator + deferred stream) — never renderHook,
// never waitFor (bounded 0ms tick loops).

const delta = (text: string): AgentStreamEvent => ({
  type: "text-delta",
  text,
});

/** Bounded 0ms tick loop — deterministic, no timers to fake. */
async function ticks(count = 20): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

async function* finiteStream(
  events: AgentStreamEvent[],
): AsyncGenerator<AgentStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

/** Controllable stream: `next()` blocks until the TEST resolves it — the
 * mirror's 5ms setInterval rebuilt without a single timer. */
function deferredStream() {
  let resolveNext:
    ((result: IteratorResult<AgentStreamEvent>) => void) | undefined;
  let returned = false;
  const iterator: AsyncIterator<AgentStreamEvent> = {
    next: () =>
      new Promise((resolve) => {
        resolveNext = resolve;
      }),
    return: () => {
      returned = true;
      return Promise.resolve({ done: true as const, value: undefined });
    },
  };
  return {
    iterable: {
      [Symbol.asyncIterator]: () => iterator,
    } satisfies AsyncIterable<AgentStreamEvent>,
    emit(event: AgentStreamEvent) {
      resolveNext?.({ done: false, value: event });
    },
    wasReturned: () => returned,
  };
}

interface Captured {
  current?: UseAgentStreamResult;
}

function Probe({
  source,
  captured,
}: {
  source?: AgentStreamSource;
  captured: Captured;
}) {
  const result = useAgentStream(source);
  captured.current = result;
  return <Text>{result.status}</Text>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAgentStream", () => {
  it("hook_folds_finite_stream_to_done", async () => {
    const captured: Captured = {};
    const { unmount } = render(
      <Probe
        source={finiteStream([delta("a"), delta("b")])}
        captured={captured}
      />,
    );
    await ticks();
    expect(captured.current?.status).toBe("done");
    expect(captured.current?.events[0]).toMatchObject({
      id: "msg-1",
      text: "ab",
    });
    unmount();
  });

  it("hook_undefined_source_stays_idle", async () => {
    const captured: Captured = {};
    const { unmount } = render(<Probe captured={captured} />);
    await ticks(3);
    expect(captured.current?.status).toBe("idle");
    expect(captured.current?.events).toHaveLength(0);
    unmount();
  });

  it("unmount_returns_iterator_and_stops_folding", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = deferredStream();
    const captured: Captured = {};
    const { unmount } = render(
      <Probe source={fake.iterable} captured={captured} />,
    );
    await ticks(3);
    fake.emit(delta("a"));
    await ticks(3);
    const snapshot = captured.current;
    expect(snapshot?.events[0]).toMatchObject({ text: "a" });
    unmount();
    // Passive-effect cleanup flushes one tick AFTER unmount (probe-proven
    // under ink's reconciler) — bounded ticks, never a sync assert.
    await ticks(3);
    const returned = fake.wasReturned();
    expect(returned).toBe(true);
    // Resolve the pending next AFTER unmount — the cancelled flag drops it.
    fake.emit(delta("ZOMBIE"));
    await ticks(3);
    expect(captured.current).toBe(snapshot);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("strict_mode_multi_shot_folds_once", async () => {
    // EC-6 forward-compat pin: ink's reconciler does NOT enable StrictMode
    // double-invoked effects (probe-proven: one create per mount), so this
    // asserts the invariant that must hold under EITHER behavior — a
    // multi-shot iterable (fresh generator per [Symbol.asyncIterator] call)
    // folds to "ab" exactly once, clean console. The aborted-run mechanics
    // themselves are pinned deterministically below (double_effect test).
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const multiShot: AsyncIterable<AgentStreamEvent> = {
      [Symbol.asyncIterator]: () =>
        finiteStream([delta("a"), delta("b")])[Symbol.asyncIterator](),
    };
    const captured: Captured = {};
    const { unmount } = render(
      <StrictMode>
        <Probe source={multiShot} captured={captured} />
      </StrictMode>,
    );
    await ticks();
    expect(captured.current?.status).toBe("done");
    expect(captured.current?.events[0]).toMatchObject({ text: "ab" });
    expect(captured.current?.events).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("strict_mode_single_shot_instance_documented_behavior", async () => {
    // The documented Drawback pin, environment-robust: a single-shot
    // generator INSTANCE under StrictMode ends CLEAN — terminal done, no
    // error, no partial corruption — whether or not the reconciler enables
    // double-invoked effects (with them, the aborted run-1 eats the events;
    // without, they fold normally — both are clean terminal states).
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const captured: Captured = {};
    const { unmount } = render(
      <StrictMode>
        <Probe source={finiteStream([delta("a")])} captured={captured} />
      </StrictMode>,
    );
    await ticks();
    expect(captured.current?.status).toBe("done");
    expect(captured.current?.error).toBeUndefined();
    expect(captured.current?.events.length).toBeLessThanOrEqual(1);
    for (const event of captured.current?.events ?? []) {
      expect(event).toMatchObject({ id: "msg-1", text: "a" });
    }
    expect(errorSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("double_effect_run_aborts_invisibly", async () => {
    // EC-6 mechanics pinned DETERMINISTICALLY: destroy an effect run while
    // its next() is pending (rerender with a new source identity — the same
    // destroy→create sequence StrictMode uses), then resolve the orphaned
    // next. The cancelled flag + reset make run-1 invisible: no zombie fold,
    // no setState-after-cleanup, run-2 self-sufficient.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = deferredStream();
    const captured: Captured = {};
    const { rerender, unmount } = render(
      <Probe source={fake.iterable} captured={captured} />,
    );
    await ticks(3);
    fake.emit(delta("a"));
    await ticks(3);
    expect(captured.current?.events[0]).toMatchObject({ text: "a" });
    const replacement: AgentStreamSource = () => finiteStream([delta("x")]);
    rerender(<Probe source={replacement} captured={captured} />);
    await ticks();
    // The orphaned run-1 next resolves LATE — dropped by the cancelled flag.
    fake.emit(delta("ZOMBIE"));
    await ticks(3);
    expect(captured.current?.status).toBe("done");
    expect(captured.current?.events).toHaveLength(1);
    expect(captured.current?.events[0]).toMatchObject({
      id: "msg-1",
      text: "x",
    });
    const returned = fake.wasReturned();
    expect(returned).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("factory_restart_resets_state", async () => {
    const captured: Captured = {};
    const factoryA: AgentStreamSource = () => finiteStream([delta("a")]);
    const { rerender, unmount } = render(
      <Probe source={factoryA} captured={captured} />,
    );
    await ticks();
    expect(captured.current?.events[0]).toMatchObject({
      id: "msg-1",
      text: "a",
    });
    // A NEW factory identity restarts the stream: state refolds from scratch
    // (fresh seq — msg-1 again), per the source-param contract (EC-7).
    const factoryB: AgentStreamSource = () => finiteStream([delta("a")]);
    rerender(<Probe source={factoryB} captured={captured} />);
    await ticks();
    expect(captured.current?.status).toBe("done");
    expect(captured.current?.events).toHaveLength(1);
    expect(captured.current?.events[0]).toMatchObject({
      id: "msg-1",
      text: "a",
    });
    unmount();
  });

  it("cancel_stops_consumption_and_marks_done", async () => {
    const fake = deferredStream();
    const captured: Captured = {};
    const { unmount } = render(
      <Probe source={fake.iterable} captured={captured} />,
    );
    await ticks(3);
    fake.emit(delta("a"));
    await ticks(3);
    captured.current?.cancel();
    await ticks(3);
    const returned = fake.wasReturned();
    expect(returned).toBe(true);
    expect(captured.current?.status).toBe("done");
    expect(captured.current?.events[0]).toMatchObject({ text: "a" });
    unmount();
  });

  it("second_cancel_is_noop", async () => {
    // Review F-9: idempotent — the already-cancelled early return.
    const fake = deferredStream();
    const captured: Captured = {};
    const { unmount } = render(
      <Probe source={fake.iterable} captured={captured} />,
    );
    await ticks(3);
    fake.emit(delta("a"));
    await ticks(3);
    captured.current?.cancel();
    await ticks(1);
    captured.current?.cancel();
    await ticks(1);
    expect(captured.current?.status).toBe("done");
    unmount();
  });

  it("post_cancel_resolves_are_dropped", async () => {
    // Review F-9: cancelled flag + terminal reducer state drop late events.
    const fake = deferredStream();
    const captured: Captured = {};
    const { unmount } = render(
      <Probe source={fake.iterable} captured={captured} />,
    );
    await ticks(3);
    fake.emit(delta("a"));
    await ticks(3);
    captured.current?.cancel();
    await ticks(1);
    fake.emit(delta("ZOMBIE"));
    await ticks(3);
    expect(captured.current?.status).toBe("done");
    expect(captured.current?.events[0]).toMatchObject({ text: "a" });
    unmount();
  });

  it("producer_reset_event_is_a_noop", async () => {
    // Review F-2 (MEDIUM): a producer emitting {type: "__reset__"} must NOT
    // reach the hook's internal reset — folded state survives.
    const captured: Captured = {};
    const { unmount } = render(
      <Probe
        source={finiteStream([delta("a"), { type: "__reset__" }, delta("b")])}
        captured={captured}
      />,
    );
    await ticks();
    expect(captured.current?.status).toBe("done");
    expect(captured.current?.events).toHaveLength(1);
    expect(captured.current?.events[0]).toMatchObject({
      id: "msg-1",
      text: "ab",
    });
    unmount();
  });

  it("rejecting_iterator_return_never_escapes", async () => {
    // Review F-4 (LOW): a producer whose return() rejects (finally-block
    // cleanup failure) must not surface an unhandled rejection from the
    // teardown/cancel call-sites. Vitest fails the run on unhandled
    // rejections — surviving ticks IS the oracle.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolveNext:
      ((result: IteratorResult<AgentStreamEvent>) => void) | undefined;
    const iterator: AsyncIterator<AgentStreamEvent> = {
      next: () =>
        new Promise((resolve) => {
          resolveNext = resolve;
        }),
      return: () => Promise.reject(new Error("cleanup blew up")),
    };
    const source: AsyncIterable<AgentStreamEvent> = {
      [Symbol.asyncIterator]: () => iterator,
    };
    const captured: Captured = {};
    const { unmount } = render(<Probe source={source} captured={captured} />);
    await ticks(3);
    resolveNext?.({ done: false, value: delta("a") });
    await ticks(3);
    unmount();
    await ticks(5);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("rejection_after_teardown_is_swallowed_silently", async () => {
    // The cancelled-guard in the CATCH path: a next() that rejects after
    // unmount must not dispatch an error into a dead component.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let rejectNext: ((reason: Error) => void) | undefined;
    const iterator: AsyncIterator<AgentStreamEvent> = {
      next: () =>
        new Promise((_resolve, reject) => {
          rejectNext = reject;
        }),
      return: () => Promise.resolve({ done: true as const, value: undefined }),
    };
    const source: AsyncIterable<AgentStreamEvent> = {
      [Symbol.asyncIterator]: () => iterator,
    };
    const captured: Captured = {};
    const { unmount } = render(<Probe source={source} captured={captured} />);
    await ticks(3);
    const snapshot = captured.current;
    unmount();
    await ticks(3);
    rejectNext?.(new Error("late failure"));
    await ticks(3);
    expect(captured.current).toBe(snapshot);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("stream_throw_surfaces_error_status", async () => {
    async function* throwing(): AsyncGenerator<AgentStreamEvent> {
      yield delta("a");
      throw new Error("stream blew up");
    }
    const captured: Captured = {};
    const { unmount } = render(
      <Probe source={throwing()} captured={captured} />,
    );
    await ticks();
    expect(captured.current?.status).toBe("error");
    expect(captured.current?.error?.message).toBe("stream blew up");
    // The pre-error fold survives — fail-clear, never silently lost text.
    expect(captured.current?.events[0]).toMatchObject({ text: "a" });
    unmount();
  });

  it("non_error_throw_is_stringified", async () => {
    // The String(thrown) arm — producers that throw non-Error values still
    // surface a readable message (fail-clear).
    async function* throwsValue(): AsyncGenerator<AgentStreamEvent> {
      yield delta("a");
      throw "plain string failure";
    }
    const captured: Captured = {};
    const { unmount } = render(
      <Probe source={throwsValue()} captured={captured} />,
    );
    await ticks();
    expect(captured.current?.status).toBe("error");
    expect(captured.current?.error?.message).toBe("plain string failure");
    unmount();
  });

  it("sync_throwing_source_becomes_error_state", async () => {
    // The Drawbacks negative: a factory that throws synchronously becomes
    // the error state — never an unhandled rejection.
    const captured: Captured = {};
    const boom: AgentStreamSource = () => {
      throw new Error("no stream for you");
    };
    const { unmount } = render(<Probe source={boom} captured={captured} />);
    await ticks(3);
    expect(captured.current?.status).toBe("error");
    expect(captured.current?.error?.message).toBe("no stream for you");
    unmount();
  });
});
