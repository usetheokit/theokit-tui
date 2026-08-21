import { Box, Text } from "ink";

import { cursorSlices } from "./cursor-slices.js";

const NO_COLOR_CURSOR_MARKER = "▏";

/** Placeholder-branch cursor cell (M6 D8): visible marker under monochrome
 * themes (chalk level 0 strips the inverse attribute). */
function PlaceholderCursor({ marker }: { marker: boolean }) {
  return marker ? <Text>{NO_COLOR_CURSOR_MARKER}</Text> : <Text inverse> </Text>;
}

/** Text-branch cursor cell (M6 D8): the marker before the char under
 * monochrome themes, inverse styling otherwise. Known cosmetic scope
 * (review dom-frontend-3): the marker adds +1 column in monochrome mode,
 * so exact-fit lines clip one column earlier than the colored render. */
function CursorCell({
  atCursor,
  focused,
  marker,
}: {
  atCursor: string;
  focused: boolean;
  marker: boolean;
}) {
  if (marker) {
    return (
      <>
        {NO_COLOR_CURSOR_MARKER}
        {atCursor}
      </>
    );
  }
  return <Text inverse={focused}>{atCursor}</Text>;
}

/** The windowed slash-menu rows (gemini SuggestionsDisplay reduced). */

export function InputRow({
  buffer,
  placeholder,
  isFocused,
  monochrome,
  glyph,
  prefixColor,
}: {
  buffer: { text: string; cursorOffset: number };
  placeholder: string;
  isFocused: boolean;
  monochrome: boolean;
  glyph: string;
  prefixColor: string;
}) {
  const { before, atCursor, after } = cursorSlices(buffer.text, buffer.cursorOffset);
  const showPlaceholder = buffer.text.length === 0 && placeholder.length > 0;
  const noColorMarker = monochrome && isFocused;
  return (
    <Box>
      <Text color={prefixColor}>{glyph}</Text>
      {showPlaceholder ? (
        <Box>
          {isFocused && <PlaceholderCursor marker={noColorMarker} />}
          <Text dimColor>{placeholder}</Text>
        </Box>
      ) : (
        <Text>
          {before}
          {/* Cursor cell only while focused (review F-dom-4 — plan: "cursor
              shows when focused"); blurred composers render plain text. */}
          <CursorCell atCursor={atCursor} focused={isFocused} marker={noColorMarker} />
          {after}
        </Text>
      )}
    </Box>
  );
}
