import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export interface RoleTokens {
  /** Glyph prefix rendered before the message (gemini-cli idiom). */
  glyph: string;
  /** Color of the glyph prefix. */
  prefix: string;
  /** Color of the message text; `undefined` = terminal default color. */
  text: string | undefined;
}

export interface TheoTheme {
  role: {
    user: RoleTokens;
    assistant: RoleTokens;
  };
  status: {
    error: string;
    success: string;
    warning: string;
  };
}

/**
 * Two-level partial override accepted by `<TheoTUIProvider theme>`.
 * Hand-rolled (no deepmerge dep at M0 — plan ADR D5); the merge is leaf-level
 * per role/status group (overriding one leaf preserves its siblings).
 * Recursive deepmerge is deferred to the M6 theme system.
 */
export interface TheoThemeOverride {
  role?: {
    user?: Partial<RoleTokens>;
    assistant?: Partial<RoleTokens>;
  };
  status?: Partial<TheoTheme["status"]>;
}

export const defaultTheme: TheoTheme = {
  role: {
    user: { glyph: "> ", prefix: "cyan", text: undefined },
    assistant: { glyph: "✦ ", prefix: "magenta", text: undefined },
  },
  status: { error: "red", success: "green", warning: "yellow" },
};

const ThemeContext = createContext<TheoTheme>(defaultTheme);

function mergeTheme(override: TheoThemeOverride | undefined): TheoTheme {
  if (override === undefined) {
    return defaultTheme;
  }
  return {
    role: {
      user: { ...defaultTheme.role.user, ...override.role?.user },
      assistant: {
        ...defaultTheme.role.assistant,
        ...override.role?.assistant,
      },
    },
    status: { ...defaultTheme.status, ...override.status },
  };
}

export function TheoTUIProvider({
  theme,
  children,
}: {
  theme?: TheoThemeOverride | undefined;
  children: ReactNode;
}) {
  return (
    <ThemeContext.Provider value={mergeTheme(theme)}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Never returns `undefined` — falls back to `defaultTheme` without a provider. */
export function useTheoTheme(): TheoTheme {
  return useContext(ThemeContext);
}
