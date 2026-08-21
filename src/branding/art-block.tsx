import { Box, Text } from "ink";

/** The ASCII-art block, verbatim, in its own column so layout never compresses
 * it (`flexShrink={0}` — the gemini Banner idiom).
 *
 * U-7 — exported so `WelcomeBanner` renders art the same way rather than growing a second
 * implementation. Two components drawing the same thing differently is how the art and the aside
 * ended up unreachable together in the first place. */
export function ArtBlock({ art, accent }: { art: string; accent: string | undefined }) {
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
