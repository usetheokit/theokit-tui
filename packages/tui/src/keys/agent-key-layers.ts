import type { KeyLayer } from "./layer-router.js";

/** Routing state for {@link agentKeyLayers}: the chord being routed, e.g. `"escape"` or `"ctrl+c"`. @public */
export interface AgentKeyState {
  readonly key: string;
}

/** Options for {@link agentKeyLayers}. @public */
export interface AgentKeyLayersOptions<A = never> {
  /** Whether a turn is running. Read on every key. */
  readonly isStreaming: () => boolean;
  /** Stop the running turn. Called by Esc while streaming and by Ctrl-C while streaming. */
  readonly interrupt: () => void;
  /** Quit the app. Called by a second Ctrl-C within the window. */
  readonly exit: () => void;
  /** Layers tried BEFORE the preset (help panel, confirmation gate, ...), so they claim Esc/Ctrl-C first. */
  readonly overlays?: readonly KeyLayer<AgentKeyState, string, A>[];
  /** Window in ms in which a second Ctrl-C quits. Default 2000. */
  readonly exitWindowMs?: number;
  /** Clock, for tests. Default `Date.now`. */
  readonly now?: () => number;
}

/**
 * The Esc / Ctrl-C vocabulary every agent TUI has, as layers for `routeThroughLayers`.
 *
 * - Esc while streaming calls `interrupt` once; while idle it is not claimed, so later app layers see it.
 * - The first Ctrl-C interrupts a running turn (if any) and arms the exit; a second within
 *   `exitWindowMs` calls `exit`.
 *
 * Route with state `{ key }` (the chord being routed). Keep the returned array across renders: the
 * arming lives in it. Append the app's own layers after it, or put them in `overlays` to precede it.
 * @public
 */
export function agentKeyLayers<A = never>(
  options: AgentKeyLayersOptions<A>,
): KeyLayer<AgentKeyState, string, A>[] {
  const {
    isStreaming,
    interrupt,
    exit,
    overlays = [],
    exitWindowMs = 2000,
    now = Date.now,
  } = options;
  let armedAt: number | null = null;
  return [
    ...overlays,
    {
      name: "agent-ctrl-c",
      when: (s) => s.key === "ctrl+c",
      route: () => {
        const t = now();
        if (armedAt !== null && t - armedAt < exitWindowMs) {
          armedAt = null;
          exit();
          return [];
        }
        armedAt = t;
        if (isStreaming()) interrupt();
        return [];
      },
    },
    {
      name: "agent-escape-interrupt",
      when: (s) => s.key === "escape" && isStreaming(),
      route: () => {
        interrupt();
        return [];
      },
    },
  ];
}
