import { Text } from "ink";

import type { InlineSegment } from "./markdown.js";

export function Segments({ segments, accent }: { segments: InlineSegment[]; accent: string }) {
  return (
    <>
      {segments.map((segment, index) => {
        const key = `seg-${index}`;
        if (segment.styles.code === true) {
          return (
            <Text key={key} color={accent}>
              {segment.text}
            </Text>
          );
        }
        if (segment.styles.link !== undefined) {
          // "text (url)" shape (gemini parity); bare URLs carry text===url.
          const bare = segment.text === segment.styles.link;
          return (
            <Text key={key}>
              {bare ? "" : `${segment.text} (`}
              <Text color={accent}>{segment.styles.link}</Text>
              {bare ? "" : ")"}
            </Text>
          );
        }
        return (
          <Text
            key={key}
            bold={segment.styles.bold === true}
            italic={segment.styles.italic === true}
            strikethrough={segment.styles.strikethrough === true}
          >
            {segment.text}
          </Text>
        );
      })}
    </>
  );
}

/** h1/h2 bold accent; h3 bold; h4 italic dim (gemini level ladder). */
