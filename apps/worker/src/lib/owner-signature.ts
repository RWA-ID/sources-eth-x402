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

/**
 * Shared core: shape, freshness, single-use nonce, then the signature itself.
 * `message` is whatever the caller expects the wallet to have signed, so the
 * same guarantees apply to registration and to secret requests.
 */
export async function verifySignedMessage(
  message: string,
  address: string,
  sig: OwnerSignature | undefined,
  env: Env,
  walletLabel = "the expected wallet"
): Promise<SignatureCheck> {
  if (!sig || typeof sig !== "object") {
    return { valid: false, error: "owner_signature is required: sign with your payout wallet" };
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
  if (age > MAX_SIGNATURE_AGE_MS) return { valid: false, error: "Signature has expired — sign again" };
  if (age < -MAX_SIGNATURE_FUTURE_MS) {
    return { valid: false, error: "Signature is dated in the future — check your system clock" };
  }

  const nonceKey = `sig-nonce:${sig.nonce}`;
  if (await env.AGENTS_KV.get(nonceKey)) {
    return { valid: false, error: "This signature has already been used — sign again" };
  }

  let ok: boolean;
  try {
    ok = await verifyEVMSignature(message, address, sig.signature, "eip155:8453", env.BASE_RPC_URL);
  } catch {
    return { valid: false, error: "Could not verify signature — try again shortly" };
  }
  if (!ok) return { valid: false, error: `Signature does not match ${walletLabel}` };

  await env.AGENTS_KV.put(nonceKey, "1", { expirationTtl: NONCE_TTL_SECONDS });
  return { valid: true };
}

export async function verifyOwnerSignature(
  body: Partial<AgentManifest> & { owner_signature?: OwnerSignature },
  plan: "trial" | "permanent",
  env: Env
): Promise<SignatureCheck> {
  const sig = body.owner_signature;
  const message = buildRegistrationMessage({
    ens: body.ens!,
    endpoint: body.endpoint!,
    payment_address: body.payment_address!,
    plan,
    nonce: sig?.nonce ?? "",
    issued_at: sig?.issued_at ?? 0,
  });
  const res = await verifySignedMessage(message, body.payment_address!, sig, env, "payment_address");
  // Keep the original wording for the missing-signature case; it tells the
  // builder what to do, not just what was wrong.
  if (!res.valid && !sig) {
    return { valid: false, error: "owner_signature is required: sign the listing with your payout wallet" };
  }
  return res;
}

/** Authorization, not listing content — never pin it. */
export function stripOwnerSignature<T extends object>(body: T): Omit<T, "owner_signature"> {
  const { owner_signature: _drop, ...rest } = body as T & { owner_signature?: unknown };
  return rest;
}
