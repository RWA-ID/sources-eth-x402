import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "d081af818c7b048be184e94026b9f26f";

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
