// Internal shared helper (rule-of-3 — chat-message, tool-call,
// agent-timeline all build "expected ..." union listings). NOT on the
// public entry.
export const unionMessage = (values: readonly string[]): string =>
  values.map((value) => `"${value}"`).join(" | ");
