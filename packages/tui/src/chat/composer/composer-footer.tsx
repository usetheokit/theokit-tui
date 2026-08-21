import { Box, Text } from "ink";

import type { SlashMenu } from "../slash-menu.js";
import { SlashMenuList } from "./slash-menu-list.js";

/** Bang-mode affordance line — replaces the caller's hint while shell mode is on. */
const SHELL_MODE_HINT = "shell mode · Enter runs the command · esc cancels";

export function ComposerFooter({
  menu,
  mentionMenu,
  accent,
  hint,
  shellMode,
}: {
  menu: SlashMenu;
  mentionMenu: SlashMenu;
  accent: string;
  hint: string | undefined;
  shellMode: boolean;
}) {
  // Shell mode overrides the caller's hint with the bang-mode affordance line.
  const shown = shellMode ? SHELL_MODE_HINT : hint;
  return (
    <>
      {menu.open && <SlashMenuList menu={menu} accent={accent} />}
      {mentionMenu.open && <SlashMenuList menu={mentionMenu} accent={accent} />}
      {shown !== undefined && shown !== "" && (
        <Box paddingLeft={2}>
          <Text dimColor>{shown}</Text>
        </Box>
      )}
    </>
  );
}
