import { Box, useInput } from "ink";
import type { ReactElement } from "react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ChatComposer } from "../chat/chat-composer.js";
import { StatusFooter } from "../status/status-footer.js";
import type { AgentEvent } from "./agent-event.js";
import type { AgentStreamEvent } from "./agent-stream-event.js";
import type { AgentStreamState, AgentStreamStatus } from "./agent-stream-reducer.js";
import { agentStreamReducer, initialAgentStreamState } from "./agent-stream-reducer.js";
import { AgentStreaming } from "./agent-streaming.js";
import { AgentTimeline } from "./agent-timeline.js";

/** One slash command the composer offers and the session runs. */
export interface AgentSessionCommand {
  /** Name WITHOUT the slash (`"clear"` for `/clear`). */
  name: string;
  /** One-line description shown in the composer's menu. */
  description: string;
  /** Runs when the user submits `/name [args]`. The command is NOT sent to the agent. */
  run: (args: string, session: AgentSessionControls) => void;
}

/** What a command (or a footer override) can do to the running session. */
export interface AgentSessionControls {
  /** Aborts the running turn. No-op when idle. */
  interrupt: () => void;
  /** Sends a message as if typed (queued when a turn is running). */
  send: (text: string) => void;
}

/** What the footer override renders from. */
export interface AgentSessionFooterInfo {
  /** A turn is running. */
  running: boolean;
  /** Messages waiting for the running turn to end. */
  queued: number;
  status: AgentStreamStatus;
}

export interface AgentSessionProps {
  /**
   * Starts one agent turn for `message` and yields its events. `signal` aborts when the user
   * interrupts (Esc) — stop producing then. The screen owns the user messages: `user` events
   * the stream echoes are ignored, so a message never appears twice. Terminal events (`done`,
   * `error`) are optional; a stream that simply ends counts as done.
   */
  stream: (message: string, signal: AbortSignal) => AsyncIterable<AgentStreamEvent>;
  /** Slash commands offered by the composer. */
  commands?: readonly AgentSessionCommand[];
  /** Replaces how one transcript event renders; receives the default row. Keep it identity-stable. */
  renderItem?: (event: AgentEvent, defaultRow: ReactElement) => ReactElement;
  /** Replaces the footer. */
  renderFooter?: (info: AgentSessionFooterInfo) => ReactElement;
  /** Composer placeholder. */
  placeholder?: string;
}

type Action =
  | { kind: "fold"; event: AgentStreamEvent }
  | { kind: "begin"; text: string }
  | { kind: "idle" };

/** One state across turns: ids stay unique because `seq` keeps counting, and `begin` re-opens the fold. */
function reduce(state: AgentStreamState, action: Action): AgentStreamState {
  if (action.kind === "fold") {
    return agentStreamReducer(state, action.event);
  }
  if (action.kind === "idle") {
    return state;
  }
  const seq = state.seq + 1;
  const { error: _error, ...rest } = state;
  return {
    ...rest,
    seq,
    status: "idle",
    streaming: { active: false },
    events: [
      ...state.events,
      { id: `user-${seq}`, kind: "message", role: "user", text: action.text },
    ],
  };
}

interface Turn {
  cancelled: boolean;
  controller: AbortController;
  iterator?: AsyncIterator<AgentStreamEvent>;
}

/** Folds one turn's events into the session state; never rejects. */
async function pump(
  turn: Turn,
  open: () => AsyncIterable<AgentStreamEvent>,
  dispatch: (action: Action) => void,
): Promise<void> {
  try {
    const iterator = open()[Symbol.asyncIterator]();
    turn.iterator = iterator;
    for (;;) {
      const result = await iterator.next();
      if (turn.cancelled) {
        return;
      }
      if (result.done === true) {
        dispatch({ kind: "fold", event: { type: "done" } });
        return;
      }
      if (result.value.type !== "user") {
        dispatch({ kind: "fold", event: result.value });
      }
    }
  } catch (error) {
    if (!turn.cancelled) {
      const message = error instanceof Error ? error.message : String(error);
      dispatch({ kind: "fold", event: { type: "error", error: message } });
    }
  }
}

