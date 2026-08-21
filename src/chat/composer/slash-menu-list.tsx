import { Box, Text } from "ink";
import type { SlashMenu } from "../slash-menu.js";
import { SLASH_MENU_WINDOW } from "../slash-menu.js";

export function SlashMenuList({ menu, accent }: { menu: SlashMenu; accent: string }) {
  const visible = menu.matches.slice(menu.windowStart, menu.windowStart + SLASH_MENU_WINDOW);
  return (
    <Box flexDirection="column" paddingLeft={2}>
      {/* B-052 — conditioned on the COUNT, matching `SelectList` (select-list.tsx:217) and
          `WindowedList` (windowed-list.tsx:146). `overflowUp` IS `hiddenBefore > 0`, so reading
          both would be two predicates for one fact. */}
      {menu.hiddenBefore > 0 ? <Text dimColor>▲ {menu.hiddenBefore}</Text> : null}
      {visible.map((command, index) => {
        const active = menu.windowStart + index === menu.clampedIndex;
        return (
          <Box key={command.name}>
            {/* name column never shrinks; the description truncates —
                a long description must not interleave with the name
                (review r2-F4, the gemini SuggestionsDisplay shape). */}
            <Box flexShrink={0}>
              {/* exactOptionalPropertyTypes: omit `color`, never undefined
                  (the SEPA iteration-4 house idiom). */}
              <Text {...(active ? { color: accent } : {})}>
                {active ? "❯ " : "  "}
                {menu.sigil ?? "/"}
                {command.name}
              </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
              <Text dimColor wrap="truncate-end">
                {"  "}
                {command.description}
              </Text>
            </Box>
          </Box>
        );
      })}
      {menu.hiddenAfter > 0 ? <Text dimColor>▼ {menu.hiddenAfter}</Text> : null}
      {menu.matches.length > SLASH_MENU_WINDOW && (
        <Text dimColor>
          ({menu.clampedIndex + 1}/{menu.matches.length})
        </Text>
      )}
    </Box>
  );
}

/** M15 D1: menu state DERIVES from the buffer; only selection + the
 * dismissal latch (keyed by filter text — a filter change reopens) are
 * component state. Bundled here so the composer stays under the
 * complexity budget. */
