// The site can live under a sub-path (GitHub Pages: /Bibliotheca). Set by NEXT_PUBLIC_BASE_PATH at build time.
export const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** Prefixes a site-absolute path ("/covers/x.jpg") with the base path; leaves full URLs alone. */
export const withBase = (p: string) => (p.startsWith("/") && !p.startsWith("//") ? BASE + p : p);
