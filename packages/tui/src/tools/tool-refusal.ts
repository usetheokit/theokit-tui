/**
 * Why a tool call was refused before it ran. It lives in a module of its own because both the
 * agent events and the `ToolCall` component name it, and each importing the other's module would
 * be a cycle.
 */
export interface ToolRefusal {
  by: "human" | "policy" | "hook" | "timeout";
  reason?: string;
}
