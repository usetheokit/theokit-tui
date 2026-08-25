import { Box, Text, useStdout } from "ink";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { LayoutMarginProps } from "../layout/layout-props.js";
import { pickMargin } from "../layout/layout-props.js";
import { reportGuardFailure } from "../status/guard-sink.js";
import { isMonochrome, useTheoTheme } from "../theme/theme.js";
import { ArtBlock } from "./art-block.js";
import { bannerArtWidth } from "./figlet-art.js";
import { isMotionEnabled } from "./motion.js";

// WelcomeBanner (plan m9-welcome-banner, ADRs D1-D5): the Claude Code/
// gemini-cli-style startup banner as a LEAF primitive. Color exclusively via
// M6 theme tokens (accent border+name; dimColor meta) — accent-only IS the
// gemini ThemedGradient empty-gradient branch, source-proven in the
// blueprint. NEVER mounts <Static> (D4 — single-consumer invariant lives in
// AgentTimeline/ChatThread); suppression is the consumer's responsibility
// (don't render it — no `hidden` prop, gemini's own leaves take none).

export interface WelcomeBannerProps extends LayoutMarginProps {
  /** Product name — single line (embedded newlines throw, D5). */
  name: string;
  /** Rendered dim as ` v{version}` on the name line; single line. */
  version?: string;
  /** May contain `\n` — one line per segment. */
  tagline?: string;
  /** One dim line per entry; entries are single-line (the array IS the
   * multi-line mechanism — embedded newlines throw). */
  hints?: readonly string[];
  /**
   * U-7 — a multi-line ASCII-art string rendered in place of the bold `name`, accent-themed and
   * verbatim. Absent → the bold `name` degrade, exactly as in `Banner`, so the two components share
   * one vocabulary.
   *
   * `Banner` had `art` and no `aside`; this component had `aside` and no `art`. The layout that
   * actually ships in a coding agent — art on the left, a hints panel on the right — was therefore
   * reachable from neither, and a consumer had to rebuild the whole box by hand to get both.
   * Generate the string with `renderFigletArt` (optional peer).
   */
  art?: string;
  /** Single free-composition slot inside the box (D1 — no layout props). */
  children?: ReactNode;
  /**
   * #5 Claude Code parity: an optional RIGHT column rendered alongside the main
   * content (the "Tips for getting started" / "What's new" panel). When present
   * the box lays out as two columns (main | aside); when absent the banner is
   * the single-column layout, byte-identical to before. The caller composes the
   * aside's rows (`<Text>` lines) — no layout props on this slot; `asideDivider` is how the slot
   * gets a rule and a width.
   */
  aside?: ReactNode;
  /**
   * usetheokit/theokit-tui#157 — draw the vertical rule between the two columns, and let the aside
   * fill the width left over instead of shrinking to its longest row:
   *
   *     ╭────────────────────────────────────────────────╮
   *     │ THEO CODE  │  Tips for getting started         │
   *     │ v0.4.7     │  Run /init to create AGENTS.md    │
   *     ╰────────────────────────────────────────────────╯
   *
   * Both reference agents draw that rule, and neither half of it was reachable from here. The
   * gutter is a `marginLeft`, and a margin cannot draw anything; the aside wrapper is
   * `flexShrink: 0` with no `flexGrow`, so it measures its content. A consumer wanting the layout
   * `aside`'s own docstring describes had to re-derive this box's padding arithmetic —
   * `width={columns - artWidth - 6}`, where the 6 is `paddingX(1) + border(1) + marginLeft(2) +
   * paddingX(1) + border(1)`, five decisions that all live in here and none of which their tests
   * or ours could see change.
   *
   * The rule and the fill ship as ONE flag because a rule without the fill lands somewhere
   * content-dependent. Measured at 60 columns with no `art`: the main column grows, so an
   * un-grown aside is pushed flush right and the rule sits wherever the longest tip happens to
   * put it; with the fill the two columns split the free space and the rule holds still as tips
   * are edited.
   *
   * Absent → the two-cell margin gutter and the content-sized aside, byte-identical to before.
   */
  asideDivider?: boolean;
  /**
   * Claude Code parity — a label written INTO the top border, replacing that run of border glyphs:
   *
   *     ╭─── Claude Code v2.1.236 ─────────────────────────────╮
   *
   * It is the most recognisable trait of that banner and was not expressible here: the frame is an
   * Ink `<Box borderStyle>`, and Ink has no border label. A consumer wanting it had to hand-roll
   * the whole box, which is what `WelcomeBanner` exists to stop.
   *
   * Absent → the plain top border, byte-identical to before.
   *
   * The title is truncated rather than allowed to widen the box: a box wider than the terminal
   * wraps its own border, which is worse than a shortened label.
   */
  borderTitle?: string;
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

/** #5 — cells of air between the main column and the aside. Also the run before the `asideDivider`
 * rule, so turning the rule on moves the panel over rather than moving the gutter. */
const ASIDE_GUTTER = 2;
/** #157 — cells of air after the `asideDivider` rule, matching `ASIDE_GUTTER` before it so the rule
 * sits centred in its own channel rather than glued to the panel text. */
const ASIDE_DIVIDER_PAD = 2;

/** M12 D1/D2: bounded reveal — 12 × 80 ms = 0.96 s (< 2 s DoD); MIN dims
 * ours (codex's 37/60 fit its huge art; this banner is ≤ 9 rows). */
const REVEAL_PHASES = 12;
const REVEAL_TICK_MS = 80;
const MIN_ANIMATION_ROWS = 15;
const MIN_ANIMATION_COLUMNS = 44;

function assertSingleLine(prop: string, value: string, allowEmpty: boolean): void {
  if (!allowEmpty && value.trim() === "") {
    reportGuardFailure(
      "WelcomeBanner",
      new TypeError(
        `WelcomeBanner: \`${prop}\` must be a non-empty string — got ${JSON.stringify(value)}`,
      ),
    );
  }
  if (value.includes("\n")) {
    reportGuardFailure(
      "WelcomeBanner",
      new TypeError(
        `WelcomeBanner: \`${prop}\` must be single-line — got ${JSON.stringify(value)} (use \`tagline\` for multi-line copy)`,
      ),
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
  const { name, tagline, hints, children, aside, art } = props;
  const titled = props.borderTitle !== undefined && props.borderTitle.trim() !== "";
  const taglineLines =
    tagline === undefined ? [] : tagline.split("\n").filter((line) => line.trim() !== "");
  const mainContent = (
    <>
      {art === undefined ? (
        // A `borderTitle` REPLACES this header rather than sitting above it. It already carries the
        // product and the build — that is what a consumer puts in it — and rendering both prints
        // the same two facts twice, three lines apart:
        //
        //     ╭─── TheoCode v0.4.7 ────────────╮
        //     │ TheoCode v0.4.7                │
        //
        // Claude Code, the layout this component follows, has the title in the border and no name
        // header underneath it.
        titled ? undefined : (
          <Text wrap="truncate-end" color={accent} bold>
            {name}
            {version === undefined ? "" : <Text dimColor> v{version}</Text>}
          </Text>
        )
      ) : (
        <ArtBlock art={art} accent={accent} />
      )}
      {/*
        #155 — `version` used to render ONLY on the no-art branch, so a consumer that passed both
        got a silently inert prop. Nothing in its docstring said the two were exclusive, and the
        only way to find out was to read the bundle.

        A coding agent puts its build on the first screen — Codex renders `>_ OpenAI Codex
        (v0.147.0)`, Claude Code renders it in the top border — so "wordmark AND version" is the
        normal case, not an exotic one. The workaround consumers reached for was smuggling the
        version into `tagline`, which made one fact travel by two different mechanisms depending on
        terminal width.

        Rendered UNDER the art rather than beside it: the art column is sized by `bannerArtWidth`,
        and appending to its last row would push past that width and break the two-column layout.
      */}
      {art !== undefined && version !== undefined && !titled ? (
        <Text wrap="truncate-end" dimColor>
          v{version}
        </Text>
      ) : undefined}
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
    </>
  );
  // No aside → the single-column box (byte-identical to pre-#5).
  if (aside === undefined) {
    return withBorderTitle(
      props.borderTitle,
      boxProps,
      accent,
      <Box {...boxProps}>{mainContent}</Box>,
    );
  }
  // Two columns: main content grows on the left; the aside is a fixed right
  // column separated by a two-cell gutter (the Claude Code welcome layout).
  //
  // U-7b — when there is art, the main column is SIZED to it and does not shrink. Growing it with
  // `flexGrow` alone let Ink compress the column whenever art + gutter + aside exceeded the
  // terminal, which breaks every art row across lines and pushes the tagline and hints out of the
  // frame. Found by a consumer that adopted U-7 and had to revert: a 34-cell wordmark beside a
  // 45-cell hints panel rendered shattered.
  //
  // `flexShrink={0}` is what actually fixes it; the explicit width keeps the aside from claiming
  // space the art needs. Without art the previous behaviour is kept exactly — a text header has no
  // intrinsic width to protect and should still absorb the leftover space.
  const artColumn =
    art === undefined ? { flexGrow: 1 } : { width: bannerArtWidth(art), flexShrink: 0 as const };
  const asidePanel = asidePanelProps(props.asideDivider, boxProps);
  return withBorderTitle(
    props.borderTitle,
    boxProps,
    accent,
    <Box {...boxProps} flexDirection="row">
      <Box flexDirection="column" {...artColumn}>
        {mainContent}
      </Box>
      <Box flexDirection="column" flexShrink={0} marginLeft={ASIDE_GUTTER} {...asidePanel}>
        {aside}
      </Box>
    </Box>,
  );
}

/**
 * usetheokit/theokit-tui#157 — the props that turn the aside wrapper into a bordered panel.
 *
 * The rule is a `borderLeft` on the WRAPPER, not on a child the consumer supplies, and that
 * placement is the whole point. The wrapper is a flex item of the two-column row, so Yoga's default
 * `align-items: stretch` gives it the row's full height and the rule reaches both borders on its
 * own. A rule drawn one level down — the only place a consumer can reach — is inside a column
 * container, where the same request means "grow along the MAIN axis" and has to be asked for
 * explicitly with `flexGrow`; forget it and the rule stops short of the bottom border exactly when
 * the art column is the taller of the two. Measured in both directions: a five-row art beside a
 * two-row panel, and a two-row art beside a five-row panel, both draw the rule across every row.
 *
 * `flexGrow: 1` is what lets a full-width child of the aside — a rule, a highlighted heading —
 * span the PANEL rather than the longest tip in it. It cannot be unconditional: measured at 60
 * columns with `name` and no `art`, the aside moves from flush-right to a half-and-half split the
 * moment it grows, so every consumer that already passes an `aside` would shift. Opting in is what
 * keeps that promise.
 *
 * `flexShrink: 1` (Ink's own default, which #5 turned off) is the one that keeps the panel inside
 * the frame. Both columns being unshrinkable means neither yields when art + gutter + rule + panel
 * exceeds the terminal, and the panel simply runs past the right border — measured at 50 columns
 * with a 24-cell wordmark, the first row overhangs by two cells. U-7b's rule is that the ART must
 * not be compressed, and that still holds: the art column keeps `flexShrink: 0`, so the panel is
 * the side that wraps. The undivided layout is left exactly as it was and overflows the same way it
 * always has — that is usetheokit/theokit-tui#158, filed rather than fixed silently here, because
 * the fix is not byte-identical for a consumer whose banner overflows today.
 *
 * `borderStyle` is taken from the frame so the rule follows the monochrome degrade with it, and the
 * colour is left alone (dimmed) so the rule reads as an internal division rather than a second
 * accent frame.
 */
function asidePanelProps(
  divider: boolean | undefined,
  boxProps: ComponentProps<typeof Box>,
): ComponentProps<typeof Box> {
  if (divider !== true) {
    return {};
  }
  return {
    flexGrow: 1,
    flexShrink: 1,
    borderStyle: boxProps.borderStyle,
    borderTop: false,
    borderRight: false,
    borderBottom: false,
    borderLeftDimColor: true,
    paddingLeft: ASIDE_DIVIDER_PAD,
  };
}

/** The glyphs Ink draws for `borderStyle="round"` / `"single"`, in the order the top row uses. */
const CORNERS = { round: ["\u256d", "\u256e"], single: ["\u250c", "\u2510"] } as const;
const HORIZONTAL = "\u2500";
/** ` title ` — one space of breathing room each side, matching Claude Code. */
const TITLE_LEAD = 3;

/**
 * Draw the top border ourselves, with `title` written into it, and let the Box draw the other three.
 *
 * Ink has no border label, so the row has to be composed as text. The Box below it keeps
 * `borderTop={false}`, which is what stops the two from being drawn twice.
 *
 * The width is taken from `boxProps.width` — the same number the Box is built with — rather than
 * measured after the fact, so the manual row and the Box's own sides cannot end up different
 * lengths. A mismatch there is not a cosmetic bug: it is a box with a step in its side.
 */
function withBorderTitle(
  title: string | undefined,
  boxProps: ComponentProps<typeof Box>,
  accent: string,
  box: ReactNode,
): ReactNode {
  const width = typeof boxProps.width === "number" ? boxProps.width : undefined;
  if (title === undefined || title.trim() === "" || width === undefined || width < FLOOR_COLUMNS) {
    return box;
  }
  const [left, right] = boxProps.borderStyle === "single" ? CORNERS.single : CORNERS.round;

  // Every cell between the corners: the lead-in rule, the padded title, and the fill after it.
  const inner = width - 2;
  const room = inner - TITLE_LEAD - 2;
  const label =
    [...title].length > room
      ? `${[...title].slice(0, Math.max(0, room - 1)).join("")}\u2026`
      : title;
  const fill = Math.max(0, inner - TITLE_LEAD - [...label].length - 2);

  return (
    <Box flexDirection="column">
      <Text color={accent}>
        {`${left}${HORIZONTAL.repeat(TITLE_LEAD)} ${label} ${HORIZONTAL.repeat(fill)}${right}`}
      </Text>
      {box}
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

  // U-7c — MAX_WIDTH was sized for the SINGLE-column banner: art or name, tagline, hints. A layout
  // with an aside has to hold art + gutter + aside, which routinely exceeds 60 cells, and capping it
  // there did not shrink the content — it just let the content run past the border.
  //
  // So the cap applies to the one-column layout, where it protects line length, and the two-column
  // layout takes the terminal it was given (still bounded by `columns`, so it never exceeds the
  // real screen). This is what the consumer that reported it was doing by hand with `width={cols-2}`.
  const width = props.aside === undefined ? Math.min(columns, MAX_WIDTH) : columns;
  // One box definition shared by the reveal frame and the static tree. The
  // consumer margin is spread LAST so it wins over any box default.
  // #155/Claude Code parity — with a `borderTitle` the top row is composed as TEXT (Ink has no
  // border label), so the Box must not draw one too. `borderTop: false` is what keeps the two from
  // being stacked; `withBorderTitle` supplies the row that replaces it.
  const titled = props.borderTitle !== undefined && props.borderTitle.trim() !== "";
  const boxProps = {
    flexDirection: "column" as const,
    width,
    paddingX: 1,
    borderStyle: isMonochrome(theme) ? ("single" as const) : ("round" as const),
    borderColor: theme.accent,
    ...(titled ? { borderTop: false as const } : {}),
    ...pickMargin(props),
  };
  if (revealing) {
    // Mid-reveal frame: name typewriter only — version/tagline/hints/
    // children are withheld until convergence (phase === REVEAL_PHASES
    // falls through to the static tree below, byte-identical by
    // construction).
    const shown = name.slice(0, Math.ceil((name.length * phase) / REVEAL_PHASES));
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
