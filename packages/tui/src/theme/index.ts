// Public barrel for the theme domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export type {
  CodeTokens,
  GlyphToken,
  RoleTokens,
  TheoBuiltinThemeName,
  TheoTheme,
  TheoThemeOverride,
  TheoThemeProp,
  ThemeController,
  ThemePersistence,
  ToolStatusTokens,
} from "./theme.js";
export {
  createThemeController,
  defaultTheme,
  resolveThemeFromEnv,
  TheoTUIProvider,
  themes,
  useTheoTheme,
} from "./theme.js";
