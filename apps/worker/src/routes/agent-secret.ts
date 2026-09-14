import type { AgentManifest } from "@sources-eth/agent-manifest";
import { buildSecretMessage } from "@sources-eth/agent-manifest";
import type { Env } from "../lib/registry";
import { verifySignedMessage, type OwnerSignature } from "../lib/owner-signature";
import { generateAgentSecret, secretKey } from "../lib/agent-auth";

/**
 * POST /agent-secret — issue or rotate an agent's forwarding secret.
 *
 * Everything registered before signed forwarding shipped has no secret, and a
 * secret that has leaked needs replacing. Both are the same operation: prove
 * control of the listing's payout wallet, receive a fresh secret, and the old
 * one stops working immediately.
 *
 * The secret is returned exactly once per request and is never readable any
 * other way — there is no GET.
 */
export async function handleAgentSecret(request: Request, env: Env): Promise<Response> {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  let body: { ens?: string; owner_signature?: OwnerSignature };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  if (!body.ens || typeof body.ens !== "string") {
    return json({ error: "ens is required" }, 400);
  }

  const agent = await env.AGENTS_KV.get<AgentManifest>(`agents:${body.ens}`, "json");
  if (!agent) {
    return json({ error: `No listing found for ${body.ens}` }, 404);
  }

  // The payout address comes from the STORED manifest, never from the request,
  // so a caller cannot nominate a wallet they happen to control.
  const message = buildSecretMessage({
    ens: body.ens,
    payment_address: agent.payment_address,
    nonce: body.owner_signature?.nonce ?? "",
    issued_at: body.owner_signature?.issued_at ?? 0,
  });

  const check = await verifySignedMessage(
    message,
    agent.payment_address,
    body.owner_signature,
    env,
    "the payout address on this listing"
  );
  if (!check.valid) {
    return json({ error: check.error }, 401);
  }

  const secret = generateAgentSecret();
  await env.AGENTS_KV.put(secretKey(body.ens), secret);

  return json({
    success: true,
    ens: body.ens,
    agent_secret: secret,
    note: "Store this now — it is not retrievable later. Any previous secret is no longer valid.",
  });
}
