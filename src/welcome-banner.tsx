import { Box, Text, useStdout } from "ink";
import type { ReactNode } from "react";

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
}

/** D3: below this, border+padding no longer yield a legible line — the
 * final rung renders one plain Text (codex idiom, closing gemini's
 * no-guard-below-tiny hole). */
const FLOOR_COLUMNS = 24;
const MAX_WIDTH = 60;

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

/** Empty/whitespace version renders as ABSENT — never a dangling " v"
 * (review F-2; validation allows "" since D5 only forbids newlines). */
function normalizeVersion(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

export function WelcomeBanner(props: WelcomeBannerProps) {
  // Boundary validation FIRST, before hooks (house F10 idiom).
  assertBannerProps(props);
  const { name, tagline, hints, children } = props;
  const version = normalizeVersion(props.version);
  const theme = useTheoTheme();
  const { stdout } = useStdout();

  // WIDTH CONTRACT (review F-1 errata to ADR D3): columns are read at
  // RENDER time and frozen until the next React re-render — ink 5.2.1's
  // resize handler only re-runs yoga layout + repaint, it does NOT re-render
  // React, and useStdout is a stable context value. For a startup-moment
  // banner this is accepted; live-resize demand flips to a useTerminalSize
  // hook (stdout.on("resize") → state — the gemini-cli pattern).
  const columns = stdout?.columns ?? MAX_WIDTH;
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
  const taglineLines =
    tagline === undefined
      ? []
      : tagline.split("\n").filter((line) => line.trim() !== "");
  return (
    <Box
      flexDirection="column"
      width={width}
      paddingX={1}
      borderStyle={isMonochrome(theme) ? "single" : "round"}
      borderColor={theme.accent}
    >
      <Text wrap="truncate-end" color={theme.accent} bold>
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
