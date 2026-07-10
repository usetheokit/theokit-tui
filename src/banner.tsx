import { Box, Text } from "ink";

import { isMonochrome, useTheoTheme } from "./theme.js";

// M27 <Banner> (plan ascii-banner-header): a startup header — a big ASCII-art
// logo (a provided `art` string, rendered verbatim) OR the bold product `name`
// when `art` is absent (the WelcomeBanner degrade). PURE/sync — figlet lives in
// the `renderFigletArt` async helper, never in render. The framed status panel
// and the `minimal|banner` layout land in T2.1.

/** One row of the framed status panel — `label value`. */
export interface BannerStatusRow {
  label: string;
  value: string;
}

export interface BannerProps {
  /** Product name — the degrade target when `art` is absent (single line). */
  name: string;
  /** Rendered dim as ` v{version}` after the name on the degrade path. */
  version?: string;
  /** A multi-line ASCII-art string, rendered verbatim (accent-themed). Absent →
   * the bold `name` degrade. Generate it with `renderFigletArt` (optional peer). */
  art?: string;
  /** Rows for the framed status panel (only shown in the `banner` layout). */
  status?: readonly BannerStatusRow[];
  /**
   * `minimal` (default) — the header only (art or bold name). `banner` — the
   * header stacked ABOVE a framed status panel (narrow-safe; no side-by-side).
   */
  layout?: "minimal" | "banner";
}

/** The bold-name degrade line (WelcomeBanner idiom) — accent unless monochrome. */
function NameHeader({
  name,
  version,
  accent,
}: {
  name: string;
  version: string | undefined;
  accent: string | undefined;
}) {
  return (
    <Text bold {...(accent !== undefined ? { color: accent } : {})}>
      {name}
      {version !== undefined && version !== "" ? (
        <Text dimColor> v{version}</Text>
      ) : null}
    </Text>
  );
}

/** The ASCII-art block, verbatim, in its own column so layout never compresses
 * it (`flexShrink={0}` — the gemini Banner idiom). */
function ArtBlock({
  art,
  accent,
}: {
  art: string;
  accent: string | undefined;
}) {
  return (
    <Box flexDirection="column" flexShrink={0}>
      {art.split("\n").map((line, index) => (
        <Text key={index} {...(accent !== undefined ? { color: accent } : {})}>
          {line}
        </Text>
      ))}
    </Box>
  );
}

/** The framed status panel — a themed bordered box of `label value` rows. Round
 * accent border by default; `single` with no accent under monochrome (the
 * ComposerFrame degrade idiom). */
function StatusPanel({
  status,
  accent,
}: {
  status: readonly BannerStatusRow[];
  accent: string | undefined;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle={accent === undefined ? "single" : "round"}
      paddingX={1}
      {...(accent !== undefined ? { borderColor: accent } : {})}
    >
      {status.map((row) => (
        <Box key={row.label}>
          <Text dimColor>{row.label} </Text>
          <Text>{row.value}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function Banner({
  name,
  version,
  art,
  status,
  layout = "minimal",
}: BannerProps) {
  const theme = useTheoTheme();
  const accent = isMonochrome(theme) ? undefined : theme.accent;
  const header =
    art !== undefined ? (
      <ArtBlock art={art} accent={accent} />
    ) : (
      <NameHeader name={name} version={version} accent={accent} />
    );
  if (layout !== "banner" || status === undefined || status.length === 0) {
    return header;
  }
  return (
    <Box flexDirection="column">
      {header}
      <StatusPanel status={status} accent={accent} />
    </Box>
  );
}
