// Public barrel for the chat domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

// #41 bridge: makes the custom-renderer interactive components (ChoiceRow,
// SelectList, Pager, FreeTextInput, and the decision prompts) receive keyboard
// input under pure Ink's `render`. Mount once, high in the tree.
export { InkInputProvider } from "./ink-input-provider.js";

export type { InkInputProviderProps } from "./ink-input-provider.js";

export { CHAT_ROLES, ChatMessage } from "./chat-message.js";

export type { ChatMessageProps, ChatRole } from "./chat-message.js";

export { ChatThread } from "./chat-thread.js";

export type { ChatThreadMessage, ChatThreadProps } from "./chat-thread.js";

export { ChatComposer } from "./chat-composer.js";

export type {
  ChatComposerCommand,
  ChatComposerProps,
} from "./chat-composer.js";

export { initialTextBuffer, textBufferReducer } from "./text-buffer.js";

export type { TextBufferAction, TextBufferState } from "./text-buffer.js";

export { FreeTextInput } from "./free-text-input.js";

export type { FreeTextInputProps } from "./free-text-input.js";
