/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static site: `npm run build` writes everything to out/, which any free static host can serve.
  output: "export",
  // GitHub Pages serves the site under /Bibliotheca (set in .github/workflows/pages.yml); empty locally
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
