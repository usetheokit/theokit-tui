import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";

import { unionMessage } from "../agent/union-message.js";
import { reportGuardFailure } from "../status/guard-sink.js";

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
   * "custom" when a non-empty override is applied. Identity is FORM-based —
   * degrade-aware components must branch on `isMonochrome(theme)` (data),
   * never on this name (a customized no-color base reads "custom" while
   * still rendering colorless — review arch-2/dom-frontend-1).
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
  /** Full-width row backgrounds for `DiffViewer background` (Claude-Code-style
   * diff). Empty string disables the background (monochrome degrade). */
  diff: {
    addedBg: string;
    removedBg: string;
  };
  /**
   * Note (M6): `pending.color` is a literal — it no longer aliases
   * `role.system.prefix`; theming the system role does NOT recolor the
   * pending glyph (theme `toolStatus.pending.color` instead).
   */
  toolStatus: ToolStatusTokens;
}

/**
 * Two-level partial override accepted by `<TheoTUIProvider theme>`.
 * Hand-rolled leaf-level merge per group (overriding one leaf preserves its
 * siblings) — the SETTLED contract (M6 plan D2 rejected a deepmerge dep:
 * ~20 lines cover the closed tree and deepmerge's array-concat is a
 * documented foot-gun).
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
  diff?: Partial<TheoTheme["diff"]>;
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
      glyph: "⏺  ",
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
  // Claude-Code-style diff row tints (truecolor; 256-color nearest is fine —
  // the +/- signs remain the color-independent mechanism).
  diff: Object.freeze({ addedBg: "#1e3a1e", removedBg: "#4b1a1a" }),
  toolStatus: Object.freeze({
    pending: Object.freeze({ glyph: "⏺", color: "gray" }),
    running: Object.freeze({ color: "yellow" }),
    success: Object.freeze({ glyph: "⏺", color: "green" }),
    failed: Object.freeze({ glyph: "⏺", color: "red" }),
  }),
});

// Single source for the built-in name union (review arch-4 — the tool-call
// TOOL_CALL_STATUSES idiom): type, runtime guard and error message all
// derive from this array; a new built-in touches it exactly once.
const BUILTIN_THEME_NAMES = ["dark", "light", "no-color"] as const;

export type TheoBuiltinThemeName = (typeof BUILTIN_THEME_NAMES)[number];

const BUILTIN_UNION_MESSAGE = unionMessage(BUILTIN_THEME_NAMES);

/** Light-terminal palette (named ANSI-16 only — plan D3; seeded from the
 * gemini ansi-light slot choices: bright-yellow/cyan-on-white avoided). */
const lightTheme: TheoTheme = Object.freeze({
  name: "light",
  role: Object.freeze({
    user: Object.freeze({ glyph: "> ", prefix: "blue", text: undefined }),
    assistant: Object.freeze({
      glyph: "⏺  ",
      prefix: "magenta",
      text: undefined,
    }),
    system: Object.freeze({ glyph: "· ", prefix: "gray", text: undefined }),
  }),
  status: Object.freeze({ error: "red", success: "green", warning: "yellow" }),
  accent: "blue",
  code: Object.freeze({
    keyword: "blue",
    builtin: "magenta",
    number: "green",
    string: "red",
    regexp: "magenta",
    comment: "gray",
    variable: "blue",
  }),
  // GitHub-web-style light tints (same degrade story as dark).
  diff: Object.freeze({ addedBg: "#dafbe1", removedBg: "#ffebe9" }),
  toolStatus: Object.freeze({
    pending: Object.freeze({ glyph: "⏺", color: "gray" }),
    running: Object.freeze({ color: "yellow" }),
    success: Object.freeze({ glyph: "⏺", color: "green" }),
    failed: Object.freeze({ glyph: "⏺", color: "red" }),
  }),
});

/** Degrade-as-data (gemini no-color pattern): every color slot empty — Ink
 * renders unstyled; glyphs (the color-independent channel) preserved. */
