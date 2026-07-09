import { Box, Text, useStdout } from "ink";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { isMotionEnabled } from "./motion.js";
import { isMonochrome, useTheoTheme } from "./theme.js";

// WelcomeBanner (plan m9-welcome-banner, ADRs D1-D5): the Claude Code/
// gemini-cli-style startup banner as a LEAF primitive. Color exclusively via
// M6 theme tokens (accent border+name; dimColor meta) — accent-only IS the
// gemini ThemedGradient empty-gradient branch, source-proven in the
// blueprint. NEVER mounts <Static> (D4 — single-consumer invariant lives in
// AgentTimeline/ChatThread); suppression is the consumer's responsibility
// (don't render it — no `hidden` prop, gemini's own leaves take none).

export interface WelcomeBannerProps {
  /** Product name — single line (embedded newlines throw, D5). */
  name: string;
  /** Rendered dim as ` v{version}` on the name line; single line. */
  version?: string;
  /** May contain `\n` — one line per segment. */
  tagline?: string;
  /** One dim line per entry; entries are single-line (the array IS the
   * multi-line mechanism — embedded newlines throw). */
  hints?: readonly string[];
  /** Single free-composition slot inside the box (D1 — no layout props). */
  children?: ReactNode;
  /** M12: opt-in < 2 s typewriter reveal (12 phases × 80 ms). MOUNT-TIME
   * gate, evaluated once: runs ONLY when stdout is an interactive TTY with
   * rows ≥ 15 and columns ≥ 44, the theme is not monochrome, and the
   * end-user has not set `THEOKIT_TUI_NO_MOTION` (any non-empty value).
   * Everywhere else — and at convergence — the render is the exact static
   * banner tree (byte-identical by construction). Dims changing during the
   * reveal do not abort it (the gate is frozen at mount). */
  animated?: boolean;
}

/** D3: below this the final rung renders one plain Text (codex idiom). */
const FLOOR_COLUMNS = 24;
const MAX_WIDTH = 60;

/** M12 D1/D2: bounded reveal — 12 × 80 ms = 0.96 s (< 2 s DoD); MIN dims
 * ours (codex's 37/60 fit its huge art; this banner is ≤ 9 rows). */
const REVEAL_PHASES = 12;
const REVEAL_TICK_MS = 80;
const MIN_ANIMATION_ROWS = 15;
const MIN_ANIMATION_COLUMNS = 44;

function assertSingleLine(
  prop: string,
  value: string,
  allowEmpty: boolean,
): void {
  if (!allowEmpty && value.trim() === "") {
    throw new TypeError(
      `WelcomeBanner: \`${prop}\` must be a non-empty string — got ${JSON.stringify(value)}`,
    );
  }
  if (value.includes("\n")) {
    throw new TypeError(
      `WelcomeBanner: \`${prop}\` must be single-line — got ${JSON.stringify(value)} (use \`tagline\` for multi-line copy)`,
    );
  }
}

function assertBannerProps(props: WelcomeBannerProps): void {
  assertSingleLine("name", props.name, false);
  if (props.version !== undefined) {
    assertSingleLine("version", props.version, true);
  }
  for (const hint of props.hints ?? []) {
    assertSingleLine("hints", hint, false);
  }
}

/** Empty/whitespace version renders as ABSENT — never a dangling " v". */
function normalizeVersion(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

/** M12 D2: the full gate stack — pure, evaluated exactly once at mount by
 * the caller (M11 mount-freeze precedent). */
function isRevealEligible(
  animated: boolean | undefined,
  stdout: NodeJS.WriteStream | undefined,
  monochrome: boolean,
  columns: number,
): boolean {
  // The core reduced-motion predicate (env + TTY + monochrome) is shared via
  // `isMotionEnabled` (M24 D6); the banner adds its own rows/columns thresholds.
  return (
    animated === true &&
    isMotionEnabled(process.env, stdout, monochrome) &&
    (stdout?.rows ?? 0) >= MIN_ANIMATION_ROWS &&
    columns >= MIN_ANIMATION_COLUMNS
  );
}

/** M12 D1: the bounded phase driver — 12 × 80 ms, self-clearing at the
 * final phase and torn down on unmount. */
function useRevealPhase(active: boolean): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => {
      setPhase((current) => {
        const next = current + 1;
        if (next >= REVEAL_PHASES) {
          clearInterval(id);
        }
        return Math.min(next, REVEAL_PHASES);
      });
    }, REVEAL_TICK_MS);
    return () => clearInterval(id);
  }, [active]);
  return phase;
}

