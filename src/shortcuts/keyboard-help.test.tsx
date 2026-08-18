import { describe, expect, it } from "vitest";

import { DEFAULT_COMPOSER_SHORTCUTS, KeyboardHelp } from "./keyboard-help.js";
import { renderFrame } from "../../tests/fixtures/helpers.js";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\[[0-9;]*m/g;
const strip = (value: string): string => value.replace(ANSI_RE, "");

describe("KeyboardHelp", () => {
  it("renders_each_shortcut_key_and_description", async () => {
    const frame = strip(
      await renderFrame(
        <KeyboardHelp
          shortcuts={[{ keys: "Ctrl+C", description: "Quit the app" }]}
        />,
      ),
    );
    expect(frame).toContain("Ctrl+C");
    expect(frame).toContain("Quit the app");
  });

  it("renders_the_default_title_and_a_custom_one", async () => {
    const def = strip(await renderFrame(<KeyboardHelp shortcuts={[]} />));
    expect(def).toContain("Keyboard shortcuts");
    const custom = strip(
      await renderFrame(<KeyboardHelp shortcuts={[]} title="Shortcuts" />),
    );
    expect(custom).toContain("Shortcuts");
  });

  it("default_composer_shortcuts_cover_the_headline_chords", async () => {
    const frame = strip(
      await renderFrame(
        <KeyboardHelp shortcuts={DEFAULT_COMPOSER_SHORTCUTS} />,
      ),
    );
    for (const chord of ["Enter", "/", "@", "!", "?"]) {
      expect(frame).toContain(chord);
    }
  });

  // D3 / EC-4 — located by `keys`, never by index: an index-based assertion breaks silently the
  // first time an entry is inserted above it. `grep -c 'ctrl.*"c"'` in chat-composer.tsx returns
  // 0, so the composer never handled this chord; the row is true and the attribution was not.
  it("the_quit_row_attributes_the_chord_to_the_runtime", () => {
    const quit = DEFAULT_COMPOSER_SHORTCUTS.find((s) => s.keys === "Ctrl+C");
    expect(quit).toBeDefined();
    expect(quit?.description).toContain("app");
  });
});
