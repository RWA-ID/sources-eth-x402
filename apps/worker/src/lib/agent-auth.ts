/**
 * Proof to a provider that sources.eth really did verify a payment.
 *
 * Until now the Worker forwarded `X-SOURCES-ETH: 1` — one constant string,
 * identical for every agent, hardcoded in a PUBLIC repo. Anyone could send it
 * straight to a provider's endpoint and get paid work for free, without
 * touching sources.eth at all. For a provider that already enforces x402,
 * listing here meant losing their paywall.
 *
 * Each agent now gets its own secret, and the Worker signs each forwarded
 * request with it. The secret never travels; the signature does.
 *
 * Signed payload is `${timestamp}.${txHash}`:
 *   - txHash is the payment we verified on Base, and markPaymentUsed() makes it
 *     single-use, so a captured signature dies with that payment. That binds
 *     replay far more tightly than hashing the body would, and it works
 *     identically for JSON and multipart forwards.
 *   - timestamp bounds how long a signature is worth capturing at all.
 *
 * The txHash is also forwarded in the clear, so a provider that would rather
 * not trust us can read the chain and verify the payment itself.
 */

const SECRET_BYTES = 32;

export const SIG_HEADER = "X-Sources-Eth-Signature";
export const TS_HEADER = "X-Sources-Eth-Timestamp";
export const TX_HEADER = "X-Sources-Eth-Tx";
/** Legacy, unauthenticated. Kept so existing agents keep working; see docs. */
export const LEGACY_HEADER = "X-SOURCES-ETH";

export function secretKey(ens: string): string {
  return `agent-secret:${ens}`;
}

export function generateAgentSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  return "sk_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256 over `${timestamp}.${txHash}`, hex encoded. */
export async function signForward(
  secret: string,
  timestamp: number,
  txHash: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = new TextEncoder().encode(`${timestamp}.${txHash}`);
  return toHex(await crypto.subtle.sign("HMAC", key, payload));
}

/**
 * Headers to attach when forwarding a paid request.
 *
 * An agent with no secret yet (everything registered before this shipped) gets
 * the legacy header alone, so nothing breaks mid-migration.
 */
export async function buildForwardHeaders(
  ens: string,
  txHash: string,
  kv: KVNamespace,
  base: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...base, [LEGACY_HEADER]: "1" };

  // The payment proof goes out even without a secret — it is public on-chain
  // data and lets any provider verify settlement independently.
  if (txHash) headers[TX_HEADER] = txHash;

  const secret = await kv.get(secretKey(ens));
  if (!secret || !txHash) return headers;

  const timestamp = Math.floor(Date.now() / 1000);
  headers[TS_HEADER] = String(timestamp);
  headers[SIG_HEADER] = `sha256=${await signForward(secret, timestamp, txHash)}`;
  return headers;
}
