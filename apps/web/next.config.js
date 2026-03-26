/** @type {import('next').NextConfig} */
const nextConfig = {
  // "output: export" is only enabled when building for IPFS deployment.
  // Run: NEXT_EXPORT=1 pnpm build
  ...(process.env.NEXT_EXPORT === "1" && {
    output: "export",
    trailingSlash: true,
  }),
  images: { unoptimized: true },
};

module.exports = nextConfig;
