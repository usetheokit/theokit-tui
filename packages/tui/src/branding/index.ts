// Public barrel for the branding domain (ADR 0001 / ADR 0002).
// src/index.ts re-exports this file; anything NOT listed here is
// module-internal by construction rather than by comment.

export type { BannerProps, BannerStatusRow } from "./banner.js";
// M27 — ASCII-art banner header. <Banner> is pure/sync (renders a provided `art`
// string or degrades to the bold name); `renderFigletArt` generates art via an
// OPTIONAL `figlet` peer (degrades to null when absent).
export { Banner } from "./banner.js";
export type { FigletLike, FigletLoader } from "./figlet-art.js";
export { bannerArtWidth, renderFigletArt } from "./figlet-art.js";
export type { ImageProps } from "./image.js";
export { Image } from "./image.js";
export type { WelcomeBannerProps } from "./welcome-banner.js";
// M9 — welcome banner (plan ADR D1): the startup-banner primitive.
export { WelcomeBanner } from "./welcome-banner.js";
