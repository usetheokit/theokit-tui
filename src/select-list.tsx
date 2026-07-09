import { Box, Text } from "ink";
import { useState } from "react";

import { useInput } from "./renderer/input/use-input.js";
import { useFocus } from "./renderer/hooks/use-focus.js";
import { deriveSelectList, type SelectListItem } from "./select-list-model.js";
import { useTheoTheme } from "./theme.js";

// M22 SelectList (plan m22-interaction-primitives T1.1, ADR A3): a windowed
// list with prefix|fuzzy filter, single OR multi-select, over the shared pure
// model. Consumes OUR M19 `useInput` + M20 `useFocus` (NOT ink's — new code, no
// Ink-drop debt). The render generalizes M15's `SlashMenuList`: `❯` active
// marker, ▲/▼ overflow, `(i/n)` / `k selected` counter, and a `◉`/`◯` checkbox
// column for multi-select. Under a monochrome theme the marker degrades to a
// visible glyph (M6 precedent) rather than relying on color.

export interface SelectListProps {
  items: readonly SelectListItem[];
  /** Called with the chosen values on Enter (always an array; single = one). */
  onSubmit: (values: string[]) => void;
  /** Multi-select (space toggles, Enter commits the set). Default single. */
  multi?: boolean;
  /** Fuzzy rank vs case-insensitive prefix. Default prefix. */
  fuzzy?: boolean;
  /** Visible rows. Default 5. */
  window?: number;
  autoFocus?: boolean;
}

const DEFAULT_WINDOW = 5;

type SelectKeyAction =
  "up" | "down" | "submit" | "toggle" | "backspace" | "insert";

interface SelectKey {
  upArrow: boolean;
  downArrow: boolean;
  return: boolean;
  backspace: boolean;
  delete: boolean;
  ctrl: boolean;
  meta: boolean;
}

/** A plain printable char (not a control/meta chord) extends the filter. */
function isPrintable(input: string, key: SelectKey): boolean {
  return input.length > 0 && !key.ctrl && !key.meta;
}

/** Resolve one keypress to a SelectList action (pure — keeps the handler flat). */
function resolveSelectAction(
  input: string,
  key: SelectKey,
  multi: boolean,
): SelectKeyAction | undefined {
  if (key.upArrow) return "up";
  if (key.downArrow) return "down";
  if (key.return) return "submit";
  if (multi && input === " ") return "toggle";
  if (key.backspace || key.delete) return "backspace";
  if (isPrintable(input, key)) return "insert";
  return undefined;
}

export function SelectList({
  items,
  onSubmit,
  multi = false,
  fuzzy = false,
  window = DEFAULT_WINDOW,
  autoFocus = true,
}: SelectListProps) {
  const [filter, setFilter] = useState("");
  const [selectionIndex, setSelectionIndex] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const { isFocused } = useFocus({ autoFocus });
  const theme = useTheoTheme();

  const view = deriveSelectList({
    items,
    filter,
    selectionIndex,
    window,
    fuzzy,
    selected,
  });
  const count = view.matches.length;

  const submit = (): void => {
    const values = multi
      ? [...selected]
      : count > 0
        ? [view.matches[view.clampedIndex]!.value]
        : [];
    onSubmit(values);
  };
  const toggleCurrent = (): void => {
    if (count === 0) return;
    const value = view.matches[view.clampedIndex]!.value;
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    setSelected(next);
  };
  const editFilter = (edit: (f: string) => string): void => {
    setFilter(edit);
    setSelectionIndex(0);
  };

  useInput(
    (input, key) => {
      switch (resolveSelectAction(input, key, multi)) {
        case "up":
          if (count > 0)
            setSelectionIndex((view.clampedIndex - 1 + count) % count);
          break;
        case "down":
          if (count > 0) setSelectionIndex((view.clampedIndex + 1) % count);
          break;
        case "submit":
          submit();
          break;
        case "toggle":
          toggleCurrent();
          break;
        case "backspace":
          editFilter((f) => f.slice(0, -1));
          break;
        case "insert":
          editFilter((f) => f + input);
          break;
        default:
          break;
      }
    },
    { isActive: isFocused },
  );

  const visible = view.matches.slice(
    view.windowStart,
    view.windowStart + window,
  );
  const counter = multi
    ? `${selected.size} selected`
    : count > 0
      ? `(${view.clampedIndex + 1}/${count})`
      : "(0/0)";

  return (
    <Box flexDirection="column">
      <Text dimColor>filter: {filter || "…"}</Text>
      {view.overflowUp && <Text dimColor>▲</Text>}
      {visible.map((item, index) => {
        const active = view.windowStart + index === view.clampedIndex;
        // The `❯` marker is the affordance that survives a monochrome theme
        // (chalk strips the accent color; the glyph remains — M6 degrade ladder).
        const marker = active ? "❯ " : "  ";
        const box = multi ? (selected.has(item.value) ? "◉ " : "◯ ") : "";
        return (
          <Box key={item.value}>
            <Text {...(active ? { color: theme.accent } : {})}>
              {marker}
              {box}
              {item.label}
            </Text>
            {item.description ? (
              <Text dimColor> {item.description}</Text>
            ) : null}
          </Box>
        );
      })}
      {view.overflowDown && <Text dimColor>▼</Text>}
      <Text dimColor>{counter}</Text>
    </Box>
  );
}
