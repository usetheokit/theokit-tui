export const VERSION = "0.1.0";

export { TheoTUIProvider, defaultTheme, useTheoTheme } from "./theme.js";
export type { RoleTokens, TheoTheme, TheoThemeOverride } from "./theme.js";

export { ChatMessage } from "./chat-message.js";
export type { ChatMessageProps, ChatRole } from "./chat-message.js";

export { ChatThread } from "./chat-thread.js";
export type { ChatThreadMessage, ChatThreadProps } from "./chat-thread.js";

export { ChatComposer } from "./chat-composer.js";
export type { ChatComposerProps } from "./chat-composer.js";
export { initialTextBuffer, textBufferReducer } from "./text-buffer.js";
export type { TextBufferAction, TextBufferState } from "./text-buffer.js";
