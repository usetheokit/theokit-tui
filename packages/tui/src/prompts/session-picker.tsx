import { SelectList, type SelectListProps } from "./select-list.js";

/** One resumable session. `lastActivity` is caller-formatted text (no date/locale policy here). */
export interface SessionPickerItem {
  id: string;
  title: string;
  lastActivity: string;
}

export interface SessionPickerProps
  extends Pick<SelectListProps, "window" | "gap" | "autoFocus" | "initialSelectionIndex"> {
  sessions: readonly SessionPickerItem[];
  /** Called with the chosen session's id on Enter. Not called when the filter matches nothing. */
  onSelect: (id: string) => void;
}

/** #269 — pick a session to resume: arrows move, typing filters titles (fuzzy), Enter selects. */
export function SessionPicker({ sessions, onSelect, ...rest }: SessionPickerProps) {
  const items = sessions.map((s) => ({
    value: s.id,
    label: s.title,
    description: s.lastActivity,
  }));
  return (
    <SelectList
      {...rest}
      items={items}
      fuzzy
      onSubmit={(values) => {
        const id = values[0];
        if (id !== undefined) onSelect(id);
      }}
    />
  );
}
