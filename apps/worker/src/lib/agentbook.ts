import { createAgentBookVerifier } from "@worldcoin/agentkit";

/**
 * AgentBook lookup — resolves a wallet address to an anonymous World ID human.
 *
 * This used to be a hand-rolled eth_call against `humanOf(address)` on Base.
 * The on-chain function is actually `lookupHuman(address) -> uint256`, so every
 * call reverted, the revert was swallowed, and the Human Verified badge read
 * "not verified" for every agent from the day it shipped. Nobody noticed
 * because it failed open and a failed lookup was indistinguishable from an
 * honest negative.
 *
 * Use the SDK. The ABI, the deployment addresses and the chain-resolution
 * rules are theirs to change — AgentKit is still Beta — and hand-copying any
 * of the three is what broke it.
 */

/** Lookup resolves against the canonical World Chain deployment. */
const WORLD_MAINNET = "eip155:480";

export interface AgentBookResult {
  verified: boolean;
  humanId?: string;
  /**
   * Set only when the lookup could not be completed. `verified: false` with no
   * error means a real answer: this address is not registered. Keeping the two
   * apart is the whole point — conflating them is what hid the outage.
   */
  error?: string;
}

export async function lookupAgentBook(
  address: string,
  rpcUrl?: string
): Promise<AgentBookResult> {
  try {
    const agentBook = createAgentBookVerifier(rpcUrl ? { rpcUrl } : {});
    const humanId = await agentBook.lookupHuman(address, WORLD_MAINNET);

    if (!humanId || /^0x0*$/.test(humanId)) {
      return { verified: false };
    }
    return { verified: true, humanId };
  } catch (e) {
    // Still non-blocking: the badge is optional enrichment, not access
    // control, so a lookup failure must never stop someone listing an agent.
    // But it is now reported rather than silently becoming "not a human".
    const error = e instanceof Error ? e.message.slice(0, 200) : "lookup failed";
    console.error("AgentBook lookup failed", { address, error });
    return { verified: false, error };
  }
}
