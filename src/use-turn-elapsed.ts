import { useEffect, useState } from "react";

// M14 useTurnElapsed (plan m14-status-bar, ADR D2): the lib-shipped ticking
// source for `AgentStreaming.elapsedSeconds`. AgentStreaming itself holds
// NO timer (its M3 contract) — this hook is the driver the consumer wires:
//   <AgentStreaming elapsedSeconds={useTurnElapsed(streaming)} … />
// Unlike M12's self-clearing reveal, a turn has no known end — the interval
// runs while `active` and is stopped by deactivation or unmount.

/**
 * Seconds elapsed since `active` became true. 0 while inactive;
 * re-activation RESETS to 0 (a new turn is a new clock); the interval is
 * cleared on deactivation and on unmount.
 */
export function useTurnElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);
  return elapsed;
}
