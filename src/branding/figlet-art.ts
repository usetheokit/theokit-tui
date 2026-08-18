import stringWidth from "string-width";

// M27 figlet-art (plan ascii-banner-header T1.1/T3.1): a pure width helper +
// an OPTIONAL-peer figlet generator. `figlet` is NOT a runtime dependency — it
// is declared in `peerDependenciesMeta` as optional and loaded via a dynamic
// import that degrades to `null` when absent (the CodeBlock/highlighter idiom).
// The component never imports figlet; the app calls `renderFigletArt` and passes
// the result as `<Banner art={…} />` (or falls back to the bold `name`).

/** The display width of ASCII art — the widest line via `string-width` (EAW /
 * grapheme aware, the repo oracle). Empty art is 0. */
export function bannerArtWidth(art: string): number {
  if (art === "") {
    return 0;
  }
  return Math.max(...art.split("\n").map((line) => stringWidth(line)));
}

/** The subset of the `figlet` module surface this helper needs (DIP seam). */
export interface FigletLike {
  textSync(
    text: string,
    options?: { font?: string; width?: number; whitespaceBreak?: boolean },
  ): string;
}

/** Loader for the figlet module — injectable so a test can exercise the
 * present-path without a hard dependency. Defaults to a dynamic import. */
export type FigletLoader = () => Promise<FigletLike>;

const defaultLoader: FigletLoader = async () => {
  // A VARIABLE specifier — not a literal — so the type-checker/bundler does NOT
  // try to resolve `figlet` at build time (it is a truly-optional peer, not even
  // installed in dev). At runtime the import throws when the peer is absent and
  // `renderFigletArt`'s try/catch degrades to null. The `as` bridges the module.
  const spec = "figlet";
  const mod = (await import(/* @vite-ignore */ spec)) as unknown as {
    default?: FigletLike;
  } & FigletLike;
  return mod.default ?? mod;
};

/**
 * Generate ASCII art from `text` via the OPTIONAL `figlet` peer. Returns the
 * art string, or `null` when figlet is not installed (import fails) OR the font
 * is unknown (`textSync` throws) — never throws, so a missing peer / bad font
 * degrades to the caller's `name` path. `loader` is injectable for tests.
 */
export async function renderFigletArt(
  text: string,
  font?: string,
  loader: FigletLoader = defaultLoader,
): Promise<string | null> {
  let figlet: FigletLike;
  try {
    figlet = await loader();
  } catch {
    return null; // optional peer absent
  }
  try {
    return figlet.textSync(text, {
      ...(font !== undefined ? { font } : {}),
      width: 80,
      whitespaceBreak: true,
    });
  } catch {
    return null; // unknown font / render error
  }
}
