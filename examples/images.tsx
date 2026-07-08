import { Box, render, Text } from "ink";
import { Image } from "../src/index.js";

// M21 example: the <Image> component. On a kitty/iTerm2 terminal the image is
// drawn inline; on any other terminal (or under a multiplexer) it degrades to a
// `[Image: …]` text placeholder. Run: `pnpm tsx examples/images.tsx`.
// The bytes are supplied by the app (base64 + mimeType) — the component is pure.

// A 1x1 transparent PNG (base64) — replace with your own image bytes.
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42m\n" +
  "NkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function Demo() {
  return (
    <Box flexDirection="column" gap={1}>
      <Text>Inline image (kitty/iTerm2) — text fallback elsewhere:</Text>
      <Image
        base64Data={PNG_1X1.replace(/\n/g, "")}
        mimeType="image/png"
        filename="dot.png"
        maxWidthCells={20}
      />
      <Text dimColor>
        Editor keys also work in ChatComposer now: C-w/C-k kill, C-y yank,
        M-b/M-f word-nav, C-_ undo, ↑/↓ history.
      </Text>
    </Box>
  );
}

render(<Demo />);
