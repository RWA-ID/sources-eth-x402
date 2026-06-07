import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "43bdd1b8c477ac4d4a4264a14a8472f8";

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [base];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

export const appKitMetadata = {
  name: "sources.eth",
  description: "Decentralized AI agent marketplace powered by x402 micropayments",
  url: "https://sources.eth.limo",
  icons: ["https://sources.eth.limo/icon.png"],
};
