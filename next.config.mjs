/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static site: `npm run build` writes everything to out/, which any free static host can serve.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