const noColorTheme: TheoTheme = Object.freeze({
  name: "no-color",
  role: Object.freeze({
    user: Object.freeze({ glyph: "> ", prefix: "", text: undefined }),
    assistant: Object.freeze({ glyph: "⏺  ", prefix: "", text: undefined }),
    system: Object.freeze({ glyph: "· ", prefix: "", text: undefined }),
  }),
  status: Object.freeze({ error: "", success: "", warning: "" }),
  accent: "",
  code: Object.freeze({
    keyword: "",
    builtin: "",
    number: "",
    string: "",
    regexp: "",
    comment: "",
    variable: "",
  }),
  // Monochrome: no backgrounds — the +/- signs carry the semantics.
  diff: Object.freeze({ addedBg: "", removedBg: "" }),
  toolStatus: Object.freeze({
    pending: Object.freeze({ glyph: "⏺", color: "" }),
    running: Object.freeze({ color: "" }),
    success: Object.freeze({ glyph: "⏺", color: "" }),
    failed: Object.freeze({ glyph: "⏺", color: "" }),
  }),
});

/** Built-in themes (frozen module singletons — referential stability free). */
export const themes: Readonly<Record<TheoBuiltinThemeName, TheoTheme>> = Object.freeze({
  dark: defaultTheme,
  light: lightTheme,
  "no-color": noColorTheme,
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

function mergeTheme(base: TheoTheme, override: TheoThemeOverride | undefined): TheoTheme {
  // Empty object ≡ no override — the theme identity stays the base's
  // (form-based `name` semantics: "custom" only for a NON-EMPTY override).
  if (override === undefined || Object.keys(override).length === 0) {
    return base;
  }
  return {
    name: "custom",
    role: {
      user: { ...base.role.user, ...override.role?.user },
      assistant: {
        ...base.role.assistant,
        ...override.role?.assistant,
      },
      system: { ...base.role.system, ...override.role?.system },
    },
    status: { ...base.status, ...override.status },
    accent: override.accent ?? base.accent,
    code: { ...base.code, ...override.code },
    diff: { ...base.diff, ...override.diff },
    toolStatus: mergeToolStatus(base.toolStatus, override.toolStatus),
  };
}

/** Union accepted by the provider `theme` prop (plan D2 — every M0-M5 call
 * site compiles and behaves identically; the base is EXPLICIT, never the
 * ambient active theme). */
export type TheoThemeProp =
  | TheoThemeOverride
  | TheoBuiltinThemeName
  | { base?: TheoBuiltinThemeName; override?: TheoThemeOverride };

function isBuiltinName(value: string): value is TheoBuiltinThemeName {
  return (BUILTIN_THEME_NAMES as readonly string[]).includes(value);
}

function isPairForm(
  value: object,
): value is { base?: TheoBuiltinThemeName; override?: TheoThemeOverride } {
  return "base" in value || "override" in value;
}

function assertBuiltinName(name: string): void {
  if (!isBuiltinName(name)) {
    reportGuardFailure(
      "TheoTUIProvider",
      new TypeError(`TheoTUIProvider: unknown theme "${name}" — expected ${BUILTIN_UNION_MESSAGE}`),
    );
  }
}

function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPairForm(pair: { base?: TheoBuiltinThemeName; override?: TheoThemeOverride }): void {
  for (const key of Object.keys(pair)) {
    if (key !== "base" && key !== "override") {
      reportGuardFailure(
        "TheoTUIProvider",
        new TypeError(`TheoTUIProvider: unknown key "${key}" in {base, override} theme form`),
      );
    }
  }
  if (pair.base !== undefined) {
    assertBuiltinName(pair.base);
  }
  // review arch-1: an unvalidated override (null/string/array) would reach
  // mergeTheme and throw the ENGINE's TypeError — breaking the EC-5 contract
  // (or silently mislabel base values as "custom" for a string).
  if (pair.override !== undefined && !isPlainObject(pair.override)) {
    reportGuardFailure(
      "TheoTUIProvider",
      new TypeError(
        `TheoTUIProvider: theme must be a built-in name or an override object — got ${Array.isArray(pair.override) ? "array" : String(pair.override)} as override`,
      ),
    );
  }
}

/** Type/shape guards — run BEFORE hooks (F10 idiom) so direct invocation
 * throws OUR typed error, never the engine's (EC-5). */
function assertThemeProp(theme: TheoThemeProp | undefined): void {
  if (theme === undefined) {
    return;
  }
  if (typeof theme === "string") {
    assertBuiltinName(theme);
    return;
  }
  if (theme === null || typeof theme !== "object" || Array.isArray(theme)) {
    reportGuardFailure(
      "TheoTUIProvider",
      new TypeError(
        `TheoTUIProvider: theme must be a built-in name or an override object — got ${Array.isArray(theme) ? "array" : String(theme)}`,
      ),
    );
  }
  if (isPairForm(theme)) {
    assertPairForm(theme);
  }
}

/**
 * Resolution (plan D2/D4): NO_COLOR (non-empty — the vitest `NO_COLOR: ""`
 * pin means NOT set) wins over ANY prop with FULL-swap semantics (glyph
 * overrides revert to the tested-readable defaults too — documented);
 * then name / {base, override} / plain-override (M0 path, base dark).
 * NO_COLOR handling lives HERE — the installed ink→chalk chain never reads
 * it, so provider-less usage gets no NO_COLOR support (documented).
 */
function resolveTheme(theme: TheoThemeProp | undefined): TheoTheme {
  if (process.env.NO_COLOR) {
    return noColorTheme;
  }
  if (theme === undefined) {
    return defaultTheme;
  }
  if (typeof theme === "string") {
    return themes[theme];
  }
  if (isPairForm(theme)) {
    return mergeTheme(themes[theme.base ?? "dark"], theme.override);
  }
  return mergeTheme(defaultTheme, theme);
}

/**
 * Nesting note (SETTLED — M6 plan D2): a nested provider RESETS to its OWN
 * resolved base + override; it never composes with ancestor providers (the
 * base of a partial override is explicit, never ambient).
 *
 * Referential-stability note (review dom-frontend-5): the value is memoized
 * on `[theme]` — pass a HOISTED override object (or a built-in name); an
 * inline object literal re-merges and re-renders every consumer per parent
 * render.
 */
export function TheoTUIProvider({
  theme,
  children,
}: {
  theme?: TheoThemeProp | undefined;
  children: ReactNode;
}) {
  // Shape guards FIRST, before hooks (F10 idiom — EC-5 typed errors).
  assertThemeProp(theme);
  // Referentially stable context value — a fresh object per render would
  // re-render every consumer on each provider render (review F-dom-1).
  // resolveTheme reads NO_COLOR here (once per mount/prop-change — never
  // per frame; the swap is testable in-process via a fresh mount).
  const value = useMemo(() => resolveTheme(theme), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Never returns `undefined` — falls back to `defaultTheme` without a provider. */
export function useTheoTheme(): TheoTheme {
  return useContext(ThemeContext);
}

/**
 * TRUE when every color slot of the theme is empty — the DATA-derived
 * degrade predicate (review arch-2/dom-frontend-1: branching on
 * `name === "no-color"` loses degrade behavior for any CUSTOMIZED no-color
 * base, whose name reads "custom"). Components branch on this, never on env
 * and never on the identity string. Module export — NOT on the package entry.
 */
export function isMonochrome(theme: TheoTheme): boolean {
  const colors: string[] = [
    theme.role.user.prefix,
    theme.role.assistant.prefix,
    theme.role.system.prefix,
    ...Object.values(theme.status),
    theme.accent,
    ...Object.values(theme.code),
    theme.toolStatus.pending.color,
    theme.toolStatus.running.color,
    theme.toolStatus.success.color,
    theme.toolStatus.failed.color,
  ];
  for (const role of Object.values(theme.role)) {
    if (role.text !== undefined) {
      colors.push(role.text);
    }
  }
  return colors.every((color) => color === "");
}
