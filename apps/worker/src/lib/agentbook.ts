/**
 * AgentBook lookup — checks if a wallet address is registered as a
 * human-verified agent via the World ID Agent Kit on Base mainnet.
 *
 * We call the AgentBook contract directly via eth_call to avoid
 * Node.js-specific runtime dependencies in the Cloudflare Worker.
 *
 * AgentBook on Base: 0xE1D1D3526A6FAa37eb36bD10B933C1b77f4561a4
 * Function: humanOf(address payable) → bytes32
 *   Returns the humanId (non-zero bytes32) if registered, zero bytes32 if not.
 */

const AGENTBOOK_BASE = "0xE1D1D3526A6FAa37eb36bD10B933C1b77f4561a4";

// keccak256("humanOf(address)") = first 4 bytes
// Precomputed: 0x1b9265b8
const HUMAN_OF_SELECTOR = "0x1b9265b8";

function encodeAddress(address: string): string {
  // ABI encode address: 12 zero bytes + 20-byte address (32 bytes total)
  return address.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function isNonZeroBytes32(hex: string): boolean {
  return /[1-9a-f]/.test(hex.replace(/^0x/, ""));
}

export interface AgentBookResult {
  verified: boolean;
  humanId?: string;
}

export async function lookupAgentBook(
  address: string,
  rpcUrl: string
): Promise<AgentBookResult> {
  try {
    const calldata = HUMAN_OF_SELECTOR + encodeAddress(address);

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          { to: AGENTBOOK_BASE, data: calldata },
          "latest",
        ],
        id: 1,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    const data = await res.json() as { result?: string; error?: unknown };

    if (!data.result || !isNonZeroBytes32(data.result)) {
      return { verified: false };
    }

    return { verified: true, humanId: data.result };
  } catch {
    // Network failure or timeout — fail open (don't block registration)
    return { verified: false };
  }
}
