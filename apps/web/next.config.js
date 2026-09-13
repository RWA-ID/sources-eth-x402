/** @type {import('next').NextConfig} */
const nextConfig = {
  // "output: export" is only enabled when building for IPFS deployment.
  // Run: NEXT_EXPORT=1 pnpm build
  ...(process.env.NEXT_EXPORT === "1" && {
    output: "export",
    trailingSlash: true,
  }),
  images: { unoptimized: true },
  webpack: (config) => {
    // These are optional wagmi connector peer deps not needed for our use case
    config.resolve.alias["porto/internal"] = false;
    config.resolve.alias["@walletconnect/ethereum-provider"] = false;
    config.resolve.alias["@coinbase/wallet-sdk"] = false;
    config.resolve.alias["@metamask/connect-evm"] = false;
    return config;
  },
};

module.exports = nextConfig;
