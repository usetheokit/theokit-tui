import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

export interface RoleTokens {
  /** Glyph prefix rendered before the message (gemini-cli idiom). */
  glyph: string;
  /** Color of the glyph prefix. */
  prefix: string;
  /** Color of the message text; `undefined` = terminal default color. */
  text: string | undefined;
}

/** Glyph + color pair (tool-status indicators — M6 D1). */
export interface GlyphToken {
  glyph: string;
  color: string;
}

/** Syntax-highlight bucket colors (M6 D1 — the hljs class→bucket table stays
 * module-local in code-block.tsx; the theme carries only the 7 bucket colors). */
export interface CodeTokens {
  keyword: string;
  builtin: string;
  number: string;
  string: string;
  regexp: string;
  comment: string;
  variable: string;
}

/** Tool-status visuals. `running` carries NO glyph — ink-spinner animates it
 * (a never-rendered token would be fabricated API — M6 D1). */
export interface ToolStatusTokens {
  pending: GlyphToken;
  running: { color: string };
  success: GlyphToken;
  failed: GlyphToken;
}

export interface TheoTheme {
  /**
   * Theme identity: a built-in name ("dark" | "light" | "no-color") or
   * "custom" when a non-empty override is applied. Degrade-as-data seam —
   * components may branch on `name === "no-color"` instead of reading env.
   */
  name: string;
  role: {
    user: RoleTokens;
    assistant: RoleTokens;
    system: RoleTokens;
  };
  status: {
    error: string;
    success: string;
    warning: string;
  };
  /** Neutral metrics accent (gauge/chart fill below the warning threshold). */
  accent: string;
  code: CodeTokens;
  /**
   * Note (M6): `pending.color` is a literal — it no longer aliases
   * `role.system.prefix`; theming the system role does NOT recolor the
   * pending glyph (theme `toolStatus.pending.color` instead).
   */
  toolStatus: ToolStatusTokens;
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
    system?: Partial<RoleTokens>;
  };
  status?: Partial<TheoTheme["status"]>;
  accent?: string;
  code?: Partial<CodeTokens>;
  toolStatus?: {
    pending?: Partial<GlyphToken>;
    running?: Partial<{ color: string }>;
    success?: Partial<GlyphToken>;
    failed?: Partial<GlyphToken>;
  };
}

export const defaultTheme: TheoTheme = Object.freeze({
  name: "dark",
  role: Object.freeze({
    user: Object.freeze({ glyph: "> ", prefix: "cyan", text: undefined }),
    assistant: Object.freeze({
      glyph: "✦ ",
      prefix: "magenta",
      text: undefined,
    }),
    system: Object.freeze({ glyph: "· ", prefix: "gray", text: undefined }),
  }),
  status: Object.freeze({ error: "red", success: "green", warning: "yellow" }),
  // M6 growth — values are BYTE-IDENTICAL to the M0-M5 module constants
  // they replace (plan D1/D5: zero snapshot churn by construction).
  accent: "cyan",
  code: Object.freeze({
    keyword: "blue",
    builtin: "cyan",
    number: "green",
    string: "yellow",
    regexp: "red",
    comment: "gray",
    variable: "magenta",
  }),
  toolStatus: Object.freeze({
    pending: Object.freeze({ glyph: "o", color: "gray" }),
    running: Object.freeze({ color: "yellow" }),
    success: Object.freeze({ glyph: "✓", color: "green" }),
    failed: Object.freeze({ glyph: "x", color: "red" }),
  }),
});

const ThemeContext = createContext<TheoTheme>(defaultTheme);

function mergeToolStatus(
  base: ToolStatusTokens,
  override: TheoThemeOverride["toolStatus"],
): ToolStatusTokens {
  return {
    pending: { ...base.pending, ...override?.pending },
    running: { ...base.running, ...override?.running },
    success: { ...base.success, ...override?.success },
    failed: { ...base.failed, ...override?.failed },
  };
}

function mergeTheme(override: TheoThemeOverride | undefined): TheoTheme {
  // Empty object ≡ no override — the theme identity stays the base's
  // (form-based `name` semantics: "custom" only for a NON-EMPTY override).
  if (override === undefined || Object.keys(override).length === 0) {
    return defaultTheme;
  }
  return {
    name: "custom",
    role: {
      user: { ...defaultTheme.role.user, ...override.role?.user },
      assistant: {
        ...defaultTheme.role.assistant,
        ...override.role?.assistant,
      },
      system: { ...defaultTheme.role.system, ...override.role?.system },
    },
    status: { ...defaultTheme.status, ...override.status },
    accent: override.accent ?? defaultTheme.accent,
    code: { ...defaultTheme.code, ...override.code },
    toolStatus: mergeToolStatus(defaultTheme.toolStatus, override.toolStatus),
  };
}

/**
 * Nesting note (M0 semantics): a nested provider RESETS to
 * `defaultTheme + own override` — it does not compose with ancestor
 * providers. Composition arrives with the M6 theme system.
 */
export function TheoTUIProvider({
  theme,
  children,
}: {
  theme?: TheoThemeOverride | undefined;
  children: ReactNode;
}) {
  // Referentially stable context value — a fresh object per render would
  // re-render every consumer on each provider render (review F-dom-1).
  const value = useMemo(() => mergeTheme(theme), [theme]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Never returns `undefined` — falls back to `defaultTheme` without a provider. */
export function useTheoTheme(): TheoTheme {
  return useContext(ThemeContext);
}
