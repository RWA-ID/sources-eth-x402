/**
 * Wallet signing helpers.
 *
 * Signing goes through AppKit's EIP-1193 provider rather than wagmi: wagmi 3.x
 * is installed but @reown/appkit-adapter-wagmi 1.8.19 builds connectors for the
 * wagmi 2.x API, and the first call into one dies with
 * "connector.getChainId is not a function". Its peer range admits 3.x, so
 * nothing warns and the build stays green.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/** Base mainnet. Inlined rather than imported from @reown/appkit/networks, which
 *  pulls its entire chain registry into whichever page imports it. */
export const BASE_CHAIN_ID = 8453;

export function toHex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** personal_sign via the connected wallet. Hex-encoded: unambiguous everywhere. */
export async function signMessage(
  provider: Eip1193Provider,
  message: string,
  address: string
): Promise<string> {
  const result = await provider.request({
    method: "personal_sign",
    params: [toHex(message), address],
  });
  return String(result);
}

/** Turns a wallet error into something worth showing a person. */
export function describeSignError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|4001/i.test(raw)) {
    return "Signature rejected in your wallet.";
  }
  return `Could not sign: ${raw.split("\n")[0].slice(0, 200)}`;
}