/**
 * A ready-made agent session screen: transcript, streaming indicator, composer and footer.
 * Esc interrupts a running turn (it also dismisses the composer's open slash menu — both
 * happen); messages sent while a turn runs are queued and sent in order when it ends,
 * including when it ended by interrupt.
 */
export function AgentSession({
  stream,
  commands = [],
  renderItem,
  renderFooter,
  placeholder,
}: AgentSessionProps) {
  const [state, dispatch] = useReducer(reduce, initialAgentStreamState);
  const [running, setRunning] = useState(false);
  const [queued, setQueued] = useState(0);
  const turnRef = useRef<Turn | undefined>(undefined);
  const queueRef = useRef<string[]>([]);
  const streamRef = useRef(stream);
  streamRef.current = stream;
  const startRef = useRef<(text: string) => void>(() => {});

  const finish = useCallback((turn: Turn) => {
    if (turnRef.current !== turn) {
      return;
    }
    turnRef.current = undefined;
    const next = queueRef.current.shift();
    setQueued(queueRef.current.length);
    if (next === undefined) {
      setRunning(false);
    } else {
      startRef.current(next);
    }
  }, []);

  const start = useCallback(
    (text: string) => {
      const turn: Turn = { cancelled: false, controller: new AbortController() };
      // Reserved synchronously: a second submit in the same tick must queue.
      turnRef.current = turn;
      setRunning(true);
      dispatch({ kind: "begin", text });
      void pump(turn, () => streamRef.current(text, turn.controller.signal), dispatch).finally(() =>
        finish(turn),
      );
    },
    [finish],
  );
  startRef.current = start;

  const interrupt = useCallback(() => {
    const turn = turnRef.current;
    if (turn === undefined || turn.cancelled) {
      return;
    }
    turn.cancelled = true;
    turn.controller.abort();
    dispatch({ kind: "fold", event: { type: "interrupted" } });
    void turn.iterator?.return?.()?.catch(() => {});
    finish(turn);
  }, [finish]);

  const send = useCallback(
    (text: string) => {
      if (turnRef.current === undefined) {
        start(text);
        return;
      }
      queueRef.current.push(text);
      setQueued(queueRef.current.length);
    },
    [start],
  );

  const controls: AgentSessionControls = { interrupt, send };
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const submit = useCallback(
    (text: string) => {
      const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim());
      const command = match === null ? undefined : commands.find((c) => c.name === match[1]);
      if (command !== undefined) {
        command.run(match?.[2] ?? "", controlsRef.current);
        return;
      }
      send(text);
    },
    [commands, send],
  );

  useInput((_input, key) => {
    if (key.escape) {
      interrupt();
    }
  });

  useEffect(
    () => () => {
      queueRef.current = [];
      const turn = turnRef.current;
      if (turn !== undefined) {
        turn.cancelled = true;
        turn.controller.abort();
        void turn.iterator?.return?.()?.catch(() => {});
        turnRef.current = undefined;
      }
    },
    [],
  );

  const info: AgentSessionFooterInfo = { running, queued, status: state.status };
  return (
    <Box flexDirection="column">
      <AgentTimeline events={state.events} {...(renderItem === undefined ? {} : { renderItem })} />
      {running && (
        <AgentStreaming
          {...(state.streaming.thought === undefined ? {} : { thought: state.streaming.thought })}
          showCancelHint
        />
      )}
      <ChatComposer
        onSubmit={submit}
        commands={commands.map(({ name, description }) => ({ name, description }))}
        {...(placeholder === undefined ? {} : { placeholder })}
      />
      {renderFooter === undefined ? (
        <StatusFooter
          hint={queued > 0 ? `${queued} queued · esc to interrupt` : "esc to interrupt"}
        />
      ) : (
        renderFooter(info)
      )}
    </Box>
  );
}
