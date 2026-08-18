// Public barrel for the theme domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export {
  TheoTUIProvider,
  defaultTheme,
  themes,
  useTheoTheme,
} from "./theme.js";

export type {
  CodeTokens,
  GlyphToken,
  RoleTokens,
  TheoBuiltinThemeName,
  TheoTheme,
  TheoThemeOverride,
  TheoThemeProp,
  ToolStatusTokens,
} from "./theme.js";
