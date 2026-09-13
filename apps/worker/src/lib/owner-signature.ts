import { verifyEVMSignature } from "@worldcoin/agentkit";
import {
  buildRegistrationMessage,
  type AgentManifest,
  type OwnerSignature,
} from "@sources-eth/agent-manifest";
import type { Env } from "./registry";

// Re-exported so existing worker imports keep working; the definitions live in
// the shared package because the browser signs exactly what we verify.
export { buildRegistrationMessage };
export type { OwnerSignature };

/**
 * Proof that the person registering a listing actually controls the wallet
 * they are pointing payouts at.
 *
 * Before this existed, `payment_address` was asserted and never proven, and
 * the manifest is public on IPFS — so anyone could read a listing's payout
 * address, re-submit the listing with that address and their own endpoint,
 * and silently take over where every paid request was routed.
 *
 * The signed message is bound to ens + endpoint + payout + plan, so a
 * signature is worthless anywhere other than the exact listing it authorised.
 */

/** Accept a little clock skew in both directions, but keep the window tight. */
export const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;
export const MAX_SIGNATURE_FUTURE_MS = 2 * 60 * 1000;
/** Longer than the validity window, so a replay inside it still finds the nonce. */
const NONCE_TTL_SECONDS = 3600;

export interface SignatureCheck {
  valid: boolean;
  error?: string;
}

export async function verifyOwnerSignature(
  body: Partial<AgentManifest> & { owner_signature?: OwnerSignature },
  plan: "trial" | "permanent",
  env: Env
): Promise<SignatureCheck> {
  const sig = body.owner_signature;

  if (!sig || typeof sig !== "object") {
    return { valid: false, error: "owner_signature is required: sign the listing with your payout wallet" };
  }
  if (typeof sig.signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(sig.signature)) {
    return { valid: false, error: "owner_signature.signature must be a 0x-prefixed hex string" };
  }
  if (typeof sig.nonce !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(sig.nonce)) {
    return { valid: false, error: "owner_signature.nonce must be 8-128 URL-safe characters" };
  }
  if (typeof sig.issued_at !== "number" || !Number.isFinite(sig.issued_at)) {
    return { valid: false, error: "owner_signature.issued_at must be a unix timestamp in milliseconds" };
  }

  const age = Date.now() - sig.issued_at;
  if (age > MAX_SIGNATURE_AGE_MS) {
    return { valid: false, error: "Signature has expired — sign again" };
  }
  if (age < -MAX_SIGNATURE_FUTURE_MS) {
    return { valid: false, error: "Signature is dated in the future — check your system clock" };
  }

  // Replay: a nonce is good exactly once, even inside its validity window.
  const nonceKey = `sig-nonce:${sig.nonce}`;
  if (await env.AGENTS_KV.get(nonceKey)) {
    return { valid: false, error: "This signature has already been used — sign again" };
  }

  const message = buildRegistrationMessage({
    ens: body.ens!,
    endpoint: body.endpoint!,
    payment_address: body.payment_address!,
    plan,
    nonce: sig.nonce,
    issued_at: sig.issued_at,
  });

  let ok: boolean;
  try {
    // Covers EOAs (ecrecover) and smart wallets (ERC-1271). Base is the only
    // chain the marketplace settles on, so it is the only chain we verify against.
    ok = await verifyEVMSignature(
      message,
      body.payment_address!,
      sig.signature,
      "eip155:8453",
      env.BASE_RPC_URL
    );
  } catch {
    // Fail CLOSED. A verification we could not complete is not a pass — that
    // mistake is what left the World badge silently broken.
    return { valid: false, error: "Could not verify signature — try again shortly" };
  }

  if (!ok) {
    return { valid: false, error: "Signature does not match payment_address" };
  }

  await env.AGENTS_KV.put(nonceKey, "1", { expirationTtl: NONCE_TTL_SECONDS });
  return { valid: true };
}

/** Authorization, not listing content — never pin it. */
export function stripOwnerSignature<T extends object>(body: T): Omit<T, "owner_signature"> {
  const { owner_signature: _drop, ...rest } = body as T & { owner_signature?: unknown };
  return rest;
}
