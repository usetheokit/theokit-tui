import { Box, Text } from "ink";

import { assertFiniteNonNegative, formatElapsed } from "../format/format.js";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { useTheoTheme } from "../theme/theme.js";

/**
 * The line a finished turn LEAVES BEHIND — `✻ Baked for 5s` (#62 item 1).
 *
 * `AgentStreaming` is live-only: it says what is happening and vanishes when it stops. Claude Code
 * v2.1.218 also persists one dim past-tense line per turn, so scrolling back shows what each turn
 * cost. Nothing here did that, so a transcript kept the answers and dropped the timings.
 *
 * DUMB and STATIC, deliberately, because this is the line that graduates into `<Static>`: no
 * timers, no cycling, no state. A component that changed after mount could not live in terminal
 * scrollback, which is already printed and cannot be repainted.
 */

/**
 * The past-tense verbs, in the register Claude Code uses.
 *
 * Exported so an app can pick its own and pass `verb` — the whimsy is the app's voice, and a
 * library that hardcoded it would put its own personality into every consumer's product.
 */
export const WHIMSY_VERBS: readonly string[] = Object.freeze([
  "Baked",
  "Brewed",
  "Cooked",
  "Sautéed",
  "Simmered",
  "Whisked",
  "Kneaded",
  "Marinated",
  "Roasted",
  "Steeped",
]);

export interface TurnDoneProps extends LayoutMarginProps {
  /** How long the turn took. Finite, >= 0. */
  seconds: number;
  /**
   * The past-tense verb. Omit it and one is chosen from {@link WHIMSY_VERBS} by `seconds`.
   *
   * Chosen from the DURATION rather than at random: the value has to survive a re-render, because
   * a row whose text changes after it has been printed into scrollback would disagree with what
   * the terminal already shows. It also makes the component testable without faking a generator.
   */
  verb?: string;
}

/** The verb for a duration — deterministic, so the same turn always reads the same. */
export function whimsyVerb(seconds: number): string {
  const index = Math.floor(Math.abs(seconds)) % WHIMSY_VERBS.length;
  return WHIMSY_VERBS[index] as string;
}

export function TurnDone({ seconds, verb, ...margin }: TurnDoneProps) {
  // Boundary validation before hooks (F10 idiom) — ink swallows render-time throws.
  assertFiniteNonNegative(seconds, "TurnDone: seconds must be >= 0");
  const theme = useTheoTheme();
  const word = verb ?? whimsyVerb(seconds);
  return (
    <Box {...margin}>
      <Box minWidth={3}>
        <Text color={theme.toolStatus.success.color}>{"✻"}</Text>
      </Box>
      <Text dimColor wrap="truncate-end">
        {`${word} for ${formatElapsed(seconds)}`}
      </Text>
    </Box>
  );
}