/** The full static banner tree — the single source both the gate-closed
 * path and the converged reveal return (byte-identity by construction).
 * Plain function call (not a component) so the element tree is identical
 * to the pre-M12 inline JSX. */
function staticBannerTree(
  props: WelcomeBannerProps,
  version: string | undefined,
  accent: string,
  boxProps: ComponentProps<typeof Box>,
) {
  const { name, tagline, hints, children } = props;
  const taglineLines =
    tagline === undefined
      ? []
      : tagline.split("\n").filter((line) => line.trim() !== "");
  return (
    <Box {...boxProps}>
      <Text wrap="truncate-end" color={accent} bold>
        {name}
        {version === undefined ? "" : <Text dimColor> v{version}</Text>}
      </Text>
      {taglineLines.map((line, index) => (
        <Text key={`tagline-${index}`} wrap="truncate-end">
          {line}
        </Text>
      ))}
      {hints !== undefined && hints.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {hints.map((hint, index) => (
            <Text key={`hint-${index}`} wrap="truncate-end" dimColor>
              {hint}
            </Text>
          ))}
        </Box>
      ) : undefined}
      {children}
    </Box>
  );
}

export function WelcomeBanner(props: WelcomeBannerProps) {
  // Boundary validation FIRST, before hooks (house F10 idiom).
  assertBannerProps(props);
  const { name } = props;
  const version = normalizeVersion(props.version);
  const theme = useTheoTheme();
  const { stdout } = useStdout();

  // WIDTH CONTRACT (M9 review errata to ADR D3): columns are read at
  // RENDER time and frozen until the next React re-render (ink resize does
  // not re-render React). Live-resize demand flips to a useTerminalSize
  // hook (the gemini-cli pattern).
  const columns = stdout?.columns ?? MAX_WIDTH;

  // Frozen at mount — mid-reveal flips cannot strand a partial frame (D2).
  const revealActive = useRef(
    isRevealEligible(props.animated, stdout, isMonochrome(theme), columns),
  ).current;
  const phase = useRevealPhase(revealActive);
  const revealing = revealActive && phase < REVEAL_PHASES;

  if (columns < FLOOR_COLUMNS) {
    // The plain-text final rung: nothing that can exceed `columns`.
    return (
      <Text wrap="truncate-end">
        {name}
        {version === undefined ? "" : ` v${version}`}
      </Text>
    );
  }

  const width = Math.min(columns, MAX_WIDTH);
  // One box definition shared by the reveal frame and the static tree.
  const boxProps = {
    flexDirection: "column" as const,
    width,
    paddingX: 1,
    borderStyle: isMonochrome(theme) ? ("single" as const) : ("round" as const),
    borderColor: theme.accent,
  };
  if (revealing) {
    // Mid-reveal frame: name typewriter only — version/tagline/hints/
    // children are withheld until convergence (phase === REVEAL_PHASES
    // falls through to the static tree below, byte-identical by
    // construction).
    const shown = name.slice(
      0,
      Math.ceil((name.length * phase) / REVEAL_PHASES),
    );
    return (
      <Box {...boxProps}>
        <Text wrap="truncate-end" color={theme.accent} bold>
          {/* single space at phase 0: an empty Text collapses to height 0
          and the box would jump 2->3 lines on the first tick (review F-1) */}
          {shown === "" ? " " : shown}
        </Text>
      </Box>
    );
  }

  return staticBannerTree(props, version, theme.accent, boxProps);
}
